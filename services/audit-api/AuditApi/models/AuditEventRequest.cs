using System.Text.Json;

namespace AuditApi.Models;

public record AuditEventRequest
{
    public required string Type { get; init; }

    public required string ScreenId { get; init; }

    public required DateTime Timestamp { get; init; }

    public required string UserId { get; init; }

    public string? UserEmail { get; init; }

    public string? UserName { get; init; }

    public Dictionary<string, JsonElement>? Metadata { get; init; }
}
