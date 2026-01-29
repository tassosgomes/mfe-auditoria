---
status: completed
parallelizable: true
blocked_by: ["1.0"]
---

<task_context>
<domain>backend/api</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>dotnet8, mongodb, minimal-api</dependencies>
<unblocks>11.0</unblocks>
</task_context>

# Tarefa 6.0: Implementar API REST de Auditoria (.NET 8)

## Visão Geral

Implementar a API REST de auditoria em .NET 8 utilizando Minimal API. A API recebe eventos de auditoria em batch, persiste no MongoDB e expõe endpoints de health check e consulta. Para fins de teste de resiliência, ~30% das requisições devem simular falha.

<requirements>
- RF08.1: Endpoint `POST /audit/v1/events` que recebe array de eventos
- RF08.2: Endpoint `GET /audit/v1/health` que retorna status da API
- RF08.3: Persistir eventos recebidos no MongoDB
- RF08.4: Simular instabilidade: ~30% das requisições retornam erro 500
- RF08.5: Validar estrutura do evento (type, screenId, timestamp, userId obrigatórios)
- RF08.6: Retornar 200 OK para eventos válidos, 400 Bad Request para inválidos
- RF08.7: Endpoint `GET /audit/v1/events` para consulta paginada
- Seguir padrões `dotnet-coding-standards.md`, `dotnet-testing.md`, `restful.md`
</requirements>

## Subtarefas

- [x] 6.1 Criar projeto .NET 8 em `services/audit-api/AuditApi`
- [x] 6.2 Criar projeto de testes em `services/audit-api/AuditApi.Tests`
- [x] 6.3 Configurar MongoDB Driver (MongoDB.Driver)
- [x] 6.4 Criar modelos em `Models/`:
  - `AuditEventRequest` (record)
  - `BatchAuditRequest` (record)
  - `BatchAuditResponse` (record)
  - `AuditEvent` (documento MongoDB)
- [x] 6.5 Implementar `Services/AuditService.cs`:
  - Método `SaveEventsAsync(IEnumerable<AuditEventRequest>)`
  - Método `GetEventsAsync(int page, int size)`
- [x] 6.6 Implementar `Endpoints/AuditEndpoints.cs`:
  - `POST /audit/v1/events` - receber batch
  - `GET /audit/v1/events` - consultar paginado
  - `GET /audit/v1/health` - health check
- [x] 6.7 Implementar validação de eventos:
  - type, screenId, timestamp, userId são obrigatórios
  - Retornar RFC 9457 Problem Details em caso de erro
- [x] 6.8 Implementar simulação de instabilidade:
  - Variável de ambiente `INSTABILITY_RATE` (default: 0.3)
  - ~30% das requisições POST retornam 500
- [x] 6.9 Configurar CORS para origens dos MFEs:
  - `http://localhost:5173` (host)
  - `http://localhost:5174` (mfe-users)
  - `http://localhost:5175` (mfe-orders)
- [x] 6.10 Criar índices MongoDB:
  - `{ timestamp: -1 }`
  - `{ userId: 1, timestamp: -1 }`
  - `{ type: 1, timestamp: -1 }`
  - TTL index: `{ receivedAt: 1 }` com 90 dias
- [x] 6.11 Configurar health checks para MongoDB
- [x] 6.12 Implementar logs estruturados
- [x] 6.13 Escrever testes unitários com xUnit + AwesomeAssertions
- [x] 6.14 Documentar API no README do serviço

## Detalhes de Implementação

### Modelos (Records)

```csharp
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
```

### Endpoint POST /audit/v1/events

```csharp
app.MapPost("/audit/v1/events", async (
    BatchAuditRequest request,
    AuditService auditService,
    IConfiguration config,
    ILogger<Program> logger) =>
{
    // Simular instabilidade
    var instabilityRate = config.GetValue<double>("INSTABILITY_RATE", 0.3);
    if (Random.Shared.NextDouble() < instabilityRate)
    {
        logger.LogWarning("Simulando falha de API (instabilidade configurada)");
        return Results.Problem(
            detail: "Instabilidade simulada",
            statusCode: 500);
    }

    // Validar eventos
    var validationErrors = ValidateEvents(request.Events);
    if (validationErrors.Any())
    {
        return Results.Problem(
            type: "https://auditoria-poc/probs/validation-error",
            title: "Validation Error",
            detail: string.Join("; ", validationErrors),
            statusCode: 400);
    }

    var processed = await auditService.SaveEventsAsync(request.Events);
    
    logger.LogInformation("Eventos recebidos: {Count}, Processados: {Processed}",
        request.Events.Count, processed);

    return Results.Ok(new BatchAuditResponse
    {
        Received = request.Events.Count,
        Processed = processed
    });
});
```

### Configuração MongoDB

```csharp
// Program.cs
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("MongoDB")
        ?? "mongodb://localhost:27017";
    return new MongoClient(connectionString);
});

builder.Services.AddScoped<AuditService>();
```

### TTL Index para retenção de 90 dias

```csharp
// Criar índice TTL no startup
var collection = database.GetCollection<AuditEvent>("audit_events");
var indexKeys = Builders<AuditEvent>.IndexKeys.Ascending(e => e.ReceivedAt);
var indexOptions = new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(90) };
await collection.Indexes.CreateOneAsync(new CreateIndexModel<AuditEvent>(indexKeys, indexOptions));
```

## Critérios de Sucesso

- [x] Projeto .NET 8 compila sem erros
- [x] API inicia e responde em `http://localhost:5000`
- [x] `POST /audit/v1/events` aceita batch de eventos
- [x] `POST /audit/v1/events` retorna 400 para eventos inválidos (RFC 9457)
- [x] `POST /audit/v1/events` retorna 500 em ~30% das requisições (configurável)
- [x] `GET /audit/v1/health` retorna status OK
- [x] `GET /audit/v1/events` retorna eventos paginados
- [x] Eventos são persistidos no MongoDB
- [x] Índices criados corretamente
- [x] TTL de 90 dias configurado
- [x] CORS configurado para origens dos MFEs
- [x] Logs estruturados funcionando
- [x] Testes unitários passando

## Checklist de Conclusão

- [x] 6.0 Implementar API REST de Auditoria (.NET 8) ✅ CONCLUÍDA
  - [x] 6.1 Implementação completada
  - [x] 6.2 Definição da tarefa, PRD e tech spec validados
  - [x] 6.3 Análise de regras e conformidade verificadas
  - [x] 6.4 Revisão de código completada
  - [x] 6.5 Pronto para deploy
