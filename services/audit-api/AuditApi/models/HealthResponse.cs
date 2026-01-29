namespace AuditApi.Models;

public record HealthResponse
{
    public string Status { get; init; } = "ok";

    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}
