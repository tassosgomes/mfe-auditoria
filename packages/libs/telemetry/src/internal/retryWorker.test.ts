import { describe, expect, it, vi } from "vitest";

const createEvent = () => ({
  type: "SCREEN_ACCESS" as const,
  screenId: "users",
  timestamp: new Date().toISOString(),
  userId: "user-1",
});

const disableIndexedDb = () => {
  const original = globalThis.indexedDB;
  // @ts-expect-error - forçando ambiente sem indexedDB
  delete globalThis.indexedDB;

  return () => {
    if (original) {
      // @ts-expect-error - restore
      globalThis.indexedDB = original;
    }
  };
};

describe("retryWorker", () => {
  it("aplica backoff exponencial com timer", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const restore = disableIndexedDb();

    const mockFetch = vi.fn((input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/audit/v1/health")) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.reject(new Error("offline"));
    });
    vi.stubGlobal("fetch", mockFetch);

    const { localQueue } = await import("./localQueue");
    const { configureWorker, startWorker, stopWorker } = await import(
      "./retryWorker"
    );

    await localQueue.enqueue(createEvent());

    configureWorker({
      apiBaseUrl: "http://localhost:8080",
      baseIntervalMs: 1000,
      maxRetries: 5,
      circuitBreakerPauseMs: 5000,
      batchSize: 1,
    });

    startWorker();

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(6);

    stopWorker();
    restore();
    vi.useRealTimers();
  });

  it("abre circuit breaker após falhas e respeita pausa", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const restore = disableIndexedDb();

    const mockFetch = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", mockFetch);

    const { localQueue } = await import("./localQueue");
    const { configureWorker, flushQueue } = await import("./retryWorker");

    await localQueue.enqueue(createEvent());

    configureWorker({
      apiBaseUrl: "http://localhost:8080",
      baseIntervalMs: 1000,
      maxRetries: 2,
      circuitBreakerPauseMs: 2000,
      batchSize: 1,
    });

    const first = await flushQueue();
    const second = await flushQueue();

    expect(first.remaining).toBe(1);
    expect(second.remaining).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const third = await flushQueue();
    expect(third.remaining).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(Date.now() + 2500));
    const fourth = await flushQueue();
    expect(fourth.remaining).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    restore();
    vi.useRealTimers();
  });
});