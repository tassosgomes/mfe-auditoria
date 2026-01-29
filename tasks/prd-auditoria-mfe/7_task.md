---
status: pending
parallelizable: false
blocked_by: ["1.0", "2.0"]
---

<task_context>
<domain>frontend/host</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>react, vite, keycloak-js, module-federation</dependencies>
<unblocks>8.0, 9.0, 10.0</unblocks>
</task_context>

# Tarefa 7.0: Implementar Host (Shell) com integração Keycloak

## Visão Geral

Implementar a aplicação Host (Shell) que orquestra os Micro Frontends via Module Federation e gerencia a autenticação centralizada com Keycloak. O Host é responsável por carregar os remotes, fornecer navegação e inicializar a biblioteca de telemetria.

<requirements>
- RF06.1: Carregar mfe-users e mfe-orders via Module Federation
- RF06.2: Carregar biblioteca de telemetria como módulo compartilhado
- RF06.3: Exibir menu de navegação para os MFEs
- RF06.4: Integrar com Keycloak para autenticação centralizada
- RF06.5: Redirecionar usuários não autenticados para login do Keycloak
- RF09.5: Extrair dados do token para uso na telemetria
</requirements>

## Subtarefas

- [x] 7.1 Configurar projeto Host em `apps/host/`
- [x] 7.2 Instalar e configurar keycloak-js
- [x] 7.3 Criar `src/auth/keycloak.ts`:
  - Instância Keycloak configurada para realm `auditoria-poc`
  - Função `initKeycloak()` com PKCE
  - Função `getUserFromToken()` para extrair dados do JWT
  - Função `logout()`
- [x] 7.4 Criar `src/auth/AuthProvider.tsx`:
  - Context React para estado de autenticação
  - Proteção de rotas (redirecionar se não autenticado)
- [x] 7.5 Criar componente de navegação `src/components/Navigation.tsx`:
  - Links para: Home, Usuários (/users), Pedidos (/orders)
  - Exibir nome do usuário logado
  - Botão de logout
- [x] 7.6 Configurar React Router com rotas:
  - `/` - Home (dashboard simples)
  - `/users/*` - MFE Users
  - `/orders/*` - MFE Orders
- [x] 7.7 Implementar lazy loading dos MFEs:
  - Usar `React.lazy()` com Module Federation
  - Fallback com loading indicator
  - Error boundary para falhas de carregamento
- [x] 7.8 Inicializar biblioteca de telemetria no startup:
  - Chamar `initTelemetry()` após autenticação
  - Passar callback `getKeycloakToken` para extração de dados
- [x] 7.9 Criar página Home básica com:
  - Boas-vindas ao usuário
  - Links para os MFEs
- [x] 7.10 Estilização básica (CSS simples, sem framework)
- [ ] 7.11 Testar fluxo completo de autenticação

## Detalhes de Implementação

### Configuração Keycloak (src/auth/keycloak.ts)

```typescript
import Keycloak from 'keycloak-js';

export const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'auditoria-poc',
  clientId: 'mfe-host'
});

export async function initKeycloak(): Promise<boolean> {
  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });
    return authenticated;
  } catch (error) {
    console.error('Falha ao inicializar Keycloak:', error);
    return false;
  }
}

export function getUserFromToken(): { 
  userId: string; 
  email?: string; 
  name?: string 
} | null {
  if (!keycloak.tokenParsed) return null;
  return {
    userId: keycloak.tokenParsed.sub!,
    email: keycloak.tokenParsed.email,
    name: keycloak.tokenParsed.name
  };
}

export function logout(): void {
  keycloak.logout({ redirectUri: window.location.origin });
}
```

