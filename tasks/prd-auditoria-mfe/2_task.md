---
status: pending
parallelizable: true
blocked_by: []
---

<task_context>
<domain>infra/frontend</domain>
<type>configuration</type>
<scope>configuration</scope>
<complexity>medium</complexity>
<dependencies>npm, vite</dependencies>
<unblocks>3.0, 7.0, 8.0, 9.0</unblocks>
</task_context>

# Tarefa 2.0: Configurar estrutura do monorepo e Module Federation

## Visão Geral

Configurar a estrutura de pastas do monorepo e a configuração base do Module Federation para permitir o compartilhamento da biblioteca de telemetria entre os MFEs. Esta tarefa estabelece a fundação para todo o desenvolvimento frontend.

<requirements>
- React 18+ com Vite
- @originjs/vite-plugin-federation para Module Federation
- Estrutura de monorepo com apps/ e packages/
</requirements>

## Subtarefas

- [ ] 2.1 Criar estrutura de pastas conforme especificação:
  ```
  mfe-auditoria/
  ├── apps/
  │   ├── host/
  │   ├── mfe-users/
  │   └── mfe-orders/
  ├── packages/
  │   └── telemetry/
  └── services/
      └── audit-api/
  ```
- [ ] 2.2 Inicializar `package.json` raiz com workspaces (npm/yarn/pnpm)
- [ ] 2.3 Criar projeto Vite base para `apps/host` (porta 5173)
- [ ] 2.4 Criar projeto Vite base para `apps/mfe-users` (porta 5174)
- [ ] 2.5 Criar projeto Vite base para `apps/mfe-orders` (porta 5175)
- [ ] 2.6 Criar projeto TypeScript para `packages/telemetry`
- [ ] 2.7 Configurar Module Federation no Host (vite.config.ts)
- [ ] 2.8 Configurar Module Federation nos Remotes (mfe-users, mfe-orders)
- [ ] 2.9 Configurar shared dependencies: react, react-dom, react-router-dom, @auditoria/telemetry
- [ ] 2.10 Criar scripts de desenvolvimento (`dev`, `build`, `preview`) no package.json raiz
- [ ] 2.11 Testar carregamento básico de um remote no host

## Detalhes de Implementação

### Configuração Host (apps/host/vite.config.ts)

```typescript
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'host',
      remotes: {
        mfeUsers: 'http://localhost:5174/assets/remoteEntry.js',
        mfeOrders: 'http://localhost:5175/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry']
    })
  ],
  server: {
    port: 5173
  }
});
```

### Configuração Remote (apps/mfe-users/vite.config.ts)

```typescript
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

### Package.json raiz (workspaces)

```json
{
  "name": "mfe-auditoria",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

## Critérios de Sucesso

- [ ] Estrutura de pastas criada conforme especificação
- [ ] Workspaces configurados e funcionando
- [ ] `npm install` na raiz instala todas as dependências
- [ ] Host inicia na porta 5173
- [ ] mfe-users inicia na porta 5174 e gera `remoteEntry.js`
- [ ] mfe-orders inicia na porta 5175 e gera `remoteEntry.js`
- [ ] Host consegue carregar um componente básico do mfe-users via Module Federation
- [ ] Biblioteca telemetry é reconhecida como shared dependency
