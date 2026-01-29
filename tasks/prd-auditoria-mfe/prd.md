# PRD: POC de Auditoria em Micro Frontends com Module Federation

## Visão Geral

Esta POC (Proof of Concept) visa validar uma arquitetura de auditoria de acesso a telas em aplicações Micro Frontend (MFE), utilizando Module Federation para compartilhamento de uma biblioteca de telemetria e uma API REST de auditoria em .NET com mecanismo de fallback resiliente (fila local + reenvio assíncrono).

**Problema a Resolver:**  
Organizações precisam auditar o acesso dos usuários às telas de sistemas distribuídos em MFEs de forma centralizada, confiável e sem perda de eventos, mesmo quando a API de auditoria estiver temporariamente indisponível.

**Proposta de Valor:**  
- Desacoplamento: MFEs não conhecem detalhes da API de auditoria
- Padronização: Todos os MFEs usam a mesma biblioteca compartilhada
- Resiliência: Eventos são preservados localmente e reenviados quando a API se recupera
- Rastreabilidade: Informações do usuário autenticado (Keycloak) são capturadas automaticamente

## Objetivos

| Objetivo | Métrica de Sucesso |
|----------|-------------------|
| Validar arquitetura Module Federation com biblioteca compartilhada | MFEs carregam e usam a biblioteca de telemetria sem duplicação de código |
| Garantir rastreabilidade de acessos | 100% dos acessos a telas geram eventos com `userId` extraído do token Keycloak |
| Validar resiliência com fila local | Eventos são preservados no IndexedDB quando API falha e reenviados após recuperação |
| Demonstrar integração com Keycloak | Autenticação funcional com 2-3 usuários de teste, dados do token presentes nos eventos |
| Visualizar status de auditoria | Painel no Host exibe eventos pendentes e status da API em tempo real |

## Histórias de Usuário

### Persona 1: Desenvolvedor de MFE
> Como desenvolvedor de um Micro Frontend, eu quero importar uma biblioteca de telemetria compartilhada e chamar funções simples para que os acessos às telas sejam auditados automaticamente, sem eu precisar conhecer os detalhes da API de auditoria.

### Persona 2: Usuário do Sistema
> Como usuário autenticado, eu quero que meus acessos às telas sejam registrados de forma transparente para que haja rastreabilidade das minhas ações no sistema.

### Persona 3: Auditor/Administrador
> Como auditor, eu quero visualizar um painel com o status dos eventos de auditoria (enviados/pendentes) para que eu possa monitorar a saúde do sistema de auditoria.

### Fluxos Principais

1. **Acesso a tela com API online**: Usuário navega → Evento enviado imediatamente → Confirmação de sucesso
2. **Acesso a tela com API offline**: Usuário navega → Tentativa falha → Evento salvo na fila local
3. **Reenvio automático**: Worker verifica fila → API recuperada → Eventos reenviados com sucesso
4. **Visualização de status**: Auditor acessa painel → Vê contagem de eventos pendentes e status da API

## Funcionalidades Principais

### RF01 - Biblioteca de Telemetria Compartilhada

**O que faz:** Módulo exposto via Module Federation que fornece funções para registro de eventos de auditoria.

**Por que é importante:** Centraliza a lógica de auditoria, evitando duplicação e garantindo padronização entre MFEs.

**Requisitos Funcionais:**
- RF01.1: Expor função `logScreenAccess(screenId: string, metadata?: object)` para registrar acesso a telas
- RF01.2: Expor função `logNavigation(from: string | null, to: string)` para registrar navegações
- RF01.3: Expor função `logApiIntent(endpoint: string, metadata?: object)` para registrar intenção de chamada API
- RF01.4: Expor função `logApiError(endpoint: string, error: unknown, metadata?: object)` para registrar erros de API
- RF01.5: Capturar automaticamente `userId`, `email` e `name` do token JWT do Keycloak
- RF01.6: Incluir `timestamp` ISO 8601 em todos os eventos
- RF01.7: Tentar envio imediato para API; em caso de falha, armazenar no IndexedDB
- RF01.8: Expor função `flushQueue()` para reenvio manual/programático de eventos pendentes

### RF02 - Fila Local com IndexedDB

**O que faz:** Armazena eventos de auditoria localmente quando a API está indisponível.

**Por que é importante:** Garante zero perda de eventos mesmo com instabilidade de rede ou API.

