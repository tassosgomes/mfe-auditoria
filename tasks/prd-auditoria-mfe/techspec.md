# Especificação Técnica: POC de Auditoria em Micro Frontends

## Resumo Executivo

Esta especificação técnica descreve a implementação de uma POC de auditoria de acesso a telas em arquitetura Micro Frontend (MFE) utilizando Module Federation. A solução combina uma biblioteca de telemetria compartilhada (React/TypeScript), uma API REST de auditoria (.NET 8 com MongoDB) e um mecanismo de resiliência baseado em IndexedDB com worker de reenvio assíncrono.

A arquitetura prioriza desacoplamento (MFEs não conhecem a API de auditoria), padronização (biblioteca compartilhada via Module Federation), resiliência (fila local + reenvio com backoff exponencial e circuit breaker) e rastreabilidade (captura automática de dados do token Keycloak).

---

## Arquitetura do Sistema

### Visão Geral dos Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser (User Session)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│   │  mfe-users   │    │  mfe-orders  │    │       Host (Shell)   │  │
│   │  (Remote 1)  │    │  (Remote 2)  │    │   + Painel Auditoria │  │
│   └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│          │                   │                       │               │
│          └───────────────────┼───────────────────────┘               │
│                              ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │            Biblioteca de Telemetria (Module Federation)       │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │  │
│   │  │ TelemetryClient │  │  LocalQueue     │  │ RetryWorker  │  │  │
│   │  │ (API pública)   │  │  (IndexedDB)    │  │ (Timer)      │  │  │
│   │  └─────────────────┘  └─────────────────┘  └──────────────┘  │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API REST de Auditoria (.NET 8)                    │
│   POST /audit/v1/events   │   GET /audit/v1/health   │   MongoDB     │
└──────────────────────────────────────────────────────────────────────┘
                               ▲
┌──────────────────────────────┴───────────────────────────────────────┐
│                          Keycloak (OAuth 2.0 + PKCE)                  │
│                          Realm: auditoria-poc                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Componentes e Responsabilidades:**

| Componente | Responsabilidade | Tecnologia |
|------------|------------------|------------|
| **Host (Shell)** | Orquestra MFEs, gerencia autenticação, exibe painel de status | React 18, Vite, Module Federation |
| **mfe-users** | Telas de listagem/detalhe de usuários | React 18, Vite (remote) |
| **mfe-orders** | Telas de listagem/detalhe de pedidos | React 18, Vite (remote) |
| **Biblioteca Telemetria** | API de auditoria, fila local, worker de reenvio | TypeScript, IndexedDB (Dexie.js) |
| **API Auditoria** | Recebe/persiste eventos, health check | .NET 8 Minimal API, MongoDB |
| **Keycloak** | Autenticação centralizada com tokens JWT | Keycloak 24+ (Docker) |

**Fluxo de Dados Principal:**
1. Usuário acessa tela → MFE chama `logScreenAccess()`
2. Biblioteca tenta POST para API → Sucesso: descarta evento
3. Falha na API → Evento enfileirado no IndexedDB
4. Worker periodicamente executa `flushQueue()` → Reenvia batch para API
5. Sucesso no reenvio → Remove eventos da fila

---

## Design de Implementação

### Interfaces Principais

#### Biblioteca de Telemetria (TypeScript)

```typescript
// @auditoria/telemetry - Interface Pública

export interface AuditEvent {
  type: 'SCREEN_ACCESS' | 'NAVIGATION' | 'API_INTENT' | 'API_ERROR';
  screenId: string;
  timestamp: string; // ISO 8601
  userId: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryConfig {
  apiBaseUrl: string;
  batchSize?: number;        // default: 50
  retryIntervalMs?: number;  // default: 15000
  maxRetries?: number;       // default: 5
}

// Funções públicas exportadas
export function initTelemetry(config: TelemetryConfig): void;
export function logScreenAccess(screenId: string, metadata?: Record<string, unknown>): void;
export function logNavigation(from: string | null, to: string): void;
export function logApiIntent(endpoint: string, metadata?: Record<string, unknown>): void;
export function logApiError(endpoint: string, error: unknown, metadata?: Record<string, unknown>): void;
export function flushQueue(): Promise<FlushResult>;
export function getQueueStatus(): Promise<QueueStatus>;

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

export interface QueueStatus {
  pendingCount: number;
  apiStatus: 'online' | 'offline' | 'unknown';
  lastFlushAt?: string;
  sessionEventsSent: number;
}
```

