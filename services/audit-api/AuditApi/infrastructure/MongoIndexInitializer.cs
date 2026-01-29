using AuditApi.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace AuditApi.Infrastructure;

public class MongoIndexInitializer : IHostedService
{
    private readonly IMongoCollection<AuditEvent> _collection;
    private readonly ILogger<MongoIndexInitializer> _logger;

    public MongoIndexInitializer(IMongoCollection<AuditEvent> collection, ILogger<MongoIndexInitializer> logger)
    {
        _collection = collection;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var indexModels = new List<CreateIndexModel<AuditEvent>>
        {
            new(Builders<AuditEvent>.IndexKeys.Descending(auditEvent => auditEvent.Timestamp)),
            new(Builders<AuditEvent>.IndexKeys
                .Ascending(auditEvent => auditEvent.UserId)
                .Descending(auditEvent => auditEvent.Timestamp)),
            new(Builders<AuditEvent>.IndexKeys
                .Ascending(auditEvent => auditEvent.Type)
                .Descending(auditEvent => auditEvent.Timestamp)),
            new(Builders<AuditEvent>.IndexKeys.Ascending(auditEvent => auditEvent.ReceivedAt),
                new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(90) })
        };

        await _collection.Indexes.CreateManyAsync(indexModels, cancellationToken);

        _logger.LogInformation("MongoDB indexes ensured for audit events collection");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
