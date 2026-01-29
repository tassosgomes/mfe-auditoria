import { describe, expect, it, vi } from "vitest";

const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const createToken = () => ({
  sub: "user-1",
  email: "user@example.com",
  name: "User Test",
});

describe("telemetryClient", () => {
  it("exporta API pública no índice", async () => {
    vi.resetModules();
    const index = await import("./index");

    expect(index.initTelemetry).toBeTypeOf("function");
    expect(index.logScreenAccess).toBeTypeOf("function");
  });

  it("exige apiBaseUrl na inicialização", async () => {
    vi.resetModules();
    const client = await import("./telemetryClient");

    expect(() =>
      client.initTelemetry({ apiBaseUrl: "" as string })
    ).toThrow();
  });

  it("envia evento de tela com sucesso", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: createToken,
    });

    client.logScreenAccess("users-list");
    await waitForAsync();

    const status = await client.getQueueStatus();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(status.pendingCount).toBe(0);
  });

  it("enfileira evento quando a API falha", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: createToken,
    });

    client.logScreenAccess("users-details");
    await waitForAsync();

    const status = await client.getQueueStatus();
    expect(status.pendingCount).toBe(1);
  });

  it("ignora envio quando token não está disponível", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: () => null,
    });

    client.logScreenAccess("users-list");
    await waitForAsync();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("registra navegação com metadata e screenId destino", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: createToken,
    });

    client.logNavigation("/from", "/to");
    await waitForAsync();

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.events[0].type).toBe("NAVIGATION");
    expect(body.events[0].screenId).toBe("/to");
    expect(body.events[0].metadata).toEqual({ from: "/from", to: "/to" });
  });

  it("inclui detalhes do erro em logApiError", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: createToken,
    });

    client.logApiError("/users", new Error("boom"), { method: "GET" });
    await waitForAsync();

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.events[0].type).toBe("API_ERROR");
    expect(body.events[0].metadata.error.message).toBe("boom");
    expect(body.events[0].metadata.method).toBe("GET");
  });

  it("reenvia eventos pendentes com flushQueue", async () => {
    vi.resetModules();
    let eventsCallCount = 0;
    const mockFetch = vi.fn((input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/audit/v1/health")) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      if (url.endsWith("/audit/v1/events")) {
        if (eventsCallCount === 0) {
          eventsCallCount += 1;
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = await import("./telemetryClient");
    client.initTelemetry({
      apiBaseUrl: "http://localhost:8080",
      getKeycloakToken: createToken,
    });

    client.logScreenAccess("orders-list");
    await waitForAsync();

    const flushResult = await client.flushQueue();
    const status = await client.getQueueStatus();

    expect(flushResult.sent).toBe(1);
    expect(flushResult.failed).toBe(0);
    expect(status.pendingCount).toBe(0);
  });

  it("retorna zeros quando flushQueue é chamado sem init", async () => {
    vi.resetModules();
    const client = await import("./telemetryClient");

    const result = await client.flushQueue();

    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
  });
});
