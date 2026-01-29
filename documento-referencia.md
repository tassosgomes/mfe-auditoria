# Documentação da POC de Auditoria em Micro Frontends com Module Federation

## Arquitetura

```text
+---------------------------------------------------------------+
|                           Browser                             |
|                        (User Session)                         |
+---------------------------+-----------------------------------+
                            |
                            v
+---------------------------------------------------------------+
|                 Biblioteca de Telemetria                      |
|        (Módulo Compartilhado via Module Federation)           |
|                                                               |
|  - logScreenAccess()   - logNavigation()                      |
|  - logApiIntent()      - logApiError()                        |
|                                                               |
|  +-------------------+      +------------------------------+  |
|  |  Fila Local       |      |  Worker de Reenvio          |   |
|  |  (IndexedDB)      |      |  (Timer / Web Worker)       |   |
|  |                   |      |                             |   |
|  |  - enqueue(event) | ---> |  - flushQueue()             |   |
|  |  - listPending()  |      |  - backoff exponencial      |   |
|  +-------------------+      |  - circuit breaker          |   |
|                             +------------------------------+  |
+---------------------------------------------------------------+
                            |
                            v
+---------------------------------------------------------------+
|                         API REST de Auditoria                 |
|                     /audit/events  /audit/health              |
+---------------------------------------------------------------+


+----------------------+       +----------------------+
|      MFE Users       |       |      MFE Orders      |
|  (Remote 1)          |       |  (Remote 2)          |
|                      |       |                      |
|  - Rotas próprias    |       |  - Rotas próprias    |
|  - Usa Telemetria    |       |  - Usa Telemetria    |
+----------+-----------+       +-----------+----------+
           \                             /
            \                           /
             v                         v
+---------------------------------------------------------------+
|                            Host                               |
|         (Shell que orquestra MFEs e carrega Telemetria)       |
|                                                               |
|  - Carrega remotes via Module Federation                      |
|  - Pode exibir painel de auditoria (eventos enviados/pending) |
+---------------------------------------------------------------+
```

## Visão geral

**Objetivo:**  
Validar uma arquitetura de auditoria de acesso a telas em uma aplicação com Micro Frontends (MFEs), usando Module Federation e uma API REST de auditoria com fallback resiliente (fila local + reenvio assíncrono).

**Pilares:**
*   **Desacoplamento:** MFEs não conhecem detalhes da API de auditoria.
*   **Padronização:** todos usam a mesma biblioteca de telemetria compartilhada.
*   **Resiliência:** se a API cair, eventos são armazenados localmente e reenviados depois.
*   **Independência de framework:** solução aplicável a React, Vue, Angular, etc.

## Componentes da arquitetura

### 1. Host (Shell)

**Responsabilidades:**
*   Carregar os MFEs via Module Federation.
*   Carregar a biblioteca de telemetria compartilhada.
*   *Opcional:* exibir um painel simples com:
    *   quantidade de eventos enviados;
    *   quantidade de eventos pendentes na fila;
    *   status da API de auditoria.

**Não faz:**
*   Não implementa lógica de auditoria específica de cada MFE.
*   Não conhece rotas internas dos MFEs (apenas o que eles expõem via contrato).

### 2. Micro Frontends (MFE Users e MFE Orders)

**Responsabilidades:**
*   Implementar suas telas e rotas.
*   Importar a biblioteca de telemetria compartilhada.
*   Disparar eventos de auditoria, por exemplo:
    *   `logScreenAccess("users-list", { userId })`
    *   `logScreenAccess("orders-details", { orderId })`
    *   `logApiIntent("/api/users")`
    *   `logApiError("/api/users", error)`

**Não fazem:**
*   Não implementam fila local.
*   Não implementam lógica de reenvio.
*   Não chamam diretamente a API de auditoria.

### 3. Biblioteca de Telemetria Compartilhada

Exposta como um remote ou shared module via Module Federation, por exemplo: `@org/telemetry`.

**Interface sugerida:**

```typescript
export function logScreenAccess(screenId: string, metadata?: Record<string, any>): void;
export function logNavigation(from: string | null, to: string): void;
export function logApiIntent(endpoint: string, metadata?: Record<string, any>): void;
export function logApiError(endpoint: string, error: unknown, metadata?: Record<string, any>): void;
export function flushQueue(): Promise<void>;
```

**Responsabilidades internas:**
*   Montar o payload de auditoria (`screenId`, `timestamp`, `userId` se disponível, etc.).
*   Tentar enviar o evento para a API REST de auditoria.
*   Em caso de falha:
    *   armazenar o evento na fila local (IndexedDB).
    *   Expor um mecanismo de reenvio (`flushQueue`) usado por um worker.

### 4. Fila local (IndexedDB)

**Por que IndexedDB:**
*   Persistência entre reloads.
*   Suporte a maior volume de eventos.
*   Não bloqueia a UI.

