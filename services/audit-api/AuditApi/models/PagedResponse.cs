namespace AuditApi.Models;

public record PagedResponse<T>
{
    public required IReadOnlyList<T> Data { get; init; }

    public required PaginationMetadata Pagination { get; init; }
}

public record PaginationMetadata
{
    public required int Page { get; init; }

    public required int Size { get; init; }

    public required long Total { get; init; }

    public required int TotalPages { get; init; }
}
