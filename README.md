# POC Auditoria MFE

## Pré-requisitos

- Docker e Docker Compose

## Subir o ambiente (Keycloak + MongoDB)

```bash
docker compose up -d
```

Para parar e remover volumes:

```bash
docker compose down -v
```

## Serviços

- Keycloak: http://localhost:8080
- MongoDB: localhost:27017

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

## Arquivos de infraestrutura

- docker-compose.yml
- docker/keycloak/realm-export.json
