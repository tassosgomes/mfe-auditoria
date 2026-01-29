import { localQueue } from "./localQueue";
import type { AuditEvent, FlushResult } from "../types";

export interface WorkerConfig {
  apiBaseUrl: string;
  baseIntervalMs: number;
  maxRetries: number;
  circuitBreakerPauseMs: number;
  batchSize: number;
  onApiOnline?: () => void;
  onApiOffline?: () => void;
  onEventsSent?: (count: number) => void;
  onFlushComplete?: () => void;
}

const DEFAULT_CONFIG = {
  baseIntervalMs: 15000,
  maxRetries: 5,
  circuitBreakerPauseMs: 120000,
  batchSize: 50,
};

const logInfo = (message: string, ...args: unknown[]) =>
  console.info(`[Telemetry] ${message}`, ...args);
const logWarn = (message: string, ...args: unknown[]) =>
  console.warn(`[Telemetry] ${message}`, ...args);

class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly pauseDuration: number;
  private readonly maxFailures: number;

  constructor(maxFailures: number, pauseDuration: number) {
    this.maxFailures = maxFailures;
    this.pauseDuration = pauseDuration;
  }

  isOpen(): boolean {
    if (this.failures < this.maxFailures) return false;
    if (!this.lastFailure) return false;

    const elapsed = Date.now() - this.lastFailure;
    if (elapsed > this.pauseDuration) {
      this.reset();
      return false;
    }
    return true;
  }

  getFailures(): number {
    return this.failures;
  }

  getRemainingPauseMs(): number {
    if (!this.lastFailure || this.failures < this.maxFailures) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailure;
    return Math.max(0, this.pauseDuration - elapsed);
  }

  recordFailure(): void {
    this.failures += 1;
    this.lastFailure = Date.now();
    logWarn("Falha registrada, total:", this.failures);
  }

  recordSuccess(): void {
    this.reset();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = null;
  }
}

const calculateBackoff = (failureCount: number, baseInterval: number): number => {
  const effectiveFailures = Math.max(0, failureCount - 1);
  const multiplier = Math.pow(2, Math.min(effectiveFailures, 3));
  return baseInterval * multiplier;
};

let config: WorkerConfig | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let circuitBreaker: CircuitBreaker | null = null;

export const configureWorker = (input: WorkerConfig): void => {
  config = {
    ...input,
    baseIntervalMs: input.baseIntervalMs ?? DEFAULT_CONFIG.baseIntervalMs,
    maxRetries: input.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    circuitBreakerPauseMs:
      input.circuitBreakerPauseMs ?? DEFAULT_CONFIG.circuitBreakerPauseMs,
    batchSize: input.batchSize ?? DEFAULT_CONFIG.batchSize,
  };
  circuitBreaker = new CircuitBreaker(
    config.maxRetries,
    config.circuitBreakerPauseMs
  );
};

const ensureConfig = (): WorkerConfig | null => {
  if (!config) {
    logWarn("Worker não configurado. Chame configureWorker primeiro.");
    return null;
  }
  return config;
};

const healthCheck = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${apiBaseUrl}/audit/v1/health`);
    if (!response.ok) {
      logWarn("Health check falhou:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    logWarn("Health check falhou:", error);
    return false;
  }
};

const sendBatch = async (apiBaseUrl: string, events: AuditEvent[]): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/audit/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
};

type FlushOutcome = "success" | "empty" | "failed" | "circuit-open" | "health-offline";

const flushQueueInternal = async (): Promise<{ result: FlushResult; outcome: FlushOutcome }> => {
  const currentConfig = ensureConfig();
  if (!currentConfig || !circuitBreaker) {
    return {
      result: { sent: 0, failed: 0, remaining: 0 },
      outcome: "empty",
    };
  }

  if (circuitBreaker.isOpen()) {
    logWarn("Circuit breaker aberto, aguardando...");
    const remaining = await localQueue.count();
    currentConfig.onFlushComplete?.();
    return {
      result: { sent: 0, failed: 0, remaining },
      outcome: "circuit-open",
    };
  }

  const apiHealthy = await healthCheck(currentConfig.apiBaseUrl);
  if (!apiHealthy) {
    circuitBreaker.recordFailure();
    currentConfig.onApiOffline?.();
    const remaining = await localQueue.count();
    currentConfig.onFlushComplete?.();
    return {
      result: { sent: 0, failed: 0, remaining },
      outcome: "health-offline",
    };
  }

  const batch = await localQueue.dequeueBatch(currentConfig.batchSize);
  if (batch.length === 0) {
    currentConfig.onApiOnline?.();
    currentConfig.onFlushComplete?.();
    return {
      result: { sent: 0, failed: 0, remaining: 0 },
      outcome: "empty",
    };
  }

  try {
    await sendBatch(
      currentConfig.apiBaseUrl,
      batch.map((item) => item.event)
    );

    const idsToDelete = batch
      .map((item) => item.id)
      .filter((id): id is number => typeof id === "number");
    await localQueue.deleteBatch(idsToDelete);

    circuitBreaker.recordSuccess();
    currentConfig.onApiOnline?.();
    currentConfig.onEventsSent?.(batch.length);

    const remaining = await localQueue.count();
    currentConfig.onFlushComplete?.();
    return {
      result: { sent: batch.length, failed: 0, remaining },
      outcome: "success",
    };
  } catch (error) {
    logWarn("Falha ao reenviar fila:", error);
    circuitBreaker.recordFailure();
    currentConfig.onApiOffline?.();

    const idsToUpdate = batch
      .map((item) => item.id)
      .filter((id): id is number => typeof id === "number");
    await localQueue.incrementRetryCount(idsToUpdate);

    const remaining = await localQueue.count();
    currentConfig.onFlushComplete?.();
    return {
      result: { sent: 0, failed: batch.length, remaining },
      outcome: "failed",
    };
  }
};

const scheduleNext = (delayMs: number) => {
  if (timerId) {
    clearTimeout(timerId);
  }
  timerId = setTimeout(() => {
    void runWorkerCycle();
  }, delayMs);
};

const runWorkerCycle = async (): Promise<void> => {
  const currentConfig = ensureConfig();
  if (!currentConfig || !circuitBreaker) {
    return;
  }

  const { outcome } = await flushQueueInternal();

  if (!isRunning) {
    return;
  }

  if (circuitBreaker.isOpen()) {
    const remainingPause = circuitBreaker.getRemainingPauseMs();
    scheduleNext(remainingPause || currentConfig.circuitBreakerPauseMs);
    return;
  }

  if (outcome === "failed" || outcome === "health-offline") {
    const delay = calculateBackoff(
      circuitBreaker.getFailures(),
      currentConfig.baseIntervalMs
    );
    scheduleNext(delay);
    return;
  }

  scheduleNext(currentConfig.baseIntervalMs);
};

export const startWorker = (): void => {
  const currentConfig = ensureConfig();
  if (!currentConfig) {
    return;
  }
  if (isRunning) {
    return;
  }
  isRunning = true;
  logInfo("Worker de reenvio iniciado.");
  scheduleNext(currentConfig.baseIntervalMs);
};

export const stopWorker = (): void => {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  if (isRunning) {
    logInfo("Worker de reenvio parado.");
  }
  isRunning = false;
};

export const flushQueue = async (): Promise<FlushResult> => {
  const { result } = await flushQueueInternal();
  return result;
};