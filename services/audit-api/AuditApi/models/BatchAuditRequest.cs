namespace AuditApi.Models;

public record BatchAuditRequest
{
    public required IReadOnlyList<AuditEventRequest> Events { get; init; }
}