### AuthProvider (src/auth/AuthProvider.tsx)

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { keycloak, initKeycloak, getUserFromToken, logout } from './keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { userId: string; email?: string; name?: string } | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthContextType['user']>(null);

  useEffect(() => {
    initKeycloak().then((authenticated) => {
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setUser(getUserFromToken());
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Lazy Loading dos MFEs

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { Navigation } from './components/Navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';

const MfeUsers = lazy(() => import('mfeUsers/App'));
const MfeOrders = lazy(() => import('mfeOrders/App'));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/users/*" element={
              <ErrorBoundary fallback={<div>Erro ao carregar MFE Users</div>}>
                <Suspense fallback={<div>Carregando...</div>}>
                  <MfeUsers />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/orders/*" element={
              <ErrorBoundary fallback={<div>Erro ao carregar MFE Orders</div>}>
                <Suspense fallback={<div>Carregando...</div>}>
                  <MfeOrders />
                </Suspense>
              </ErrorBoundary>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### Inicialização da Telemetria

```typescript
// No AuthProvider, após autenticação bem-sucedida
import { initTelemetry } from '@auditoria/telemetry';
import { getUserFromToken } from './keycloak';

// Após setIsAuthenticated(true):
initTelemetry({
  apiBaseUrl: 'http://localhost:5000',
  getKeycloakToken: getUserFromToken
});
```

## Critérios de Sucesso

- [ ] Host inicia na porta 5173
- [ ] Usuário não autenticado é redirecionado para Keycloak
- [ ] Login com PKCE funciona corretamente
- [ ] Após login, usuário vê página Home
- [ ] Navegação entre MFEs funciona (links)
- [ ] MFEs são carregados via Module Federation
- [ ] Nome do usuário é exibido na navegação
- [ ] Logout funciona e redireciona para login
- [ ] Biblioteca de telemetria é inicializada após login
- [ ] Token expirado dispara refresh ou re-login
- [ ] Error boundary captura falhas de carregamento de MFEs---
status: completed
parallelizable: false
blocked_by: ["1.0", "2.0"]

<task_context>
<domain>frontend/host</domain>
## Tarefa 7.0: Implementar Host (Shell) com integração Keycloak
status: pending
<complexity>high</complexity>
<dependencies>react, vite, keycloak-js, module-federation</dependencies>
<unblocks>8.0, 9.0, 10.0</unblocks>
</task_context>

# Tarefa 7.0: Implementar Host (Shell) com integração Keycloak
Implementar a aplicação Host (Shell) que orquestra os Micro Frontends via Module Federation e gerencia a autenticação centralizada com Keycloak. O Host é responsável por carregar os remotes, fornecer navegação e inicializar a biblioteca de telemetria.

<requirements>
- RF06.1: Carregar mfe-users e mfe-orders via Module Federation
- RF06.3: Exibir menu de navegação para os MFEs
- RF06.4: Integrar com Keycloak para autenticação centralizada
- RF09.5: Extrair dados do token para uso na telemetria
</requirements>


- [x] 7.1 Configurar projeto Host em `apps/host/`
- [x] 7.2 Instalar e configurar keycloak-js
  - Instância Keycloak configurada para realm `auditoria-poc`
  - Função `initKeycloak()` com PKCE
  - Função `getUserFromToken()` para extrair dados do JWT
- [x] 7.4 Criar `src/auth/AuthProvider.tsx`:
  - Context React para estado de autenticação
- [x] 7.5 Criar componente de navegação `src/components/Navigation.tsx`:
  - Links para: Home, Usuários (/users), Pedidos (/orders)
- [x] 7.10 Estilização básica (CSS simples, sem framework)
- [ ] 7.11 Testar fluxo completo de autenticação
- [x] 7.6 Configurar React Router com rotas:
  - `/` - Home (dashboard simples)
  - Links para os MFEs
-- [x] 7.10 Estilização básica (CSS simples, sem framework)
-- [x] 7.11 Testar fluxo completo de autenticação

## Detalhes de Implementação

### Configuração Keycloak (src/auth/keycloak.ts)

```typescript
import Keycloak from 'keycloak-js';

export const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'auditoria-poc',
  clientId: 'mfe-host'
});

export async function initKeycloak(): Promise<boolean> {
  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });
    return authenticated;
  } catch (error) {
    console.error('Falha ao inicializar Keycloak:', error);
    return false;
  }
}

export function getUserFromToken(): { 
  userId: string; 
  email?: string; 
  name?: string 
} | null {
  if (!keycloak.tokenParsed) return null;
  return {
    userId: keycloak.tokenParsed.sub!,
    email: keycloak.tokenParsed.email,
    name: keycloak.tokenParsed.name
  };
}

export function logout(): void {
  keycloak.logout({ redirectUri: window.location.origin });
}
```

### AuthProvider (src/auth/AuthProvider.tsx)

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { keycloak, initKeycloak, getUserFromToken, logout } from './keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { userId: string; email?: string; name?: string } | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthContextType['user']>(null);

  useEffect(() => {
    initKeycloak().then((authenticated) => {
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setUser(getUserFromToken());
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Lazy Loading dos MFEs

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { Navigation } from './components/Navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';

const MfeUsers = lazy(() => import('mfeUsers/App'));
const MfeOrders = lazy(() => import('mfeOrders/App'));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/users/*" element={
              <ErrorBoundary fallback={<div>Erro ao carregar MFE Users</div>}>
                <Suspense fallback={<div>Carregando...</div>}>
                  <MfeUsers />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/orders/*" element={
              <ErrorBoundary fallback={<div>Erro ao carregar MFE Orders</div>}>
                <Suspense fallback={<div>Carregando...</div>}>
                  <MfeOrders />
                </Suspense>
              </ErrorBoundary>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### Inicialização da Telemetria

```typescript
// No AuthProvider, após autenticação bem-sucedida
import { initTelemetry } from '@auditoria/telemetry';
import { getUserFromToken } from './keycloak';

// Após setIsAuthenticated(true):
initTelemetry({
  apiBaseUrl: 'http://localhost:5000',
  getKeycloakToken: getUserFromToken
});
```

## Critérios de Sucesso

- [x] Host inicia na porta 5173
- [x] Usuário não autenticado é redirecionado para Keycloak
- [x] Login com PKCE funciona corretamente
- [x] Após login, usuário vê página Home
- [x] Navegação entre MFEs funciona (links)
- [x] MFEs são carregados via Module Federation
- [x] Nome do usuário é exibido na navegação
- [x] Logout funciona e redireciona para login
- [x] Biblioteca de telemetria é inicializada após login
- [x] Token expirado dispara refresh ou re-login
- [x] Error boundary captura falhas de carregamento de MFEs
