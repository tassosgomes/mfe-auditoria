---
status: pending
parallelizable: true
blocked_by: []
---

<task_context>
<domain>infra/devops</domain>
<type>configuration</type>
<scope>configuration</scope>
<complexity>medium</complexity>
<dependencies>docker</dependencies>
<unblocks>6.0, 7.0</unblocks>
</task_context>

# Tarefa 1.0: Configurar ambiente Docker (Keycloak + MongoDB)

## Visão Geral

Configurar o ambiente de infraestrutura local utilizando Docker Compose para executar Keycloak (autenticação) e MongoDB (persistência de eventos de auditoria). Esta tarefa é fundamental para permitir o desenvolvimento das demais funcionalidades.

<requirements>
- RF09: Integração com Keycloak
- Keycloak 24+ em container Docker
- MongoDB 7+ em container Docker
- Usuários de teste configurados
</requirements>

## Subtarefas

- [ ] 1.1 Criar arquivo `docker-compose.yml` na raiz do projeto
- [ ] 1.2 Configurar serviço Keycloak (porta 8080)
- [ ] 1.3 Configurar serviço MongoDB (porta 27017)
- [ ] 1.4 Criar realm `auditoria-poc` no Keycloak
- [ ] 1.5 Criar client `mfe-host` com fluxo Authorization Code + PKCE
- [ ] 1.6 Criar usuários de teste:
  - `admin` (admin@auditoria-poc.local, senha: admin123, role: admin)
  - `joao.silva` (joao.silva@auditoria-poc.local, senha: user123, role: user)
  - `maria.auditor` (maria.auditor@auditoria-poc.local, senha: auditor123, role: auditor)
- [ ] 1.7 Configurar roles: admin, user, auditor
- [ ] 1.8 Exportar configuração do realm para arquivo JSON (para reprodutibilidade)
- [ ] 1.9 Documentar comandos de execução no README

## Detalhes de Implementação

### Configuração do Keycloak

```yaml
# Exemplo de configuração no docker-compose.yml
keycloak:
  image: quay.io/keycloak/keycloak:24.0
  environment:
    - KEYCLOAK_ADMIN=admin
    - KEYCLOAK_ADMIN_PASSWORD=admin
  ports:
    - "8080:8080"
  command: start-dev
```

### Claims requeridas no JWT

O token JWT deve conter:
- `sub` (userId)
- `email`
- `preferred_username`
- `name`

### Redirect URIs

Configurar no client `mfe-host`:
- `http://localhost:5173/*`

### Token Expiration

- Access Token: 5 minutos
- Refresh Token: 30 minutos

## Critérios de Sucesso

- [ ] `docker-compose up` inicia Keycloak e MongoDB sem erros
- [ ] Keycloak acessível em `http://localhost:8080`
- [ ] MongoDB acessível em `localhost:27017`
- [ ] Realm `auditoria-poc` existe e está configurado
- [ ] Client `mfe-host` permite login com PKCE
- [ ] Os 3 usuários de teste conseguem fazer login
- [ ] Token JWT contém as claims necessárias (sub, email, name)
