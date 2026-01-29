import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function Home() {
  const { user } = useAuth()
  const displayName = user?.name || user?.email || user?.userId

  return (
    <section className="home">
      <div className="home-card">
        <p className="home-eyebrow">Bem-vindo(a)</p>
        <h1>Olá, {displayName}!</h1>
        <p className="home-subtitle">
          Este Host orquestra os Micro Frontends e centraliza a autenticação.
        </p>
        <div className="home-actions">
          <Link to="/users" className="primary-action">
            Acessar Usuários
          </Link>
          <Link to="/orders" className="secondary-action">
            Acessar Pedidos
          </Link>
        </div>
      </div>
      <div className="home-grid">
        <div className="home-tile">
          <h3>Usuários</h3>
          <p>Listagem e detalhes de usuários com telemetria integrada.</p>
          <Link to="/users">Abrir MFE Users →</Link>
        </div>
        <div className="home-tile">
          <h3>Pedidos</h3>
          <p>Listagem e detalhes de pedidos com telemetria integrada.</p>
          <Link to="/orders">Abrir MFE Orders →</Link>
        </div>
      </div>
    </section>
  )
}