#### Fila Local (IndexedDB via Dexie.js)

```typescript
// internal/localQueue.ts

interface PendingEvent {
  id?: number;           // auto-increment
  event: AuditEvent;
  createdAt: string;
  retryCount: number;
}

interface ILocalQueue {
  enqueue(event: AuditEvent): Promise<void>;
  dequeueBatch(limit: number): Promise<PendingEvent[]>;
  deleteBatch(ids: number[]): Promise<void>;
  count(): Promise<number>;
}
```

#### API REST de Auditoria (.NET 8)

```csharp
// Contratos da API

public record AuditEventRequest
{
    public required string Type { get; init; }
    public required string ScreenId { get; init; }
    public required DateTime Timestamp { get; init; }
    public required string UserId { get; init; }
    public string? UserEmail { get; init; }
    public string? UserName { get; init; }
    public Dictionary<string, object>? Metadata { get; init; }
}

public record BatchAuditRequest
{
    public required IReadOnlyList<AuditEventRequest> Events { get; init; }
}

public record BatchAuditResponse
{
    public int Received { get; init; }
    public int Processed { get; init; }
}

public record HealthResponse
{
    public string Status { get; init; } = "ok";
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}
```

### Modelos de Dados

#### Evento de Auditoria (MongoDB)

```json
{
  "_id": "ObjectId",
  "type": "SCREEN_ACCESS",
  "screenId": "users-list",
  "timestamp": "2026-01-28T22:15:00.000Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userEmail": "joao.silva@example.com",
  "userName": "João Silva",
  "metadata": {
    "sourceMfe": "mfe-users",
    "path": "/users",
    "sessionId": "abc123"
  },
  "receivedAt": "2026-01-28T22:15:01.000Z"
}
```

**Índices MongoDB:**
- `{ timestamp: -1 }` - Consultas por período
- `{ userId: 1, timestamp: -1 }` - Consultas por usuário
- `{ type: 1, timestamp: -1 }` - Consultas por tipo de evento
- `{ receivedAt: 1 }` - TTL index para expiração automática

**Política de Retenção de Dados:**
- Eventos expiram automaticamente após **90 dias**
- Implementado via TTL Index no MongoDB:
  ```javascript
  db.audit_events.createIndex(
    { "receivedAt": 1 },
    { expireAfterSeconds: 7776000 } // 90 dias
  )
  ```

#### Fila Local (IndexedDB)

```typescript
// Schema Dexie.js
const db = new Dexie('AuditQueueDB');
db.version(1).stores({
  pendingEvents: '++id, createdAt'
});

// Limite de 1000 eventos na fila
const MAX_QUEUE_SIZE = 1000;
```

**Política de Limite de Fila:**
- Máximo de 1000 eventos pendentes na fila local
- Ao atingir o limite, eventos mais antigos são descartados (FIFO)
- Log de warning quando fila atinge 80% da capacidade (800 eventos)

### Endpoints de API

| Método | Endpoint | Descrição | Request | Response |
|--------|----------|-----------|---------|----------|
| `POST` | `/audit/v1/events` | Recebe batch de eventos | `BatchAuditRequest` | `200 OK` + `BatchAuditResponse` |
| `GET` | `/audit/v1/health` | Status da API | - | `200 OK` + `HealthResponse` |
| `GET` | `/audit/v1/events` | Consulta eventos (paginado) | `?_page=1&_size=20` | Paginação RFC |

