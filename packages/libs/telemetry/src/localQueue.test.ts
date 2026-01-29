import { describe, expect, it, vi } from "vitest";

const createEvent = () => ({
  type: "SCREEN_ACCESS" as const,
  screenId: "users",
  timestamp: new Date().toISOString(),
  userId: "user-1",
});

describe("localQueue", () => {
  it("usa fila em memória quando IndexedDB não está disponível", async () => {
    vi.resetModules();
    const original = globalThis.indexedDB;
    // @ts-expect-error - forçando ambiente sem indexedDB
    delete globalThis.indexedDB;

    const { localQueue } = await import("./localQueue");
    await localQueue.enqueue(createEvent());
    await localQueue.enqueue(createEvent());

    const count = await localQueue.count();
    const batch = await localQueue.dequeueBatch(1);

    expect(count).toBe(2);
    expect(batch).toHaveLength(1);

    await localQueue.deleteBatch([batch[0].id]);
    const remaining = await localQueue.count();
    expect(remaining).toBe(1);

    if (original) {
      // @ts-expect-error - restore
      globalThis.indexedDB = original;
    }
  });

  it("descarta eventos mais antigos ao atingir o limite", async () => {
    vi.resetModules();
    const original = globalThis.indexedDB;
    // @ts-expect-error - forçando ambiente sem indexedDB
    delete globalThis.indexedDB;

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

    if (original) {
      // @ts-expect-error - restore
      globalThis.indexedDB = original;
    }
  });

  it("usa IndexedDB quando disponível", async () => {
    vi.resetModules();
    await import("fake-indexeddb/auto");

    const { localQueue } = await import("./localQueue");
    await localQueue.enqueue(createEvent());

    const count = await localQueue.count();
    expect(count).toBe(1);

    const batch = await localQueue.dequeueBatch(10);
    expect(batch).toHaveLength(1);

    await localQueue.deleteBatch([batch[0].id]);
    const remaining = await localQueue.count();
    expect(remaining).toBe(0);
  });
});
