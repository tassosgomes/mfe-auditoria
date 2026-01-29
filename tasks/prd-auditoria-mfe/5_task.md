---
status: completed
parallelizable: false
blocked_by: ["4.0"]
---

<task_context>
<domain>frontend/telemetry</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>timer, circuit-breaker</dependencies>
<unblocks>10.0, 11.0</unblocks>
</task_context>

# Tarefa 5.0: Implementar Worker de Reenvio

## Visão Geral

Implementar o worker (baseado em timer) que periodicamente verifica a fila local e tenta reenviar eventos pendentes para a API. O worker deve implementar backoff exponencial e circuit breaker para lidar com falhas consecutivas de forma resiliente.

<requirements>
- RF03.1: Executar verificação de fila a cada 15 segundos
- RF03.2: Implementar backoff exponencial (15s → 30s → 60s → 120s)
- RF03.3: Implementar circuit breaker: após 5 falhas, pausar por 2 minutos
- RF03.4: Processar eventos em lotes de até 50 itens por vez
- RF01.8: Expor função `flushQueue()` para reenvio manual
</requirements>

## Subtarefas

- [x] 5.1 Criar `src/internal/retryWorker.ts`
- [x] 5.2 Implementar timer com intervalo configurável (default: 15s)
- [x] 5.3 Implementar função `startWorker()`:
  - Iniciar timer de verificação periódica
  - Prevenir múltiplas instâncias do worker
- [x] 5.4 Implementar função `stopWorker()`:
  - Parar timer e limpar recursos
- [x] 5.5 Implementar backoff exponencial:
  ```
  tentativa 1: 15s
  tentativa 2: 30s
  tentativa 3: 60s
  tentativa 4: 120s
  tentativa 5+: circuit breaker
  ```
- [x] 5.6 Implementar circuit breaker:
  - Após 5 falhas consecutivas, pausar reenvios por 2 minutos
  - Reset do contador após sucesso
- [x] 5.7 Implementar função `flushQueue()`:
  - Disparar reenvio imediato (ignora timer)
  - Retornar `FlushResult` com contagem de enviados/falhos/restantes
- [x] 5.8 Implementar processamento em batch:
  - Buscar até 50 eventos da fila por vez
  - Enviar como array para API
  - Remover apenas os bem-sucedidos
- [x] 5.9 Implementar health check da API antes de enviar batch
- [x] 5.10 Escrever testes unitários com mock de timer
- [x] 5.11 Integrar worker com telemetryClient (iniciar automaticamente)

## Detalhes de Implementação

### Configuração do Worker

```typescript
interface WorkerConfig {
  baseIntervalMs: number;      // default: 15000
  maxRetries: number;          // default: 5
  circuitBreakerPauseMs: number; // default: 120000 (2 min)
  batchSize: number;           // default: 50
}

const DEFAULT_CONFIG: WorkerConfig = {
  baseIntervalMs: 15000,
  maxRetries: 5,
  circuitBreakerPauseMs: 120000,
  batchSize: 50
};
```

### Backoff Exponencial

```typescript
function calculateBackoff(failureCount: number, baseInterval: number): number {
  const multiplier = Math.pow(2, Math.min(failureCount, 3)); // max 8x
  return baseInterval * multiplier;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly pauseDuration: number;
  private readonly maxFailures: number;

  constructor(maxFailures = 5, pauseDuration = 120000) {
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

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    console.warn('[Telemetry] Falha registrada, total:', this.failures);
  }

  recordSuccess(): void {
    this.reset();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = null;
  }
}
```

### Função flushQueue

```typescript
export async function flushQueue(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, remaining: 0 };
  
  if (circuitBreaker.isOpen()) {
    console.warn('[Telemetry] Circuit breaker aberto, aguardando...');
    result.remaining = await localQueue.count();
    return result;
  }
  
  const batch = await localQueue.dequeueBatch(config.batchSize);
  if (batch.length === 0) {
    return result;
  }
  
  try {
    const response = await fetch(`${apiBaseUrl}/audit/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch.map(p => p.event) })
    });
    
    if (response.ok) {
      await localQueue.deleteBatch(batch.map(p => p.id!));
      result.sent = batch.length;
      circuitBreaker.recordSuccess();
    } else {
      throw new Error(`API error: ${response.status}`);
    }
  } catch (error) {
    result.failed = batch.length;
    circuitBreaker.recordFailure();
    await localQueue.incrementRetryCount(batch.map(p => p.id!));
  }
  
  result.remaining = await localQueue.count();
  return result;
}
```

## Critérios de Sucesso

- [x] Worker inicia automaticamente com `initTelemetry()`
- [x] Worker executa a cada 15 segundos (configurável)
- [x] Backoff exponencial aplicado corretamente (15s → 30s → 60s → 120s)
- [x] Circuit breaker ativa após 5 falhas consecutivas
- [x] Circuit breaker reseta após 2 minutos de pausa
- [x] Circuit breaker reseta após um sucesso
- [x] `flushQueue()` pode ser chamada manualmente e retorna `FlushResult`
- [x] Batch de até 50 eventos enviados por vez
- [x] Eventos bem-sucedidos são removidos da fila
- [x] Eventos com falha permanecem na fila
- [x] Logs estruturados para debug: `[Telemetry] ...`
- [x] Testes unitários passando com mocks de timer e fetch