**Requisitos Funcionais:**
- RF02.1: Implementar operação `enqueue(event)` para salvar evento pendente
- RF02.2: Implementar operação `dequeueBatch(limit)` para ler lote de eventos para envio
- RF02.3: Implementar operação `deleteBatch(ids)` para remover eventos enviados com sucesso
- RF02.4: Implementar operação `count()` para retornar quantidade de eventos pendentes
- RF02.5: Persistir eventos entre reloads da página

### RF03 - Worker de Reenvio

**O que faz:** Processo em background que periodicamente tenta reenviar eventos pendentes.

**Por que é importante:** Automatiza a recuperação de eventos quando a API se torna disponível.

**Requisitos Funcionais:**
- RF03.1: Executar verificação de fila a cada 15 segundos
- RF03.2: Implementar backoff exponencial em caso de falhas consecutivas (15s → 30s → 60s → 120s)
- RF03.3: Implementar circuit breaker simples: após 5 falhas consecutivas, pausar por 2 minutos
- RF03.4: Processar eventos em lotes de até 50 itens por vez

### RF04 - Micro Frontend de Usuários (mfe-users)

**O que faz:** MFE de exemplo que demonstra integração com a biblioteca de telemetria.

**Requisitos Funcionais:**
- RF04.1: Implementar rota `/users` (listagem) com chamada `logScreenAccess("users-list")`
- RF04.2: Implementar rota `/users/:id` (detalhe) com chamada `logScreenAccess("users-details", { userId })`
- RF04.3: Exigir autenticação via Keycloak para acesso às rotas

### RF05 - Micro Frontend de Pedidos (mfe-orders)

**O que faz:** MFE de exemplo que demonstra integração com a biblioteca de telemetria.

**Requisitos Funcionais:**
- RF05.1: Implementar rota `/orders` (listagem) com chamada `logScreenAccess("orders-list")`
- RF05.2: Implementar rota `/orders/:id` (detalhe) com chamada `logScreenAccess("orders-details", { orderId })`
- RF05.3: Exigir autenticação via Keycloak para acesso às rotas

### RF06 - Host (Shell)

**O que faz:** Aplicação principal que orquestra os MFEs e exibe o painel de auditoria.

**Requisitos Funcionais:**
- RF06.1: Carregar mfe-users e mfe-orders via Module Federation
- RF06.2: Carregar biblioteca de telemetria como módulo compartilhado
- RF06.3: Exibir menu de navegação para os MFEs
- RF06.4: Integrar com Keycloak para autenticação centralizada
- RF06.5: Redirecionar usuários não autenticados para login do Keycloak

### RF07 - Painel de Auditoria

**O que faz:** Interface visual para monitoramento do status de auditoria.

**Requisitos Funcionais:**
- RF07.1: Exibir contador de eventos pendentes na fila local
- RF07.2: Exibir status da API de auditoria (Online/Offline)
- RF07.3: Exibir contador de eventos enviados com sucesso na sessão atual
- RF07.4: Atualizar informações automaticamente a cada 5 segundos
- RF07.5: Botão para forçar reenvio manual (`flushQueue`)

### RF08 - API REST de Auditoria (.NET)

**O que faz:** Backend que recebe e persiste eventos de auditoria em MongoDB.

**Requisitos Funcionais:**
- RF08.1: Implementar endpoint `POST /audit/v1/events` que recebe array de eventos
- RF08.2: Implementar endpoint `GET /audit/v1/health` que retorna status da API
- RF08.3: Persistir eventos recebidos no MongoDB
- RF08.4: Simular instabilidade: ~30% das requisições retornam erro 500 (configurável via variável de ambiente)
- RF08.5: Validar estrutura do evento (type, screenId, timestamp, userId são obrigatórios)
- RF08.6: Retornar 200 OK para eventos válidos, 400 Bad Request para inválidos
- RF08.7: Implementar endpoint `GET /audit/v1/events` para consulta de eventos (paginado)
- RF08.8: Garantir SLA de 99% de disponibilidade

### RF09 - Integração com Keycloak

**O que faz:** Provê autenticação e autorização para os MFEs.

**Requisitos Funcionais:**
- RF09.1: Configurar realm "auditoria-poc" no Keycloak
- RF09.2: Criar client "mfe-host" com fluxo Authorization Code + PKCE
- RF09.3: Criar 2-3 usuários de teste com diferentes perfis
- RF09.4: Token JWT deve conter claims: sub (userId), email, preferred_username, name
- RF09.5: Biblioteca de telemetria deve extrair dados do token decodificado (sem validação de assinatura no frontend)

