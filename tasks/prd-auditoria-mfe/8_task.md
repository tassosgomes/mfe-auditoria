---
status: pending
parallelizable: true
blocked_by: ["3.0", "7.0"]
---

<task_context>
<domain>frontend/mfe</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>low</complexity>
<dependencies>react, telemetry</dependencies>
<unblocks>11.0</unblocks>
</task_context>

# Tarefa 8.0: Implementar MFE de Usuários (mfe-users)

## Visão Geral

Implementar o Micro Frontend de usuários que demonstra a integração com a biblioteca de telemetria. O MFE expõe telas de listagem e detalhe de usuários, registrando eventos de auditoria a cada acesso.

<requirements>
- RF04.1: Implementar rota `/users` (listagem) com chamada `logScreenAccess("users-list")`
- RF04.2: Implementar rota `/users/:id` (detalhe) com chamada `logScreenAccess("users-details", { userId })`
- RF04.3: Exigir autenticação via Keycloak para acesso às rotas
</requirements>

## Subtarefas

- [x] 8.1 Configurar projeto em `apps/mfe-users/`
- [x] 8.2 Configurar Module Federation para expor `./App`
- [x] 8.3 Criar estrutura de rotas internas:
  - `/` → Lista de usuários
  - `/:id` → Detalhe do usuário
- [x] 8.4 Criar página `src/pages/UsersList.tsx`:
  - Chamar `logScreenAccess("users-list")` no mount
  - Exibir lista mockada de usuários
  - Links para detalhe de cada usuário
- [x] 8.5 Criar página `src/pages/UserDetail.tsx`:
  - Chamar `logScreenAccess("users-details", { userId })` no mount
  - Exibir dados mockados do usuário
  - Link para voltar à lista
- [x] 8.6 Criar `src/App.tsx` com Routes internas
- [x] 8.7 Importar e usar biblioteca de telemetria
- [x] 8.8 Estilização básica
- [ ] 8.9 Testar integração com Host

## Detalhes de Implementação

### Dados Mockados

```typescript
// src/data/users.ts
export const mockUsers = [
  { id: '1', name: 'Alice Silva', email: 'alice@example.com', department: 'TI' },
  { id: '2', name: 'Bob Santos', email: 'bob@example.com', department: 'RH' },
  { id: '3', name: 'Carol Lima', email: 'carol@example.com', department: 'Financeiro' },
];
```

### UsersList (src/pages/UsersList.tsx)

```typescript
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logScreenAccess } from '@auditoria/telemetry';
import { mockUsers } from '../data/users';

export function UsersList() {
  useEffect(() => {
    logScreenAccess('users-list', { sourceMfe: 'mfe-users' });
  }, []);

  return (
    <div className="users-list">
      <h1>Usuários</h1>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Departamento</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {mockUsers.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.department}</td>
              <td>
                <Link to={`/${user.id}`}>Ver detalhes</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### UserDetail (src/pages/UserDetail.tsx)

```typescript
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { logScreenAccess } from '@auditoria/telemetry';
import { mockUsers } from '../data/users';

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const user = mockUsers.find(u => u.id === id);

  useEffect(() => {
    logScreenAccess('users-details', { 
      userId: id, 
      sourceMfe: 'mfe-users' 
    });
  }, [id]);

  if (!user) {
    return <div>Usuário não encontrado</div>;
  }

  return (
    <div className="user-detail">
      <h1>Detalhes do Usuário</h1>
      <dl>
        <dt>Nome</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Departamento</dt>
        <dd>{user.department}</dd>
      </dl>
      <Link to="/">← Voltar para lista</Link>
    </div>
  );
}
```

### App.tsx (Entry Point)

```typescript
import { Routes, Route } from 'react-router-dom';
import { UsersList } from './pages/UsersList';
import { UserDetail } from './pages/UserDetail';

export default function App() {
  return (
    <Routes>
      <Route index element={<UsersList />} />
      <Route path=":id" element={<UserDetail />} />
    </Routes>
  );
}
```

### Module Federation Config

```typescript
// vite.config.ts
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mfeUsers',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx'
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry']
    })
  ],
  server: {
    port: 5174
  },
  build: {
    target: 'esnext',
    minify: false
  }
});
```

## Critérios de Sucesso

- [ ] MFE inicia na porta 5174
- [ ] `remoteEntry.js` é gerado no build
- [ ] Host consegue carregar mfe-users via Module Federation
- [ ] Rota `/users` exibe lista de usuários
- [ ] Rota `/users/:id` exibe detalhe do usuário
- [ ] `logScreenAccess("users-list")` é chamado ao acessar lista
- [ ] `logScreenAccess("users-details", { userId })` é chamado ao acessar detalhe
- [ ] Navegação interna funciona (lista ↔ detalhe)
- [ ] Biblioteca de telemetria é carregada como shared module
