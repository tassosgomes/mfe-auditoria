---
status: pending
parallelizable: false
blocked_by: ["5.0", "6.0", "8.0", "9.0", "10.0"]
---

<task_context>
<domain>integration/testing</domain>
<type>testing</type>
<scope>integration</scope>
<complexity>high</complexity>
<dependencies>all-components</dependencies>
<unblocks></unblocks>
</task_context>

# Tarefa 11.0: Integração End-to-End e Testes

## Visão Geral

Realizar a integração completa de todos os componentes do sistema e validar os cenários de teste definidos no PRD e Especificação Técnica. Esta tarefa valida que todos os requisitos funcionais estão implementados corretamente e que o sistema funciona de forma coesa.

<requirements>
- Validar todos os requisitos funcionais (RF01 a RF09)
- Testar cenários de API online, offline e recuperação
- Validar persistência de eventos entre reloads
- Documentar processo de execução no README
</requirements>

## Subtarefas

### Integração

- [x] 11.1 Criar script de inicialização completa (`npm run start:all` ou similar)
- [ ] 11.2 Verificar que todos os serviços iniciam sem conflitos de porta:
  - Keycloak: 8080
  - MongoDB: 27017
  - API .NET: 5000
  - Host: 5173
  - mfe-users: 5174
  - mfe-orders: 5175
- [ ] 11.3 Testar carregamento dos MFEs via Module Federation
- [ ] 11.4 Testar compartilhamento da biblioteca de telemetria entre MFEs

### Cenários de Teste

- [ ] 11.5 **Cenário 1 - API Online (Envio Direto):**
  - Iniciar todos os serviços
  - Fazer login com usuário de teste
  - Navegar entre telas (users, orders)
  - Verificar eventos no MongoDB (`db.audit_events.find()`)
  - Verificar fila vazia no IndexedDB (DevTools > Application)
  
- [ ] 11.6 **Cenário 2 - API Offline (Enfileiramento):**
  - Parar API .NET (`docker-compose stop api` ou Ctrl+C)
  - Navegar entre telas
  - Verificar eventos no IndexedDB (DevTools > Application)
  - Verificar painel mostra "Offline" e contador de pendentes incrementa
  
- [ ] 11.7 **Cenário 3 - Recuperação (Reenvio):**
  - Reiniciar API .NET
  - Aguardar worker (15-30 segundos)
  - Verificar fila esvaziando no painel
  - Verificar eventos chegaram no MongoDB
  
- [ ] 11.8 **Cenário 4 - Persistência (Reload):**
  - Com API offline, navegar por várias telas
  - Dar F5 (reload) na página
  - Verificar eventos ainda estão na fila (IndexedDB)
  - Reiniciar API e verificar reenvio

- [ ] 11.9 **Cenário 5 - Backoff Exponencial:**
  - Manter API offline
  - Observar logs do console para verificar intervalos crescentes
  - Verificar circuit breaker ativa após 5 falhas

- [ ] 11.10 **Cenário 6 - Flush Manual:**
  - Acumular eventos pendentes (API offline)
  - Ligar API
  - Clicar "Forçar Reenvio" no painel
  - Verificar envio imediato sem aguardar timer

### Validação de Requisitos

- [ ] 11.11 Validar RF01: Biblioteca de Telemetria
  - `logScreenAccess` funciona ✓
  - `logNavigation` funciona ✓
  - `logApiIntent` funciona ✓
  - `logApiError` funciona ✓
  - Dados do token Keycloak capturados ✓
  - Timestamp ISO 8601 presente ✓

- [ ] 11.12 Validar RF02: Fila Local
  - Eventos enfileirados quando API falha ✓
  - Persistência entre reloads ✓
  - Limite de 1000 eventos respeitado ✓

- [ ] 11.13 Validar RF03: Worker de Reenvio
  - Execução a cada 15s ✓
  - Backoff exponencial ✓
  - Circuit breaker ✓

- [ ] 11.14 Validar RF04/RF05: MFEs
  - Rotas funcionando ✓
  - Eventos de acesso registrados ✓

- [ ] 11.15 Validar RF06: Host
  - Module Federation funcionando ✓
  - Keycloak integrado ✓
  - Navegação funcionando ✓

- [ ] 11.16 Validar RF07: Painel de Auditoria
  - Status da API exibido ✓
  - Contadores corretos ✓
  - Botão de flush funciona ✓

- [ ] 11.17 Validar RF08: API REST
  - POST /audit/v1/events funciona ✓
  - GET /audit/v1/health funciona ✓
  - Instabilidade simulada (~30%) ✓
  - Validação de payload ✓

- [ ] 11.18 Validar RF09: Keycloak
  - Login funciona ✓
  - Token contém claims necessárias ✓
  - Logout funciona ✓

### Documentação

- [x] 11.19 Criar/Atualizar README.md principal com:
  - Visão geral da arquitetura
  - Pré-requisitos (Node.js, .NET, Docker)
  - Comandos de instalação
  - Comandos de execução
  - Credenciais de teste
  - Estrutura de pastas
  
- [x] 11.20 Documentar troubleshooting comum:
  - Portas em uso
  - Keycloak não inicia
  - MFE não carrega
  - CORS errors

## Detalhes de Implementação

### Script de Inicialização

```json
// package.json (raiz)
{
  "scripts": {
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "dev:api": "cd services/audit-api/AuditApi && dotnet run",
    "dev:host": "cd apps/host && npm run dev",
    "dev:users": "cd apps/mfe-users && npm run dev",
    "dev:orders": "cd apps/mfe-orders && npm run dev",
    "dev:all": "npm-run-all --parallel docker:up dev:api dev:host dev:users dev:orders"
  }
}
```

### Verificação de Eventos no MongoDB

```bash
# Conectar ao MongoDB
docker exec -it mongodb mongosh

# No shell do MongoDB
use auditoria
db.audit_events.find().sort({ timestamp: -1 }).limit(10).pretty()
```

### Verificação do IndexedDB

1. Abrir DevTools (F12)
2. Ir para Application > Storage > IndexedDB
3. Expandir "AuditQueueDB"
4. Verificar tabela "pendingEvents"

## Critérios de Sucesso

- [ ] Todos os serviços iniciam sem erros
- [ ] Login com Keycloak funciona
- [ ] Navegação entre MFEs funciona
- [ ] Cenário 1 (API online) passa
- [ ] Cenário 2 (API offline) passa
- [ ] Cenário 3 (Recuperação) passa
- [ ] Cenário 4 (Persistência) passa
- [ ] Cenário 5 (Backoff) passa
- [ ] Cenário 6 (Flush manual) passa
- [ ] Todos os requisitos funcionais validados
- [ ] README atualizado com instruções completas
- [ ] Troubleshooting documentado
