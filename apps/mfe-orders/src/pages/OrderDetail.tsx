import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { logScreenAccess } from '@auditoria/telemetry'
import { mockOrders } from '../data/orders'

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const order = mockOrders.find((item) => item.id === id)

  useEffect(() => {
    if (!id) return
    logScreenAccess('orders-details', { orderId: id, sourceMfe: 'mfe-orders' })
  }, [id])

  if (!id) {
    return (
      <section className="order-detail">
        <div className="card">
          <h1>Pedido não informado</h1>
          <p className="muted">Selecione um pedido na listagem.</p>
          <Link className="link" to=".." relative="path">
            ← Voltar para lista
          </Link>
        </div>
      </section>
    )
  }

  if (!order) {
    return (
      <section className="order-detail">
        <div className="card">
          <h1>Pedido não encontrado</h1>
          <p className="muted">Não encontramos o pedido solicitado.</p>
          <Link className="link" to=".." relative="path">
            ← Voltar para lista
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="order-detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">Detalhe</p>
          <h1>{order.id}</h1>
          <p className="subtitle">Informações do pedido selecionado.</p>
        </div>
        <Link className="link" to=".." relative="path">
          ← Voltar para lista
        </Link>
      </header>

      <div className="detail-grid">
        <div className="card">
          <dl className="detail-list">
            <div>
              <dt>Cliente</dt>
              <dd>{order.customer}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>R$ {order.total.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="badge">{order.status}</span>
              </dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{order.date}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
