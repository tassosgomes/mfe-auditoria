import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const buildNavClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link${isActive ? ' active' : ''}`

export function Navigation() {
  const { user, logout } = useAuth()

  const displayName = user?.name || user?.email || user?.userId

  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="brand-dot" aria-hidden="true" />
        <div>
          <strong>Auditoria MFE</strong>
          <span className="brand-subtitle">Host Shell</span>
        </div>
      </div>
      <nav className="app-nav" aria-label="Navegação principal">
        <NavLink to="/" end className={buildNavClass}>
          Home
        </NavLink>
        <NavLink to="/users" className={buildNavClass}>
          Usuários
        </NavLink>
        <NavLink to="/orders" className={buildNavClass}>
          Pedidos
        </NavLink>
      </nav>
      <div className="app-user">
        <span className="app-user-name">{displayName}</span>
        <button type="button" className="app-logout" onClick={logout}>
          Sair
        </button>
      </div>
    </header>
  )
}
