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

# Tarefa 9.0: Implementar MFE de Pedidos (mfe-orders)

## Visão Geral

Implementar o Micro Frontend de pedidos que demonstra a integração com a biblioteca de telemetria. O MFE expõe telas de listagem e detalhe de pedidos, registrando eventos de auditoria a cada acesso.

<requirements>
- RF05.1: Implementar rota `/orders` (listagem) com chamada `logScreenAccess("orders-list")`
- RF05.2: Implementar rota `/orders/:id` (detalhe) com chamada `logScreenAccess("orders-details", { orderId })`
- RF05.3: Exigir autenticação via Keycloak para acesso às rotas
</requirements>

## Subtarefas

- [ ] 9.1 Configurar projeto em `apps/mfe-orders/`
- [ ] 9.2 Configurar Module Federation para expor `./App`
- [ ] 9.3 Criar estrutura de rotas internas:
  - `/` → Lista de pedidos
  - `/:id` → Detalhe do pedido
- [ ] 9.4 Criar página `src/pages/OrdersList.tsx`:
  - Chamar `logScreenAccess("orders-list")` no mount
  - Exibir lista mockada de pedidos
  - Links para detalhe de cada pedido
- [ ] 9.5 Criar página `src/pages/OrderDetail.tsx`:
  - Chamar `logScreenAccess("orders-details", { orderId })` no mount
  - Exibir dados mockados do pedido
  - Link para voltar à lista
- [ ] 9.6 Criar `src/App.tsx` com Routes internas
- [ ] 9.7 Importar e usar biblioteca de telemetria
- [ ] 9.8 Estilização básica
- [ ] 9.9 Testar integração com Host

## Detalhes de Implementação

### Dados Mockados

```typescript
// src/data/orders.ts
export const mockOrders = [
  { 
    id: 'ORD-001', 
    customer: 'Alice Silva', 
    total: 199.90, 
    status: 'Entregue',
    date: '2026-01-25'
  },
  { 
    id: 'ORD-002', 
    customer: 'Bob Santos', 
    total: 459.00, 
    status: 'Em trânsito',
    date: '2026-01-27'
  },
  { 
    id: 'ORD-003', 
    customer: 'Carol Lima', 
    total: 89.90, 
    status: 'Processando',
    date: '2026-01-28'
  },
];
```

### OrdersList (src/pages/OrdersList.tsx)

```typescript
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logScreenAccess } from '@auditoria/telemetry';
import { mockOrders } from '../data/orders';

export function OrdersList() {
  useEffect(() => {
    logScreenAccess('orders-list', { sourceMfe: 'mfe-orders' });
  }, []);

  return (
    <div className="orders-list">
      <h1>Pedidos</h1>
      <table>
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Status</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {mockOrders.map(order => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer}</td>
              <td>R$ {order.total.toFixed(2)}</td>
              <td>{order.status}</td>
              <td>{order.date}</td>
              <td>
                <Link to={`/${order.id}`}>Ver detalhes</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### OrderDetail (src/pages/OrderDetail.tsx)

```typescript
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { logScreenAccess } from '@auditoria/telemetry';
import { mockOrders } from '../data/orders';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = mockOrders.find(o => o.id === id);

  useEffect(() => {
    logScreenAccess('orders-details', { 
      orderId: id, 
      sourceMfe: 'mfe-orders' 
    });
  }, [id]);

  if (!order) {
    return <div>Pedido não encontrado</div>;
  }

  return (
    <div className="order-detail">
      <h1>Detalhes do Pedido</h1>
      <dl>
        <dt>Número</dt>
        <dd>{order.id}</dd>
        <dt>Cliente</dt>
        <dd>{order.customer}</dd>
        <dt>Total</dt>
        <dd>R$ {order.total.toFixed(2)}</dd>
        <dt>Status</dt>
        <dd>{order.status}</dd>
        <dt>Data</dt>
        <dd>{order.date}</dd>
      </dl>
      <Link to="/">← Voltar para lista</Link>
    </div>
  );
}
```

### App.tsx (Entry Point)

```typescript
import { Routes, Route } from 'react-router-dom';
import { OrdersList } from './pages/OrdersList';
import { OrderDetail } from './pages/OrderDetail';

export default function App() {
  return (
    <Routes>
      <Route index element={<OrdersList />} />
      <Route path=":id" element={<OrderDetail />} />
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
      name: 'mfeOrders',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx'
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry']
    })
  ],
  server: {
    port: 5175
  },
  build: {
    target: 'esnext',
    minify: false
  }
});
```

## Critérios de Sucesso

- [ ] MFE inicia na porta 5175
- [ ] `remoteEntry.js` é gerado no build
- [ ] Host consegue carregar mfe-orders via Module Federation
- [ ] Rota `/orders` exibe lista de pedidos
- [ ] Rota `/orders/:id` exibe detalhe do pedido
- [ ] `logScreenAccess("orders-list")` é chamado ao acessar lista
- [ ] `logScreenAccess("orders-details", { orderId })` é chamado ao acessar detalhe
- [ ] Navegação interna funciona (lista ↔ detalhe)
- [ ] Biblioteca de telemetria é carregada como shared module
