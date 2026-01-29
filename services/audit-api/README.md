# Audit API (.NET 8)

API REST de auditoria para receber eventos em batch, persistir no MongoDB e expor health check e consulta paginada.

## Pré-requisitos

- .NET SDK 8
- MongoDB 7+ (via Docker Compose na raiz do repositório)

## Como executar

```bash
cd services/audit-api

dotnet run --project AuditApi/AuditApi.csproj
```

A API fica disponível em http://localhost:5000.

## Variáveis de ambiente

- `INSTABILITY_RATE` (default: 0.3) — percentual de falhas simuladas no endpoint de ingestão.
- `OTEL_EXPORTER_OTLP_ENDPOINT` (default: `http://otel-collector:4317`) — endpoint OTLP.

## Endpoints

### POST /audit/v1/events

Recebe um batch de eventos de auditoria.

**Request**

```json
{
  "events": [
    {
      "type": "SCREEN_ACCESS",
      "screenId": "users-list",
      "timestamp": "2026-01-28T22:15:00.000Z",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "userEmail": "joao.silva@example.com",
      "userName": "João Silva",
      "metadata": {
        "sourceMfe": "mfe-users",
        "path": "/users"
      }
    }
  ]
}
```

**Responses**

- `200 OK` com `received` e `processed`
- `400 Bad Request` com Problem Details (RFC 9457) para payload inválido
- `500 Internal Server Error` para falha simulada

### GET /audit/v1/events

Consulta paginada.

Query params:
- `_page` (default: 1)
- `_size` (default: 20)

**Response**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### GET /audit/v1/health

Retorna status da API (e do MongoDB via health checks).

**Response**

```json
{
  "status": "ok",
  "timestamp": "2026-01-28T22:15:00.000Z"
}
```

## MongoDB

Índices criados automaticamente no startup:

- `{ timestamp: -1 }`
- `{ userId: 1, timestamp: -1 }`
- `{ type: 1, timestamp: -1 }`
- TTL: `{ receivedAt: 1 }` com 90 dias
