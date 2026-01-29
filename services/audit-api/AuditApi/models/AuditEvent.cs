using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AuditApi.Models;

public record AuditEvent
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; init; }

    [BsonElement("type")]
    public required string Type { get; init; }

    [BsonElement("screenId")]
    public required string ScreenId { get; init; }

    [BsonElement("timestamp")]
    public required DateTime Timestamp { get; init; }

    [BsonElement("userId")]
    public required string UserId { get; init; }

    [BsonElement("userEmail")]
    public string? UserEmail { get; init; }

    [BsonElement("userName")]
    public string? UserName { get; init; }

    [BsonElement("metadata")]
    public Dictionary<string, object>? Metadata { get; init; }

    [BsonElement("receivedAt")]
    public required DateTime ReceivedAt { get; init; }
}