## Experiência do Usuário

### Fluxo Principal de Navegação

1. Usuário acessa a aplicação Host
2. Se não autenticado, é redirecionado para tela de login do Keycloak
3. Após autenticação, retorna ao Host com token JWT
4. Usuário navega pelos MFEs (Users, Orders)
5. Cada acesso a tela dispara evento de auditoria automaticamente
6. Painel de status (canto inferior ou barra lateral) mostra contagem de eventos

### Interface do Painel de Auditoria

```
┌─────────────────────────────────────┐
│  📊 Status de Auditoria             │
├─────────────────────────────────────┤
│  API: 🟢 Online                     │
│  Eventos enviados: 15               │
│  Eventos pendentes: 0               │
│                                     │
│  [🔄 Forçar Reenvio]                │
└─────────────────────────────────────┘
```

### Considerações de UI/UX

- Design simples e funcional (sem design system específico)
- Painel de auditoria não deve obstruir a navegação principal
- Feedback visual quando evento é enfileirado (ícone de status muda)
- Cores semânticas: verde (online/sucesso), amarelo (pendente), vermelho (offline/erro)

## Restrições Técnicas de Alto Nível

| Categoria | Restrição |
|-----------|-----------|
| Frontend Framework | React 18+ com Vite |
| Module Federation | @originjs/vite-plugin-federation |
| Backend | .NET 8 (ASP.NET Core Minimal API) |
| Banco de Dados | MongoDB 7+ em container Docker |
| Autenticação | Keycloak 24+ em container Docker |
| Armazenamento Local | IndexedDB (via idb ou Dexie.js) |
| Protocolo | HTTPS em produção; HTTP permitido em desenvolvimento local |
| Browser Support | Navegadores modernos com suporte a IndexedDB e ES2020+ |
| SLA | 99% de disponibilidade da API de auditoria |

### Integrações

- **Keycloak**: OAuth 2.0 / OpenID Connect com fluxo Authorization Code + PKCE
- **API de Auditoria**: REST sobre HTTP/HTTPS

### Segurança

- Tokens JWT devem ter expiração curta (5-15 minutos) com refresh token
- API de auditoria deve validar origem das requisições (CORS)
- Dados sensíveis não devem ser incluídos nos eventos de auditoria

## Não-Objetivos (Fora de Escopo)

| Item | Justificativa |
|------|---------------|
| Funcionamento offline completo (Service Worker) | POC foca em resiliência com API instável, não offline-first |
| Limite de tamanho da fila IndexedDB | Será endereçado em versão futura |
| Descarte automático de eventos antigos | Será endereçado em versão futura |
| Dashboard analítico de auditoria | Fora do escopo da POC |
| Testes automatizados E2E | Nice-to-have, não obrigatório para POC |
| CI/CD | Fora do escopo da POC |
| Múltiplos realms/tenants no Keycloak | POC usa realm único |
| Suporte a múltiplos idiomas (i18n) | Não necessário para POC |
| Auditoria de ações além de acesso a telas | Escopo limitado a navegação entre telas |

## Estrutura de Evento de Auditoria

```json
{
  "type": "SCREEN_ACCESS",
  "screenId": "users-list",
  "timestamp": "2026-01-28T22:15:00.000Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userEmail": "joao.silva@example.com",
  "userName": "João Silva",
  "metadata": {
    "sourceMfe": "mfe-users",
    "path": "/users",
    "sessionId": "abc123"
  }
}
```

### Tipos de Evento Suportados

| Tipo | Descrição |
|------|-----------|
| `SCREEN_ACCESS` | Acesso a uma tela/rota |
| `NAVIGATION` | Navegação entre telas |
| `API_INTENT` | Intenção de chamada a API |
| `API_ERROR` | Erro em chamada de API |

## Questões em Aberto

*Todas as questões foram respondidas e incorporadas ao documento.*

| # | Questão | Decisão |
|---|---------|---------||
| 1 | Qual a estratégia de persistência de longo prazo dos eventos no backend? | ✅ MongoDB |
| 2 | Haverá necessidade de auditoria de ações além de acesso a telas? | ✅ Não, apenas acesso a telas |
| 3 | Qual o SLA esperado para a API de auditoria em produção? | ✅ 99% de disponibilidade |
| 4 | Será necessário suporte a múltiplos idiomas na POC? | ✅ Não |

---

**Autor:** Equipe de Arquitetura  
**Data:** 2026-01-28  
**Versão:** 1.0
