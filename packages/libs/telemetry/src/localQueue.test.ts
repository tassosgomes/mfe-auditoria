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

const ensureIndexedDb = async () => {
  const { indexedDB, IDBKeyRange } = await import("fake-indexeddb");
  if (!globalThis.indexedDB) {
    // @ts-expect-error - set fake indexedDB for tests
    globalThis.indexedDB = indexedDB;
    // @ts-expect-error - set fake IDBKeyRange for Dexie
    globalThis.IDBKeyRange = IDBKeyRange;
  }
  return indexedDB;
};

const resetIndexedDb = async () => {
  const indexedDB = await ensureIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("AuditQueueDB");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
};

describe("localQueue", () => {
  it("usa fila em memória quando IndexedDB não está disponível", async () => {
    vi.resetModules();
    const restore = disableIndexedDb();

    try {
      const { localQueue } = await import("./localQueue");
      await localQueue.enqueue(createEvent());
      await localQueue.enqueue(createEvent());

      const count = await localQueue.count();
      const batch = await localQueue.dequeueBatch(1);

      expect(count).toBe(2);
      expect(batch).toHaveLength(1);

      await localQueue.incrementRetryCount([batch[0].id]);
      const updated = await localQueue.dequeueBatch(1);
      expect(updated[0].retryCount).toBe(1);

      await localQueue.deleteBatch([batch[0].id]);
      const remaining = await localQueue.count();
      expect(remaining).toBe(1);
    } finally {
      restore();
    }
  });

  it("descarta eventos mais antigos ao atingir o limite", async () => {
    vi.resetModules();
    const restore = disableIndexedDb();

    try {
      const { localQueue } = await import("./localQueue");

      for (let i = 0; i < 1001; i += 1) {
        await localQueue.enqueue({
          ...createEvent(),
          screenId: `screen-${i}`,
        });
      }

      const count = await localQueue.count();
      const batch = await localQueue.dequeueBatch(1);

      expect(count).toBe(1000);
      expect(batch[0].event.screenId).toBe("screen-1");
    } finally {
      restore();
    }
  });

  it("usa IndexedDB quando disponível", async () => {
    vi.resetModules();
    await resetIndexedDb();

    const { localQueue } = await import("./localQueue");
    await localQueue.enqueue(createEvent());

    const count = await localQueue.count();
    expect(count).toBe(1);

    const batch = await localQueue.dequeueBatch(10);
    expect(batch).toHaveLength(1);

    await localQueue.incrementRetryCount([batch[0].id]);
    const updated = await localQueue.dequeueBatch(1);
    expect(updated[0].retryCount).toBe(1);

    await localQueue.deleteBatch([batch[0].id]);
    const remaining = await localQueue.count();
    expect(remaining).toBe(0);
  });

  it("mantém eventos após reload da página", async () => {
    vi.resetModules();
    await resetIndexedDb();

    const { localQueue } = await import("./localQueue");
    await localQueue.enqueue(createEvent());

    const firstCount = await localQueue.count();
    expect(firstCount).toBe(1);

    vi.resetModules();
    await ensureIndexedDb();

    const { localQueue: reloadedQueue } = await import("./localQueue");
    const persistedCount = await reloadedQueue.count();

    expect(persistedCount).toBe(1);

    const batch = await reloadedQueue.dequeueBatch(10);
    await reloadedQueue.deleteBatch(batch.map((item) => item.id).filter(Boolean) as number[]);

    await resetIndexedDb();
  });
});
