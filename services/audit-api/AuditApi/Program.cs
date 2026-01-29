using AuditApi.Configuration;
using AuditApi.Endpoints;
using AuditApi.Infrastructure;
using AuditApi.Models;
using AuditApi.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using OpenTelemetry.Logs;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

var serviceName = builder.Configuration["ServiceName"] ?? "audit-api";
var serviceVersion = builder.Configuration["ServiceVersion"] ?? "1.0.0";
var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://otel-collector:4317";

builder.Services.AddOpenTelemetry()
	.ConfigureResource(resource => resource.AddService(
		serviceName: serviceName,
		serviceVersion: serviceVersion,
		serviceInstanceId: Environment.MachineName))
	.WithTracing(tracing => tracing
		.AddAspNetCoreInstrumentation(options =>
		{
			options.RecordException = true;
			options.Filter = context =>
				!context.Request.Path.StartsWithSegments("/audit/v1/health");
		})
		.AddHttpClientInstrumentation(options =>
		{
			options.RecordException = true;
			options.FilterHttpRequestMessage = message =>
				message.RequestUri?.Host.Contains("otel-collector") != true;
		})
		.AddOtlpExporter(options =>
		{
			options.Endpoint = new Uri(otlpEndpoint);
			options.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
		}));

builder.Logging.ClearProviders();
builder.Logging.AddOpenTelemetry(options =>
{
	options.SetResourceBuilder(ResourceBuilder.CreateDefault()
		.AddService(
			serviceName: serviceName,
			serviceVersion: serviceVersion,
			serviceInstanceId: Environment.MachineName));

	options.AddOtlpExporter(otlpOptions =>
	{
		otlpOptions.Endpoint = new Uri(otlpEndpoint);
		otlpOptions.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
	});

	options.IncludeFormattedMessage = true;
	options.IncludeScopes = true;
	options.ParseStateValues = true;
});

if (builder.Environment.IsDevelopment())
{
	builder.Logging.AddConsole();
}

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
	options.AddPolicy(CorsPolicies.MfeOrigins, policy =>
	{
		policy.WithOrigins(
				"http://localhost:5173",
				"http://localhost:5174",
				"http://localhost:5175")
			.AllowAnyHeader()
			.AllowAnyMethod();
	});
});

builder.Services.Configure<MongoOptions>(builder.Configuration.GetSection(MongoOptions.SectionName));
builder.Services.AddSingleton<IMongoClient>(sp =>
{
	var options = sp.GetRequiredService<IOptions<MongoOptions>>().Value;
	return new MongoClient(options.ConnectionString);
});
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
	var options = sp.GetRequiredService<IOptions<MongoOptions>>().Value;
	return sp.GetRequiredService<IMongoClient>().GetDatabase(options.DatabaseName);
});
builder.Services.AddSingleton<IMongoCollection<AuditEvent>>(sp =>
{
	var options = sp.GetRequiredService<IOptions<MongoOptions>>().Value;
	return sp.GetRequiredService<IMongoDatabase>().GetCollection<AuditEvent>(options.CollectionName);
});
builder.Services.AddHostedService<MongoIndexInitializer>();

builder.Services.AddScoped<AuditService>();
builder.Services.AddHealthChecks().AddCheck<MongoHealthCheck>("mongodb");

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(CorsPolicies.MfeOrigins);

if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI();
}

app.MapAuditEndpoints();
app.MapHealthEndpoint();

app.Run();
