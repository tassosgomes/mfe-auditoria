---
status: pending
parallelizable: false
blocked_by: ["3.0"]
---

<task_context>
<domain>frontend/storage</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>dexie, indexeddb</dependencies>
<unblocks>5.0</unblocks>
</task_context>

# Tarefa 4.0: Implementar Fila Local com IndexedDB

## Visão Geral

Implementar a fila local utilizando IndexedDB (via Dexie.js) para armazenar eventos de auditoria quando a API estiver indisponível. A fila deve persistir entre reloads da página e implementar políticas de limite para evitar estouro de armazenamento.

<requirements>
- RF02.1: Implementar operação `enqueue(event)` para salvar evento pendente
- RF02.2: Implementar operação `dequeueBatch(limit)` para ler lote de eventos
- RF02.3: Implementar operação `deleteBatch(ids)` para remover eventos enviados
- RF02.4: Implementar operação `count()` para retornar quantidade pendente
- RF02.5: Persistir eventos entre reloads da página
- Limite de 1000 eventos na fila (descarte FIFO)
</requirements>

## Subtarefas

- [ ] 4.1 Adicionar dependência Dexie.js ao package telemetry
- [ ] 4.2 Criar `src/internal/localQueue.ts` com interface `ILocalQueue`
- [ ] 4.3 Implementar schema do banco IndexedDB:
  ```typescript
  const db = new Dexie('AuditQueueDB');
  db.version(1).stores({
    pendingEvents: '++id, createdAt'
  });
  ```
- [ ] 4.4 Implementar função `enqueue(event: AuditEvent)`:
  - Verificar se fila atingiu limite (1000)
  - Se limite atingido, descartar evento mais antigo (FIFO)
  - Log warning quando fila atinge 80% (800 eventos)
- [ ] 4.5 Implementar função `dequeueBatch(limit: number)`:
  - Retornar até `limit` eventos ordenados por `createdAt`
  - Retornar array de `PendingEvent` com id, event, createdAt, retryCount
- [ ] 4.6 Implementar função `deleteBatch(ids: number[])`:
  - Remover eventos pelos IDs após envio bem-sucedido
- [ ] 4.7 Implementar função `count()`:
  - Retornar número total de eventos na fila
- [ ] 4.8 Implementar função `incrementRetryCount(ids: number[])`:
  - Incrementar contador de tentativas para controle de backoff
- [ ] 4.9 Escrever testes unitários para todas as operações
- [ ] 4.10 Testar persistência após reload da página

## Detalhes de Implementação

### Interface PendingEvent

```typescript
interface PendingEvent {
  id?: number;           // auto-increment
  event: AuditEvent;
  createdAt: string;     // ISO 8601
  retryCount: number;
}
```

### Interface ILocalQueue

```typescript
interface ILocalQueue {
  enqueue(event: AuditEvent): Promise<void>;
  dequeueBatch(limit: number): Promise<PendingEvent[]>;
  deleteBatch(ids: number[]): Promise<void>;
  incrementRetryCount(ids: number[]): Promise<void>;
  count(): Promise<number>;
}
```

### Implementação com Dexie.js

```typescript
import Dexie, { Table } from 'dexie';

const MAX_QUEUE_SIZE = 1000;
const WARNING_THRESHOLD = 800;

class AuditQueueDB extends Dexie {
  pendingEvents!: Table<PendingEvent>;

  constructor() {
    super('AuditQueueDB');
    this.version(1).stores({
      pendingEvents: '++id, createdAt'
    });
  }
}

const db = new AuditQueueDB();

export async function enqueue(event: AuditEvent): Promise<void> {
  const currentCount = await db.pendingEvents.count();
  
  if (currentCount >= WARNING_THRESHOLD) {
    console.warn('[Telemetry] Fila atingiu 80% da capacidade:', currentCount);
  }
  
  if (currentCount >= MAX_QUEUE_SIZE) {
    // Descartar evento mais antigo (FIFO)
    const oldest = await db.pendingEvents.orderBy('createdAt').first();
    if (oldest?.id) {
      await db.pendingEvents.delete(oldest.id);
      console.warn('[Telemetry] Fila cheia, descartando evento mais antigo');
    }
  }
  
  await db.pendingEvents.add({
    event,
    createdAt: new Date().toISOString(),
    retryCount: 0
  });
}
```

## Critérios de Sucesso

- [ ] Dexie.js integrado ao package telemetry
- [ ] `enqueue` adiciona evento ao IndexedDB
- [ ] `enqueue` descarta evento mais antigo quando fila cheia
- [ ] `enqueue` loga warning quando fila atinge 80%
- [ ] `dequeueBatch` retorna eventos ordenados por data de criação
- [ ] `deleteBatch` remove eventos corretamente
- [ ] `count` retorna número correto de eventos
- [ ] Eventos persistem após F5/reload da página
- [ ] Testes unitários passando
- [ ] Máximo de 1000 eventos na fila respeitado
