import { useState } from 'react'
import { flushQueue, type FlushResult } from '@auditoria/telemetry'
import { useAuditStatus } from '../../hooks/useAuditStatus'
import './AuditPanel.css'

const formatTime = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString()
}

export function AuditPanel() {
  const { status, isLoading } = useAuditStatus(5000)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isFlushing, setIsFlushing] = useState(false)
  const [flushResult, setFlushResult] = useState<FlushResult | null>(null)

  const pendingCount = status?.pendingCount ?? 0
  const sessionSent = status?.sessionEventsSent ?? 0

  const handleFlush = async () => {
    setIsFlushing(true)
    setFlushResult(null)
    try {
      const result = await flushQueue()
      setFlushResult(result)
    } catch (error) {
      console.error('[AuditPanel] Erro ao forçar reenvio:', error)
    } finally {
      setIsFlushing(false)
    }
  }

  const getApiStatusIcon = () => {
    switch (status?.apiStatus) {
      case 'online':
        return '🟢'
      case 'offline':
        return '🔴'
      case 'unknown':
      default:
        return '🟡'
    }
  }

  const getApiStatusText = () => {
    switch (status?.apiStatus) {
      case 'online':
        return 'Online'
      case 'offline':
        return 'Offline'
      case 'unknown':
      default:
        return 'Desconhecido'
    }
  }

  if (isMinimized) {
    return (
      <div className="audit-panel audit-panel--minimized">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          title="Expandir painel de auditoria"
        >
          📊 {pendingCount}
        </button>
      </div>
    )
  }

  return (
    <div className="audit-panel">
      <div className="audit-panel__header">
        <span>📊 Status de Auditoria</span>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          title="Minimizar painel de auditoria"
          aria-label="Minimizar painel de auditoria"
        >
          −
        </button>
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
              <strong>Eventos enviados:</strong> {sessionSent}
            </p>
            <p>
              <strong>Eventos pendentes:</strong> {pendingCount}
            </p>
            <p>
              <strong>Última sincronização:</strong>{' '}
              {formatTime(status?.lastFlushAt)}
            </p>
          </>
        )}

        {flushResult && (
          <div className="audit-panel__result" role="status">
            ✅ {flushResult.sent} enviados | ❌ {flushResult.failed} falhos
          </div>
        )}

        <button
          type="button"
          onClick={handleFlush}
          disabled={isFlushing || pendingCount === 0}
          className="audit-panel__flush-btn"
        >
          {isFlushing ? '⏳ Enviando...' : '🔄 Forçar Reenvio'}
        </button>
      </div>
    </div>
  )
}