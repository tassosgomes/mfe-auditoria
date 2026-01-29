# POC Auditoria MFE

## Visão geral da arquitetura

- Host (Shell) orquestra os MFEs e exibe o painel de auditoria.
- MFEs (mfe-users e mfe-orders) registram acessos via biblioteca compartilhada.
- Biblioteca de telemetria (packages/libs/telemetry) enfileira eventos no IndexedDB e reenvia em backoff.
- API .NET recebe eventos e persiste no MongoDB.
- Keycloak fornece autenticação e dados do token.

## Pré-requisitos

- Node.js + npm
- .NET SDK 8
- Docker + Docker Compose

## Instalação

```bash
npm install
```

## Executar o ambiente completo

```bash
npm run start:all
```

Para subir apenas a infraestrutura:

```bash
npm run docker:up
```

Para parar tudo:

```bash
npm run docker:down
```

## Serviços e portas

- Keycloak: http://localhost:8080
- MongoDB: localhost:27017
- API .NET: http://localhost:5000
- Host: http://localhost:5173
- mfe-users: http://localhost:5174
- mfe-orders: http://localhost:5175

## Keycloak (realm auditoria-poc)

### Admin Console

- Usuário admin (Keycloak): `admin`
- Senha: `admin`

### Client

- Client ID: `mfe-host`
- Fluxo: Authorization Code + PKCE (S256)
- Redirect URI: `http://localhost:5173/*`
- Web Origin: `http://localhost:5173`

### Usuários de teste

- `admin` / `admin123` (role: admin)
- `joao.silva` / `user123` (role: user)
- `maria.auditor` / `auditor123` (role: auditor)

### Roles

- admin
- user
- auditor

### Claims esperadas no JWT

O token contém as claims exigidas (sub, email, preferred_username, name) via mapeadores configurados no realm.

### Expiração de tokens

- Access Token: 5 minutos
- Refresh Token: 30 minutos (SSO session idle)

## Cenários de validação (E2E)

### 1) API Online (Envio direto)

1. Inicie todos os serviços com `npm run start:all`.
2. Faça login com um usuário de teste.
3. Navegue entre telas de users e orders.
4. Verifique eventos no MongoDB:

```bash
docker exec -it mongodb mongosh
```

```javascript
use auditoria
db.audit_events.find().sort({ timestamp: -1 }).limit(10).pretty()
```

5. Verifique fila vazia no IndexedDB (DevTools > Application > IndexedDB > AuditQueueDB).

### 2) API Offline (Enfileiramento)

1. Pare a API (.NET) com `docker compose stop api` ou Ctrl+C.
2. Navegue entre telas.
3. Verifique eventos no IndexedDB e painel de auditoria com status Offline.

### 3) Recuperação (Reenvio)

1. Reinicie a API.
2. Aguarde 15-30 segundos.
3. Verifique a fila esvaziando e eventos no MongoDB.

### 4) Persistência (Reload)

1. Com API offline, navegue por várias telas.
2. Recarregue a página.
3. Verifique eventos persistidos no IndexedDB.
4. Reinicie a API e confirme o reenvio.

### 5) Backoff Exponencial e Circuit Breaker

1. Mantenha a API offline.
2. Observe logs no console do navegador.
3. Confirme intervalos crescentes e pausa após 5 falhas.

### 6) Flush Manual

1. Com API offline, acumule eventos.
2. Ligue a API.
3. Clique em "Forçar Reenvio" no painel.
4. Verifique envio imediato.

## Estrutura de pastas

```
apps/              # Host e MFEs
	host/
	mfe-users/
	mfe-orders/
packages/libs/     # Biblioteca de telemetria compartilhada
services/          # API .NET
docker/            # Keycloak e infraestrutura
tasks/             # PRD, specs e tarefas
```

## Troubleshooting

### Portas em uso

```bash
lsof -i :5173
```

Libere a porta ou ajuste a configuração antes de subir o ambiente.

### Keycloak não inicia

- Verifique logs com `docker compose logs keycloak`.
- Remova volumes antigos: `docker compose down -v`.

### MFE não carrega no Host

- Confirme que os MFEs estão rodando nas portas 5174 e 5175.
- Verifique o arquivo de remotes no Host e erros no console.

### CORS errors

- Confirme que a API permite as origens dos MFEs.
- Reinicie a API após ajustar configurações de CORS.

## Arquivos de infraestrutura

- docker-compose.yml
- docker/keycloak/realm-export.json
