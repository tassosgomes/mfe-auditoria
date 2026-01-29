using System.Text.Json;
using AuditApi.Models;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace AuditApi.Services;

public class AuditService
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly IMongoCollection<AuditEvent> _collection;
    private readonly ILogger<AuditService> _logger;

    public AuditService(IMongoCollection<AuditEvent> collection, ILogger<AuditService> logger)
    {
        _collection = collection;
        _logger = logger;
    }

    public async Task<int> SaveEventsAsync(IEnumerable<AuditEventRequest> events, CancellationToken cancellationToken = default)
    {
        var eventList = events.ToList();
        if (eventList.Count == 0)
        {
            return 0;
        }

        var receivedAt = DateTime.UtcNow;
        var auditEvents = eventList.Select(request => new AuditEvent
        {
            Type = request.Type,
            ScreenId = request.ScreenId,
            Timestamp = request.Timestamp,
            UserId = request.UserId,
            UserEmail = request.UserEmail,
            UserName = request.UserName,
            Metadata = ConvertMetadata(request.Metadata),
            ReceivedAt = receivedAt
        }).ToList();

        await _collection.InsertManyAsync(auditEvents, cancellationToken: cancellationToken);

        _logger.LogInformation("Persisted {Count} audit events", auditEvents.Count);

        return auditEvents.Count;
    }

    private static Dictionary<string, object>? ConvertMetadata(Dictionary<string, JsonElement>? metadata)
    {
        if (metadata == null) return null;

        return metadata.ToDictionary(
            kvp => kvp.Key,
            kvp => ConvertJsonElement(kvp.Value)
        );
    }

    private static object ConvertJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString()!,
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Array => element.EnumerateArray().Select(ConvertJsonElement).ToList(),
            JsonValueKind.Object => element.EnumerateObject().ToDictionary(p => p.Name, p => ConvertJsonElement(p.Value)),
            _ => element.ToString()
        };
    }

    public async Task<PagedResponse<AuditEvent>> GetEventsAsync(int page, int size, CancellationToken cancellationToken = default)
    {
        var normalizedPage = Math.Max(page, 1);
        var normalizedSize = size <= 0 ? DefaultPageSize : Math.Min(size, MaxPageSize);
        var skip = (normalizedPage - 1) * normalizedSize;

        var total = await _collection.CountDocumentsAsync(
            FilterDefinition<AuditEvent>.Empty,
            cancellationToken: cancellationToken);

        var auditEvents = await _collection
            .Find(FilterDefinition<AuditEvent>.Empty)
            .SortByDescending(auditEvent => auditEvent.Timestamp)
            .Skip(skip)
            .Limit(normalizedSize)
            .ToListAsync(cancellationToken);

        var totalPages = total == 0
            ? 0
            : (int)Math.Ceiling(total / (double)normalizedSize);

        return new PagedResponse<AuditEvent>
        {
            Data = auditEvents,
            Pagination = new PaginationMetadata
            {
                Page = normalizedPage,
                Size = normalizedSize,
                Total = total,
                TotalPages = totalPages
            }
        };
    }
}