**Códigos de Retorno (conforme `restful.md`):**
- `200 OK` - Sucesso
- `400 Bad Request` - Payload inválido (RFC 9457 Problem Details)
- `500 Internal Server Error` - Erro do servidor (simulado em ~30% das requests)

**Exemplo de Resposta de Erro (RFC 9457):**
```json
{
  "type": "https://auditoria-poc/probs/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Campo 'screenId' é obrigatório",
  "instance": "/audit/v1/events"
}
```

---

## Pontos de Integração

### Keycloak (OAuth 2.0 + PKCE)

**Configuração do Realm:**
- Realm: `auditoria-poc`
- Client ID: `mfe-host`
- Fluxo: Authorization Code + PKCE
- Redirect URIs: `http://localhost:5173/*`
- Token expiration: 5 minutos (access), 30 minutos (refresh)

**Usuários de Teste:**

| Username | Email | Nome | Role | Senha |
|----------|-------|------|------|-------|
| `admin` | admin@auditoria-poc.local | Admin Sistema | admin | `admin123` |
| `joao.silva` | joao.silva@auditoria-poc.local | João Silva | user | `user123` |
| `maria.auditor` | maria.auditor@auditoria-poc.local | Maria Auditora | auditor | `auditor123` |

**Roles Configuradas:**
- `admin` - Acesso total ao sistema
- `user` - Acesso às telas de usuários e pedidos
- `auditor` - Acesso ao painel de auditoria + visualização de eventos

**Claims requeridas no JWT:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "joao.silva@example.com",
  "preferred_username": "joao.silva",
  "name": "João Silva"
}
```

**Integração no Frontend (keycloak-js):**
```typescript
// host/src/auth/keycloak.ts
import Keycloak from 'keycloak-js';

export const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'auditoria-poc',
  clientId: 'mfe-host'
});

export async function initKeycloak(): Promise<boolean> {
  return keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256'
  });
}

export function getUserFromToken(): { userId: string; email?: string; name?: string } | null {
  if (!keycloak.tokenParsed) return null;
  return {
    userId: keycloak.tokenParsed.sub!,
    email: keycloak.tokenParsed.email,
    name: keycloak.tokenParsed.name
  };
}
```

### Module Federation

**Configuração Host (vite.config.ts):**
```typescript
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'host',
      remotes: {
        mfeUsers: 'http://localhost:5174/assets/remoteEntry.js',
        mfeOrders: 'http://localhost:5175/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry']
    })
  ]
});
```

**Configuração Remote (mfe-users/vite.config.ts):**
```typescript
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mfeUsers',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx'
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry']
    })
  ]
});
```

---

## Análise de Impacto

| Componente Afetado | Tipo de Impacto | Descrição & Nível de Risco | Ação Requerida |
|-------------------|-----------------|---------------------------|----------------|
| Browser Storage | Novo recurso | IndexedDB para fila local. Risco baixo. | Testar em browsers target |
| MongoDB | Novo recurso | Collection `audit_events`. Risco baixo. | Criar índices apropriados |
| Keycloak | Novo realm | Realm `auditoria-poc` isolado. Risco baixo. | Configurar usuários de teste |
| CORS | Configuração | API deve aceitar origens dos MFEs. Risco médio. | Configurar allowed origins |

---

## Abordagem de Testes

### Testes Unitários

**Frontend (Vitest + Testing Library):**

```typescript
// telemetry/__tests__/telemetryClient.test.ts
describe('TelemetryClient', () => {
  it('deve enfileirar evento quando API falha', async () => {
    // Arrange
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Act
    logScreenAccess('users-list');
    
    // Assert
    const count = await localQueue.count();
    expect(count).toBe(1);
  });

  it('deve extrair userId do token Keycloak', () => {
    // Arrange
    mockKeycloak.tokenParsed = { sub: 'user-123' };
    
    // Act
    const event = buildEvent('SCREEN_ACCESS', 'users-list');
    
    // Assert
    expect(event.userId).toBe('user-123');
  });
});
```

**Backend (.NET - xUnit + AwesomeAssertions):**

```csharp
public class AuditEndpointTests
{
    [Fact]
    public async Task PostEvents_WithValidBatch_ReturnsOkWithCount()
    {
        // Arrange
        var request = new BatchAuditRequest
        {
            Events = new[] { CreateValidEvent() }
        };
        
        // Act
        var response = await _client.PostAsJsonAsync("/audit/v1/events", request);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<BatchAuditResponse>();
        result!.Processed.Should().Be(1);
    }