**Operações básicas:**
*   `enqueue(event)` — salva um evento pendente.
*   `dequeueBatch(limit)` — retorna um lote de eventos para envio.
*   `deleteBatch(ids)` — remove eventos enviados com sucesso.
*   `count()` — opcional, para exibir no painel do host.

### 5. Worker de reenvio (Timer / Web Worker / Service Worker)

**Responsabilidades:**
*   Rodar periodicamente (ex.: a cada 10–30 segundos).
*   Chamar `flushQueue()` na biblioteca de telemetria.
*   Aplicar:
    *   backoff exponencial quando a API estiver falhando;
    *   circuit breaker simples para evitar tentativas constantes.

**Fluxo simplificado de `flushQueue()`:**
*   Verifica se o circuito está “aberto” (muitas falhas recentes).
*   Se estiver fechado:
    *   lê um lote de eventos da fila (ex.: 50).
    *   tenta enviar para `POST /audit/events`.
    *   se sucesso: remove eventos da fila.
    *   se falha: registra falha, aumenta backoff, pode abrir o circuito.

### 6. API REST de auditoria

**Endpoints mínimos:**
*   `POST /audit/events`
    *   Recebe um array de eventos.
    *   Retorna 200 em caso de sucesso.
*   `GET /audit/health`
    *   Retorna status simples (ex.: `{ status: "ok" }`).

**Comportamento na POC:**
*   Simular instabilidade:
    *   em ~30% das requisições, responder com erro (500 ou timeout).
*   Permitir observar:
    *   eventos indo direto;
    *   eventos indo para a fila;
    *   reenvio posterior.

## Fluxos principais

### Fluxo 1: API online, evento enviado com sucesso

1.  Usuário acessa a tela `/users`.
2.  `mfe-users` chama:
    ```typescript
    logScreenAccess("users-list", { userId: "123" });
    ```
3.  Biblioteca de telemetria:
    *   monta o evento;
    *   chama `POST /audit/events`;
    *   recebe 200;
    *   não grava nada na fila.

### Fluxo 2: API offline, evento vai para a fila

1.  Usuário acessa `/orders/42`.
2.  `mfe-orders` chama:
    ```typescript
    logScreenAccess("orders-details", { orderId: "42" });
    ```
3.  Biblioteca de telemetria:
    *   tenta `POST /audit/events`;
    *   recebe erro (timeout/500);
    *   grava o evento na IndexedDB (`enqueue`).

### Fluxo 3: Reenvio de eventos pendentes

1.  Worker dispara `flushQueue()` a cada X segundos.
2.  `flushQueue()`:
    *   lê um lote de eventos pendentes;
    *   chama `POST /audit/events` com o lote;
    *   se sucesso: remove da fila;
    *   se falha: aplica backoff e registra falha.

### Fluxo 4: GET com auditoria (opcional)

Se você quiser auditar intenção de chamadas GET:

1.  Antes de chamar a API:
    ```typescript
    logApiIntent("/api/users");
    ```
2.  Se a chamada falhar:
    ```typescript
    logApiError("/api/users", error);
    ```
Ambos seguem o mesmo fluxo de fallback (fila + reenvio).

## Escopo detalhado da POC

### 1. MFE Users

**Rotas:**
*   `/users` (lista)
*   `/users/:id` (detalhe)

**Eventos:**
*   `logScreenAccess("users-list")` ao entrar em `/users`.
*   `logScreenAccess("users-details")` ao entrar em `/users/:id`.

### 2. MFE Orders

**Rotas:**
*   `/orders` (lista)
*   `/orders/:id` (detalhe)

**Eventos:**
*   `logScreenAccess("orders-list")` ao entrar em `/orders`.
*   `logScreenAccess("orders-details")` ao entrar em `/orders/:id`.

### 3. Biblioteca de telemetria

**Implementar:**
*   interface pública (funções de log).
*   integração com IndexedDB.
*   função `flushQueue()`.

### 4. Host

*   Carregar `mfe-users` e `mfe-orders`.
*   Exibir painel simples:
    *   Eventos pendentes: X
    *   Último status da API: OK / FALHA

### 5. API fake

*   Implementar `POST /audit/events` com chance de falha.
*   Logar no console os eventos recebidos.

### 6. Cenários de teste

1.  Navegar com API estável → fila vazia.
2.  Navegar com API instável → fila crescendo e depois esvaziando.
3.  Dar refresh durante falha → eventos continuam na fila.
4.  Voltar API → fila é drenada.

### Exemplo de assinatura de evento

```json
{
  "type": "SCREEN_ACCESS",
  "screenId": "users-list",
  "timestamp": "2026-01-28T22:15:00.000Z",
  "userId": "123",
  "metadata": {
    "sourceMfe": "mfe-users",
    "path": "/users"
  }
}
```
