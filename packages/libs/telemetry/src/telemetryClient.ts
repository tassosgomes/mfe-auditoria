import { localQueue } from "./localQueue";
import {
  configureWorker,
  flushQueue as workerFlushQueue,
  startWorker,
  stopWorker,
} from "./internal/retryWorker";
import type { AuditEvent, FlushResult, QueueStatus, TelemetryConfig } from "./types";

const DEFAULTS = {
  batchSize: 50,
  retryIntervalMs: 15000,
  maxRetries: 5,
  circuitBreakerPauseMs: 120000,
};

type TokenPayload = {
  sub: string;
  email?: string;
  name?: string;
};

type InternalConfig = {
  apiBaseUrl: string;
  batchSize: number;
  retryIntervalMs: number;
  maxRetries: number;
  circuitBreakerPauseMs: number;
  getKeycloakToken?: () => TokenPayload | null;
};

let config: InternalConfig | null = null;
let apiStatus: QueueStatus["apiStatus"] = "unknown";
let lastFlushAt: string | undefined;
let sessionEventsSent = 0;

const logInfo = (message: string, ...args: unknown[]) =>
  console.info(`[Telemetry] ${message}`, ...args);
const logWarn = (message: string, ...args: unknown[]) =>
  console.warn(`[Telemetry] ${message}`, ...args);
const logError = (message: string, ...args: unknown[]) =>
  console.error(`[Telemetry] ${message}`, ...args);

const ensureConfig = (): InternalConfig | null => {
  if (!config) {
    logError("initTelemetry precisa ser chamado antes de enviar eventos.");
    return null;
  }
  return config;
};

const getUserFromToken = (currentConfig: InternalConfig): {
  userId: string;
  email?: string;
  name?: string;
} | null => {
  const tokenData = currentConfig.getKeycloakToken?.();
  if (!tokenData?.sub) {
    logWarn("Token do Keycloak não disponível para telemetria.");
    return null;
  }

  return {
    userId: tokenData.sub,
    email: tokenData.email,
    name: tokenData.name,
  };
};

const buildEvent = (
  type: AuditEvent["type"],
  screenId: string,
  metadata?: Record<string, unknown>
): AuditEvent | null => {
  const currentConfig = ensureConfig();
  if (!currentConfig) {
    return null;
  }

  const user = getUserFromToken(currentConfig);
  if (!user) {
    return null;
  }

  return {
    type,
    screenId,
    timestamp: new Date().toISOString(),
    userId: user.userId,
    userEmail: user.email,
    userName: user.name,
    metadata,
  };
};

const sendEvents = async (events: AuditEvent[]): Promise<void> => {
  const currentConfig = ensureConfig();
  if (!currentConfig) {
    return;
  }

  const response = await fetch(`${currentConfig.apiBaseUrl}/audit/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  apiStatus = "online";
  sessionEventsSent += events.length;
};

const sendEvent = async (event: AuditEvent): Promise<void> => {
  try {
    await sendEvents([event]);
  } catch (error) {
    apiStatus = "offline";
    logWarn("API offline, enfileirando evento:", error);
    await localQueue.enqueue(event);
  }
};

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { value: error };
};

export const initTelemetry = (input: TelemetryConfig): void => {
  if (!input?.apiBaseUrl) {
    throw new Error("[Telemetry] apiBaseUrl é obrigatório para inicialização.");
  }

  stopWorker();

  config = {
    apiBaseUrl: input.apiBaseUrl,
    batchSize: input.batchSize ?? DEFAULTS.batchSize,
    retryIntervalMs: input.retryIntervalMs ?? DEFAULTS.retryIntervalMs,
    maxRetries: input.maxRetries ?? DEFAULTS.maxRetries,
    circuitBreakerPauseMs:
      input.circuitBreakerPauseMs ?? DEFAULTS.circuitBreakerPauseMs,
    getKeycloakToken: input.getKeycloakToken,
  };

  apiStatus = "unknown";
  lastFlushAt = undefined;
  sessionEventsSent = 0;

  configureWorker({
    apiBaseUrl: config.apiBaseUrl,
    baseIntervalMs: config.retryIntervalMs,
    maxRetries: config.maxRetries,
    circuitBreakerPauseMs: config.circuitBreakerPauseMs,
    batchSize: config.batchSize,
    onApiOnline: () => {
      apiStatus = "online";
    },
    onApiOffline: () => {
      apiStatus = "offline";
    },
    onEventsSent: (count) => {
      sessionEventsSent += count;
    },
    onFlushComplete: () => {
      lastFlushAt = new Date().toISOString();
    },
  });

  startWorker();
  logInfo("Telemetry inicializada.");
};

export const logScreenAccess = (
  screenId: string,
  metadata?: Record<string, unknown>
): void => {
  const event = buildEvent("SCREEN_ACCESS", screenId, metadata);
  if (!event) {
    return;
  }
  void sendEvent(event);
};

export const logNavigation = (from: string | null, to: string): void => {
  const event = buildEvent("NAVIGATION", to, { from, to });
  if (!event) {
    return;
  }
  void sendEvent(event);
};

export const logApiIntent = (
  endpoint: string,
  metadata?: Record<string, unknown>
): void => {
  const event = buildEvent("API_INTENT", endpoint, metadata);
  if (!event) {
    return;
  }
  void sendEvent(event);
};

export const logApiError = (
  endpoint: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void => {
  const errorMetadata = {
    ...metadata,
    error: serializeError(error),
  };
  const event = buildEvent("API_ERROR", endpoint, errorMetadata);
  if (!event) {
    return;
  }
  void sendEvent(event);
};

export const flushQueue = async (): Promise<FlushResult> => {
  const currentConfig = ensureConfig();
  if (!currentConfig) {
    return { sent: 0, failed: 0, remaining: 0 };
  }

  return workerFlushQueue();
};

export const getQueueStatus = async (): Promise<QueueStatus> => {
  const pendingCount = await localQueue.count();

  return {
    pendingCount,
    apiStatus,
    lastFlushAt,
    sessionEventsSent,
  };
};
