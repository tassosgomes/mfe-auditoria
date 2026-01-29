using AuditApi.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AuditApi.Infrastructure;

public class MongoHealthCheck : IHealthCheck
{
    private readonly IMongoClient _client;
    private readonly MongoOptions _options;

    public MongoHealthCheck(IMongoClient client, IOptions<MongoOptions> options)
    {
        _client = client;
        _options = options.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var database = _client.GetDatabase(_options.DatabaseName);
            await database.RunCommandAsync<BsonDocument>(
                new BsonDocument("ping", 1),
                cancellationToken: cancellationToken);

            return HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("MongoDB ping failed.", exception);
        }
    }
}
