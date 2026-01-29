namespace AuditApi.Models;

public record BatchAuditResponse
{
    public int Received { get; init; }

    public int Processed { get; init; }
}
