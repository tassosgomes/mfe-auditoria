---
status: pending
parallelizable: false
blocked_by: ["2.0"]
---

<task_context>
<domain>frontend/telemetry</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>typescript, keycloak-js</dependencies>
<unblocks>4.0, 8.0, 9.0, 10.0</unblocks>
</task_context>

# Tarefa 3.0: Implementar Biblioteca de Telemetria (core)

## Visão Geral

Implementar o núcleo da biblioteca de telemetria que será compartilhada via Module Federation. Esta biblioteca fornece a API pública para registro de eventos de auditoria e é responsável por capturar dados do token Keycloak automaticamente.

<requirements>
- RF01.1: Expor função `logScreenAccess(screenId, metadata?)`
- RF01.2: Expor função `logNavigation(from, to)`
- RF01.3: Expor função `logApiIntent(endpoint, metadata?)`
- RF01.4: Expor função `logApiError(endpoint, error, metadata?)`
- RF01.5: Capturar automaticamente userId, email e name do token JWT
- RF01.6: Incluir timestamp ISO 8601 em todos os eventos
- RF01.7: Tentar envio imediato para API; em caso de falha, armazenar no IndexedDB
- RF01.8: Expor função `flushQueue()` para reenvio manual
</requirements>

## Subtarefas

- [ ] 3.1 Criar estrutura do package `packages/telemetry`
- [ ] 3.2 Definir interfaces e tipos em `src/types.ts`:
  - `AuditEvent`
  - `TelemetryConfig`
  - `FlushResult`
  - `QueueStatus`
- [ ] 3.3 Implementar `src/telemetryClient.ts`:
  - Função `initTelemetry(config: TelemetryConfig)`
  - Função `logScreenAccess(screenId, metadata?)`
  - Função `logNavigation(from, to)`
  - Função `logApiIntent(endpoint, metadata?)`
  - Função `logApiError(endpoint, error, metadata?)`
  - Função `getQueueStatus(): Promise<QueueStatus>`
- [ ] 3.4 Implementar extração de dados do token Keycloak
- [ ] 3.5 Implementar lógica de envio para API com fallback para fila local
- [ ] 3.6 Criar `src/index.ts` com exports públicos
- [ ] 3.7 Configurar build do package (tsconfig.json, vite.config.ts)
- [ ] 3.8 Escrever testes unitários para telemetryClient
- [ ] 3.9 Documentar API pública no README do package

## Detalhes de Implementação

### Interface AuditEvent

```typescript
export interface AuditEvent {
  type: 'SCREEN_ACCESS' | 'NAVIGATION' | 'API_INTENT' | 'API_ERROR';
  screenId: string;
  timestamp: string; // ISO 8601
  userId: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}
```

### Interface TelemetryConfig

```typescript
export interface TelemetryConfig {
  apiBaseUrl: string;
  batchSize?: number;        // default: 50
  retryIntervalMs?: number;  // default: 15000
  maxRetries?: number;       // default: 5
  getKeycloakToken?: () => { sub: string; email?: string; name?: string } | null;
}
```

### Lógica de envio

```typescript
async function sendEvent(event: AuditEvent): Promise<void> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/audit/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    sessionEventsSent++;
  } catch (error) {
    console.warn('[Telemetry] API offline, enfileirando evento:', error);
    await localQueue.enqueue(event);
  }
}
```

### Extração de dados do Keycloak

```typescript
function getUserFromToken(): { userId: string; email?: string; name?: string } {
  const tokenData = config.getKeycloakToken?.();
  if (!tokenData) {
    throw new Error('Token não disponível');
  }
  return {
    userId: tokenData.sub,
    email: tokenData.email,
    name: tokenData.name
  };
}
```

## Critérios de Sucesso

- [ ] Package `@auditoria/telemetry` compila sem erros
- [ ] Todas as funções públicas exportadas e documentadas
- [ ] `logScreenAccess` cria evento com tipo `SCREEN_ACCESS`
- [ ] `logNavigation` cria evento com tipo `NAVIGATION`
- [ ] Eventos contêm `timestamp` em formato ISO 8601
- [ ] Eventos contêm `userId` extraído do token Keycloak
- [ ] Quando API retorna erro, evento é passado para fila local
- [ ] Testes unitários passando com cobertura > 80%
- [ ] Console logs estruturados conforme padrão `[Telemetry]`
