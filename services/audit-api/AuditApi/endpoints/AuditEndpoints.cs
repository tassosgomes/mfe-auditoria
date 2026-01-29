using AuditApi.Models;
using AuditApi.Services;
using AuditApi.Validation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;

namespace AuditApi.Endpoints;

public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/audit/v1/events", async (
            BatchAuditRequest request,
            AuditService auditService,
            IConfiguration configuration,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var logger = loggerFactory.CreateLogger("AuditEndpoints");
            var instabilityRate = Math.Clamp(
                configuration.GetValue("INSTABILITY_RATE", 0.3),
                0.0,
                1.0);

            if (Random.Shared.NextDouble() < instabilityRate)
            {
                logger.LogWarning("Simulated API failure for instability test");
                return Results.Problem(
                    type: "https://auditoria-poc/probs/instability",
                    title: "Instability",
                    detail: "Instabilidade simulada",
                    statusCode: StatusCodes.Status500InternalServerError);
            }

            var validationErrors = AuditEventValidator.Validate(request.Events);
            if (validationErrors.Count > 0)
            {
                return Results.Problem(
                    type: "https://auditoria-poc/probs/validation-error",
                    title: "Validation Error",
                    detail: string.Join("; ", validationErrors),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var processed = await auditService.SaveEventsAsync(request.Events, cancellationToken);

            logger.LogInformation(
                "Audit events received: {Count}, processed: {Processed}",
                request.Events.Count,
                processed);

            return Results.Ok(new BatchAuditResponse
            {
                Received = request.Events.Count,
                Processed = processed
            });
        })
            .Produces<BatchAuditResponse>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        app.MapGet("/audit/v1/events", async (
            AuditService auditService,
            CancellationToken cancellationToken,
            int _page = 1,
            int _size = 20) =>
        {
            var response = await auditService.GetEventsAsync(_page, _size, cancellationToken);
            return Results.Ok(response);
        })
            .Produces<PagedResponse<AuditEvent>>(StatusCodes.Status200OK);
    }

    public static void MapHealthEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/audit/v1/health", async (
            HealthCheckService healthCheckService,
            CancellationToken cancellationToken) =>
        {
            var report = await healthCheckService.CheckHealthAsync(cancellationToken);
            var status = report.Status == HealthStatus.Healthy ? "ok" : "degraded";
            var statusCode = report.Status == HealthStatus.Healthy
                ? StatusCodes.Status200OK
                : StatusCodes.Status503ServiceUnavailable;

            var response = new HealthResponse
            {
                Status = status,
                Timestamp = DateTime.UtcNow
            };

            return Results.Json(response, statusCode: statusCode);
        })
            .Produces<HealthResponse>(StatusCodes.Status200OK)
            .Produces<HealthResponse>(StatusCodes.Status503ServiceUnavailable);
    }
}