    [Fact]
    public async Task PostEvents_WithMissingScreenId_ReturnsBadRequest()
    {
        // Arrange
        var request = new BatchAuditRequest
        {
            Events = new[] { new AuditEventRequest { Type = "SCREEN_ACCESS", UserId = "123" } }
        };
        
        // Act
        var response = await _client.PostAsJsonAsync("/audit/v1/events", request);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
```

### Testes de Integração

**Cenários de integração (manual/automatizado):**

1. **API Online - Envio Direto:**
   - Navegar entre telas → Verificar eventos no MongoDB
   - Verificar fila vazia no IndexedDB

2. **API Offline - Enfileiramento:**
   - Desligar API → Navegar → Verificar eventos no IndexedDB
   - Verificar painel mostra "Offline" e contador incrementa

3. **Recuperação - Reenvio:**
   - Religar API → Aguardar worker → Verificar fila esvaziada
   - Verificar eventos chegaram no MongoDB

4. **Persistência - Reload:**
   - Com API offline, navegar → Dar F5 → Verificar eventos ainda na fila

---

## Sequenciamento de Desenvolvimento

### Ordem de Construção

| Fase | Componente | Dependências | Estimativa |
|------|------------|--------------|------------|
| 1 | Biblioteca de Telemetria (core) | - | 2 dias |
| 2 | Fila Local (IndexedDB) | Fase 1 | 1 dia |
| 3 | Worker de Reenvio | Fases 1, 2 | 1 dia |
| 4 | API REST de Auditoria (.NET) | - | 2 dias |
| 5 | Host + Keycloak | - | 2 dias |
| 6 | mfe-users | Fases 1, 5 | 1 dia |
| 7 | mfe-orders | Fases 1, 5 | 1 dia |
| 8 | Painel de Auditoria | Fases 1-7 | 1 dia |
| 9 | Integração e Testes | Fases 1-8 | 2 dias |

**Total estimado: ~13 dias**

### Dependências Técnicas

- Docker/Docker Compose (Keycloak + MongoDB)
- Node.js 20+ (frontend)
- .NET 8 SDK (backend)
- Browsers modernos com suporte a IndexedDB

---

## Monitoramento e Observabilidade

### Métricas (API .NET)

```csharp
// Métricas expostas via /metrics (Prometheus format)
audit_events_received_total{type="SCREEN_ACCESS"}
audit_events_processed_total{status="success|error"}
audit_api_request_duration_seconds{endpoint="/audit/v1/events"}
```

### Logs (estruturados)

**Backend (.NET):**
```csharp
_logger.LogInformation("Eventos recebidos: {Count}, Processados: {Processed}",
    request.Events.Count, processed);

_logger.LogWarning("Simulando falha de API (instabilidade configurada)");
```

**Frontend (console estruturado):**
```typescript
console.info('[Telemetry] Evento enfileirado:', { type, screenId, queueSize });
console.warn('[Telemetry] API offline, aplicando backoff:', { nextRetryMs });
```

### Health Checks

```csharp
// API .NET - Health endpoint
app.MapHealthChecks("/audit/v1/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            timestamp = DateTime.UtcNow
        });
    }
});
```

---

## Considerações Técnicas

### Decisões Principais

| Decisão | Justificativa | Alternativas Rejeitadas |
|---------|---------------|------------------------|
| **Dexie.js para IndexedDB** | API simplificada, promises nativas, bom suporte | `idb` (mais baixo nível), `localForage` (overhead) |
| **Module Federation via Vite** | Alinhamento com stack React+Vite, suporte ativo | Webpack Module Federation (overhead de migração) |
| **.NET Minimal API** | Simplicidade para POC, menor boilerplate | Controllers (overhead desnecessário para POC) |
| **MongoDB** | Schema flexível para eventos, fácil setup via Docker | PostgreSQL (schema rígido), SQLite (menos escalável) |
| **Timer ao invés de Web Worker** | Simplicidade, suficiente para POC | Web Worker (complexidade adicional desnecessária) |

### Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| IndexedDB quota excedida | Baixa | Médio | ✅ Limite de 1000 eventos implementado com descarte FIFO |
| Module Federation incompatibilidade | Média | Alto | Testar combinações de versões React/Vite antecipadamente |
| Token expirado durante reenvio | Média | Baixo | Biblioteca deve verificar token antes de enviar |
| CORS mal configurado | Alta | Médio | Documentar configuração detalhada |

### Requisitos Especiais

**Performance:**
- Batch de eventos: máximo 50 por requisição
- Intervalo do worker: 15 segundos (ajustável)
- Timeout de API: 5 segundos

**Segurança:**
- Não incluir dados sensíveis nos metadados
- API deve validar CORS (origins específicas)
- Tokens JWT com expiração curta (5-15 min)

### Conformidade com Padrões

- [x] API segue `restful.md` (versionamento no path, RFC 9457, paginação)
- [x] Código .NET segue `dotnet-coding-standards.md` (nomenclatura em inglês, métodos claros)
- [x] Testes seguem `dotnet-testing.md` (xUnit, AAA pattern, naming convention)
- [x] Health checks seguem `dotnet-observability.md`
- [x] Frontend segue princípios de `react-logging.md` (telemetria estruturada)

---

## Estrutura de Pastas Proposta

```
mfe-auditoria/
├── apps/
│   ├── host/                      # Shell principal
│   │   ├── src/
│   │   │   ├── auth/              # Integração Keycloak
│   │   │   ├── components/        # Componentes React
│   │   │   │   └── AuditPanel/    # Painel de status
│   │   │   └── App.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── mfe-users/                 # Remote Users
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── UsersList.tsx
│   │   │   │   └── UserDetail.tsx
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   └── mfe-orders/                # Remote Orders
│       └── (estrutura similar)
├── packages/
│   └── telemetry/                 # Biblioteca compartilhada
│       ├── src/
│       │   ├── index.ts           # Exports públicos
│       │   ├── telemetryClient.ts # Lógica principal
│       │   ├── localQueue.ts      # IndexedDB via Dexie
│       │   ├── retryWorker.ts     # Timer de reenvio
│       │   └── types.ts           # Interfaces
│       ├── package.json
│       └── vite.config.ts
├── services/
│   └── audit-api/                 # API .NET
│       ├── AuditApi/
│       │   ├── Program.cs
│       │   ├── Endpoints/
│       │   │   └── AuditEndpoints.cs
│       │   ├── Models/
│       │   │   └── AuditEvent.cs
│       │   └── Services/
│       │       └── AuditService.cs
│       └── AuditApi.Tests/
│           └── AuditEndpointTests.cs
├── docker-compose.yml             # Keycloak + MongoDB
└── README.md
```

---

## Decisões Adicionais (Questões Resolvidas)

| Questão | Decisão |
|---------|--------|
| Limite de fila IndexedDB | **1000 eventos** máximo, descarte FIFO dos mais antigos |
| Retenção de dados MongoDB | **90 dias** via TTL Index automático |
| Usuários de teste Keycloak | **3 usuários**: admin, user (joao.silva), auditor (maria.auditor) |

---

**Autor:** Tech Spec Generator  
**Data:** 2026-01-28  
**Versão:** 1.0
