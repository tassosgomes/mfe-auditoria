import type { AuditEvent } from "./types";

export interface PendingEvent {
  id: number;
  event: AuditEvent;
  createdAt: string;
  retryCount: number;
}

interface LocalQueue {
  enqueue(event: AuditEvent): Promise<void>;
  dequeueBatch(limit: number): Promise<PendingEvent[]>;
  deleteBatch(ids: number[]): Promise<void>;
  count(): Promise<number>;
}

const DB_NAME = "AuditQueueDB";
const STORE_NAME = "pendingEvents";
const DB_VERSION = 1;
const MAX_QUEUE_SIZE = 1000;
const WARN_THRESHOLD = 0.8;

const logWarn = (message: string, ...args: unknown[]) =>
  console.warn(`[Telemetry] ${message}`, ...args);

const isIndexedDbAvailable = () => typeof indexedDB !== "undefined";

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const warnIfNearLimit = (count: number) => {
  const threshold = Math.ceil(MAX_QUEUE_SIZE * WARN_THRESHOLD);
  if (count >= threshold) {
    logWarn("Fila local próxima do limite.", {
      count,
      max: MAX_QUEUE_SIZE,
    });
  }
};

const trimOldest = async (
  store: IDBObjectStore,
  excess: number
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (excess <= 0) {
      resolve();
      return;
    }

    let deleted = 0;
    const request = store.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || deleted >= excess) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
  });

const indexedDbQueue: LocalQueue = {
  async enqueue(event) {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const count = await requestToPromise(store.count());
    const excess = count >= MAX_QUEUE_SIZE ? count - MAX_QUEUE_SIZE + 1 : 0;
    await trimOldest(store, excess);
    const nextCount = Math.min(count - excess + 1, MAX_QUEUE_SIZE);
    warnIfNearLimit(nextCount);
    store.add({ event, createdAt: new Date().toISOString(), retryCount: 0 });
    await waitForTransaction(tx);
  },
  async dequeueBatch(limit) {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const results: PendingEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve();
          return;
        }
        results.push(cursor.value as PendingEvent);
        cursor.continue();
      };
    });

    return results;
  },
  async deleteBatch(ids) {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    await waitForTransaction(tx);
  },
  async count() {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    return requestToPromise(request);
  },
};

const createMemoryQueue = (): LocalQueue => {
  let counter = 1;
  const items: PendingEvent[] = [];

  return {
    async enqueue(event) {
      if (items.length >= MAX_QUEUE_SIZE) {
        const excess = items.length - MAX_QUEUE_SIZE + 1;
        items.splice(0, excess);
      }
      items.push({
        id: counter++,
        event,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      warnIfNearLimit(items.length);
    },
    async dequeueBatch(limit) {
      return items.slice(0, limit);
    },
    async deleteBatch(ids) {
      ids.forEach((id) => {
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
          items.splice(index, 1);
        }
      });
    },
    async count() {
      return items.length;
    },
  };
};

const memoryQueue = createMemoryQueue();

export const localQueue: LocalQueue = {
  enqueue: (event) =>
    isIndexedDbAvailable() ? indexedDbQueue.enqueue(event) : memoryQueue.enqueue(event),
  dequeueBatch: (limit) =>
    isIndexedDbAvailable()
      ? indexedDbQueue.dequeueBatch(limit)
      : memoryQueue.dequeueBatch(limit),
  deleteBatch: (ids) =>
    isIndexedDbAvailable()
      ? indexedDbQueue.deleteBatch(ids)
      : memoryQueue.deleteBatch(ids),
  count: () =>
    isIndexedDbAvailable() ? indexedDbQueue.count() : memoryQueue.count(),
};
