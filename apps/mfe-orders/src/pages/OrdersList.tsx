import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { logScreenAccess } from '@auditoria/telemetry'
import { mockOrders } from '../data/orders'

export function OrdersList() {
  useEffect(() => {
    logScreenAccess('orders-list', { sourceMfe: 'mfe-orders' })
  }, [])

  return (
    <section className="orders-list">
      <header className="orders-header">
        <div>
          <p className="eyebrow">MFE Pedidos</p>
          <h1>Pedidos</h1>
          <p className="subtitle">Listagem de pedidos registrados no sistema.</p>
        </div>
        <div className="pill">Total: {mockOrders.length}</div>
      </header>

      <div className="table-card">
        <table className="orders-table">
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
            {mockOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>R$ {order.total.toFixed(2)}</td>
                <td>
                  <span className="badge">{order.status}</span>
                </td>
                <td>{order.date}</td>
                <td>
                  <Link className="link" to={order.id}>
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
