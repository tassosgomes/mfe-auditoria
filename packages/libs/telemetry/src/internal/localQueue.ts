import Dexie, { Table } from "dexie";

import type { AuditEvent } from "../types";

export interface PendingEvent {
  id?: number;
  event: AuditEvent;
  createdAt: string;
  retryCount: number;
}

export interface ILocalQueue {
  enqueue(event: AuditEvent): Promise<void>;
  dequeueBatch(limit: number): Promise<PendingEvent[]>;
  deleteBatch(ids: number[]): Promise<void>;
  incrementRetryCount(ids: number[]): Promise<void>;
  count(): Promise<number>;
}

const MAX_QUEUE_SIZE = 1000;
const WARNING_THRESHOLD = 800;

if (typeof indexedDB !== "undefined") {
  Dexie.dependencies.indexedDB = indexedDB;
  if (typeof IDBKeyRange !== "undefined") {
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  }
}

class AuditQueueDB extends Dexie {
  pendingEvents!: Table<PendingEvent, number>;

  constructor() {
    super("AuditQueueDB");
    this.version(1).stores({
      pendingEvents: "++id, createdAt",
    });
  }
}

const db = new AuditQueueDB();

const logWarn = (message: string, ...args: unknown[]) =>
  console.warn(`[Telemetry] ${message}`, ...args);

const isIndexedDbAvailable = () => typeof indexedDB !== "undefined";

const warnIfNearLimit = (currentCount: number, nextCount: number) => {
  if (currentCount < WARNING_THRESHOLD && nextCount >= WARNING_THRESHOLD) {
    logWarn("Fila atingiu 80% da capacidade:", nextCount);
  }
};

const trimOldestIfNeeded = async (currentCount: number): Promise<number> => {
  if (currentCount < MAX_QUEUE_SIZE) {
    return currentCount;
  }

  const oldest = await db.pendingEvents.orderBy("createdAt").first();
  if (oldest?.id !== undefined) {
    await db.pendingEvents.delete(oldest.id);
    logWarn("Fila cheia, descartando evento mais antigo");
    return currentCount - 1;
  }

  return currentCount;
};

const indexedDbQueue: ILocalQueue = {
  async enqueue(event) {
    const currentCount = await db.pendingEvents.count();
    const trimmedCount = await trimOldestIfNeeded(currentCount);
    const nextCount = trimmedCount + 1;
    warnIfNearLimit(trimmedCount, nextCount);

    await db.pendingEvents.add({
      event,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  },
  async dequeueBatch(limit) {
    return db.pendingEvents.orderBy("createdAt").limit(limit).toArray();
  },
  async deleteBatch(ids) {
    if (ids.length === 0) {
      return;
    }
    await db.pendingEvents.bulkDelete(ids);
  },
  async incrementRetryCount(ids) {
    if (ids.length === 0) {
      return;
    }
    await db.pendingEvents.where("id").anyOf(ids).modify((event) => {
      event.retryCount = (event.retryCount ?? 0) + 1;
    });
  },
  async count() {
    return db.pendingEvents.count();
  },
};

const createMemoryQueue = (): ILocalQueue => {
  let nextId = 1;
  const items: PendingEvent[] = [];

  return {
    async enqueue(event) {
      let currentCount = items.length;
      if (currentCount >= MAX_QUEUE_SIZE) {
        const excess = currentCount - MAX_QUEUE_SIZE + 1;
        items.splice(0, excess);
        logWarn("Fila cheia, descartando evento mais antigo");
        currentCount -= excess;
      }

      const nextCount = currentCount + 1;
      warnIfNearLimit(currentCount, nextCount);

      items.push({
        id: nextId++,
        event,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
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
    async incrementRetryCount(ids) {
      ids.forEach((id) => {
        const item = items.find((entry) => entry.id === id);
        if (item) {
          item.retryCount += 1;
        }
      });
    },
    async count() {
      return items.length;
    },
  };
};

const memoryQueue = createMemoryQueue();

export const localQueue: ILocalQueue = {
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
  incrementRetryCount: (ids) =>
    isIndexedDbAvailable()
      ? indexedDbQueue.incrementRetryCount(ids)
      : memoryQueue.incrementRetryCount(ids),
  count: () => (isIndexedDbAvailable() ? indexedDbQueue.count() : memoryQueue.count()),
};