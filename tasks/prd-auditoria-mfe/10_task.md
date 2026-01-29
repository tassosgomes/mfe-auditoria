---
status: completed
parallelizable: false
blocked_by: ["3.0", "5.0", "7.0"]
---

<task_context>
<domain>frontend/host</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>react, telemetry</dependencies>
<unblocks>11.0</unblocks>
</task_context>

# Tarefa 10.0: Implementar Painel de Auditoria

## Visão Geral

Implementar o painel de status de auditoria no Host que exibe informações em tempo real sobre eventos enviados, eventos pendentes na fila e status da API. O painel deve permitir ações manuais como forçar reenvio de eventos.

<requirements>
- RF07.1: Exibir contador de eventos pendentes na fila local
- RF07.2: Exibir status da API de auditoria (Online/Offline)
- RF07.3: Exibir contador de eventos enviados com sucesso na sessão atual
- RF07.4: Atualizar informações automaticamente a cada 5 segundos
- RF07.5: Botão para forçar reenvio manual (`flushQueue`)
</requirements>

## Subtarefas

- [x] 10.1 Criar componente `src/components/AuditPanel/AuditPanel.tsx`
- [x] 10.2 Criar hook `useAuditStatus()` para polling do status
- [x] 10.3 Implementar exibição de status da API:
  - Ícone verde (🟢) para Online
  - Ícone vermelho (🔴) para Offline
  - Ícone amarelo (🟡) para Unknown
- [x] 10.4 Implementar exibição de contadores:
  - Eventos enviados na sessão
  - Eventos pendentes na fila
- [x] 10.5 Implementar botão "Forçar Reenvio":
  - Chamar `flushQueue()`
  - Exibir loading durante operação
  - Exibir resultado (enviados/falhos)
- [x] 10.6 Implementar polling automático a cada 5 segundos
- [x] 10.7 Estilizar painel (posição fixa no canto inferior direito)
- [x] 10.8 Implementar toggle para minimizar/expandir painel
- [x] 10.9 Testar comportamento com API online e offline

## Detalhes de Implementação

### Interface esperada

```
┌─────────────────────────────────────┐
│  📊 Status de Auditoria         [−] │
├─────────────────────────────────────┤
│  API: 🟢 Online                     │
│  Eventos enviados: 15               │
│  Eventos pendentes: 3               │
│  Última sincronização: 14:32:15     │
│                                     │
│  [🔄 Forçar Reenvio]                │
└─────────────────────────────────────┘
```

### Hook useAuditStatus

```typescript
// src/hooks/useAuditStatus.ts
import { useState, useEffect } from 'react';
import { getQueueStatus, QueueStatus } from '@auditoria/telemetry';

export function useAuditStatus(pollingIntervalMs = 5000) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const queueStatus = await getQueueStatus();
        setStatus(queueStatus);
      } catch (error) {
        console.error('[AuditPanel] Erro ao obter status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [pollingIntervalMs]);

  return { status, isLoading };
}
```

### AuditPanel Component

```typescript
// src/components/AuditPanel/AuditPanel.tsx
import { useState } from 'react';
import { flushQueue, FlushResult } from '@auditoria/telemetry';
import { useAuditStatus } from '../../hooks/useAuditStatus';
import './AuditPanel.css';

export function AuditPanel() {
  const { status, isLoading } = useAuditStatus(5000);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<FlushResult | null>(null);

  const handleFlush = async () => {
    setIsFlushing(true);
    setFlushResult(null);
    try {
      const result = await flushQueue();
      setFlushResult(result);
    } catch (error) {
      console.error('[AuditPanel] Erro ao forçar reenvio:', error);
    } finally {
      setIsFlushing(false);
    }
  };

  const getApiStatusIcon = () => {
    if (!status) return '⚪';
    switch (status.apiStatus) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      default: return '🟡';
    }
  };

  const getApiStatusText = () => {
    if (!status) return 'Desconhecido';
    switch (status.apiStatus) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Desconhecido';
    }
  };

  if (isMinimized) {
    return (
      <div className="audit-panel audit-panel--minimized">
        <button onClick={() => setIsMinimized(false)} title="Expandir">
          📊 {status?.pendingCount || 0}
        </button>
      </div>
    );
  }

  return (
    <div className="audit-panel">
      <div className="audit-panel__header">
        <span>📊 Status de Auditoria</span>
        <button onClick={() => setIsMinimized(true)} title="Minimizar">−</button>
      </div>
      
      <div className="audit-panel__content">
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <>
            <p>
              <strong>API:</strong> {getApiStatusIcon()} {getApiStatusText()}
            </p>
            <p>
              <strong>Eventos enviados:</strong> {status?.sessionEventsSent || 0}
            </p>
            <p>
              <strong>Eventos pendentes:</strong> {status?.pendingCount || 0}
            </p>
            {status?.lastFlushAt && (
              <p>
                <strong>Última sinc:</strong> {new Date(status.lastFlushAt).toLocaleTimeString()}
              </p>
            )}
          </>
        )}

        {flushResult && (
          <div className="audit-panel__result">
            ✅ {flushResult.sent} enviados | ❌ {flushResult.failed} falhos
          </div>
        )}

        <button 
          onClick={handleFlush} 
          disabled={isFlushing || (status?.pendingCount === 0)}
          className="audit-panel__flush-btn"
        >
          {isFlushing ? '⏳ Enviando...' : '🔄 Forçar Reenvio'}
        </button>
      </div>
    </div>
  );
}
```

### Estilos CSS

```css
/* src/components/AuditPanel/AuditPanel.css */
.audit-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  width: 280px;
  z-index: 1000;
  font-size: 14px;
}

.audit-panel--minimized {
  width: auto;
}

.audit-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  border-radius: 8px 8px 0 0;
}

.audit-panel__header button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.audit-panel__content {
  padding: 15px;
}

.audit-panel__content p {
  margin: 5px 0;
}

.audit-panel__result {
  margin: 10px 0;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  font-size: 12px;
}

.audit-panel__flush-btn {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.audit-panel__flush-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.audit-panel__flush-btn:hover:not(:disabled) {
  background: #1565c0;
}
```

## Critérios de Sucesso

- [x] Painel exibido no canto inferior direito da tela
- [x] Status da API exibido com ícone colorido (verde/vermelho/amarelo)
- [x] Contador de eventos enviados na sessão é exibido
- [x] Contador de eventos pendentes na fila é exibido
- [x] Informações atualizam automaticamente a cada 5 segundos
- [x] Botão "Forçar Reenvio" chama `flushQueue()`
- [x] Botão desabilitado quando não há eventos pendentes
- [x] Loading exibido durante operação de reenvio
- [x] Resultado do reenvio é exibido (enviados/falhos)
- [x] Painel pode ser minimizado/expandido
- [x] Painel não obstrui navegação principal

## Checklist de Conclusão

- [x] 10.0 Implementar Painel de Auditoria ✅ CONCLUÍDA
  - [x] 10.1 Implementação completada
  - [x] 10.2 Definição da tarefa, PRD e tech spec validados
  - [x] 10.3 Análise de regras e conformidade verificadas
  - [x] 10.4 Revisão de código completada
  - [x] 10.5 Pronto para deploy
