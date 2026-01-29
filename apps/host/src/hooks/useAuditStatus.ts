import { useEffect, useRef, useState } from 'react'
import { getQueueStatus, type QueueStatus } from '@auditoria/telemetry'

type UseAuditStatusResult = {
  status: QueueStatus | null
  isLoading: boolean
}

export function useAuditStatus(pollingIntervalMs = 5000): UseAuditStatusResult {
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const fetchStatus = async () => {
      try {
        const queueStatus = await getQueueStatus()
        if (!isMounted.current) return
        setStatus(queueStatus)
      } catch (error) {
        console.error('[AuditPanel] Erro ao obter status:', error)
      } finally {
        if (isMounted.current) {
          setIsLoading(false)
        }
      }
    }

    void fetchStatus()
    const interval = window.setInterval(fetchStatus, pollingIntervalMs)

    return () => {
      isMounted.current = false
      window.clearInterval(interval)
    }
  }, [pollingIntervalMs])

  return { status, isLoading }
}