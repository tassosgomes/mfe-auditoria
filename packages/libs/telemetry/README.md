# @auditoria/telemetry

Biblioteca de telemetria compartilhada para auditoria de acessos em MFEs.

## Instalação

```bash
npm install
```

## Inicialização

```ts
import { initTelemetry } from "@auditoria/telemetry";

initTelemetry({
  apiBaseUrl: "http://localhost:5000",
  getKeycloakToken: () => {
    const token = /* recuperar token decodificado do Keycloak */ null;
    return token;
  },
});
```

## API Pública

### logScreenAccess
```ts
logScreenAccess("users-list", { sourceMfe: "mfe-users" });
```

### logNavigation
```ts
logNavigation("/", "/users");
```

### logApiIntent
```ts
logApiIntent("/users", { method: "GET" });
```

### logApiError
```ts
logApiError("/users", new Error("Timeout"), { method: "GET" });
```

### flushQueue
```ts
const result = await flushQueue();
```

### getQueueStatus
```ts
const status = await getQueueStatus();
```

## Eventos

Todos os eventos enviados incluem:
- `timestamp` ISO 8601
- `userId`, `userEmail`, `userName` extraídos do token
- `metadata` opcional para contexto adicional

## Observações

- A biblioteca tenta enviar imediatamente para a API.
- Em caso de falha, o evento é enfileirado localmente.
