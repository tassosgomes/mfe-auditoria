import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { logScreenAccess } from '@auditoria/telemetry'
import { mockUsers } from '../data/users'

export function UsersList() {
  useEffect(() => {
    logScreenAccess('users-list', { sourceMfe: 'mfe-users' })
  }, [])

  return (
    <section className="users-list">
      <header className="users-header">
        <div>
          <p className="eyebrow">MFE Usuários</p>
          <h1>Usuários</h1>
          <p className="subtitle">Listagem de usuários cadastrados no sistema.</p>
        </div>
        <div className="pill">Total: {mockUsers.length}</div>
      </header>

      <div className="table-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Departamento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="badge">{user.department}</span>
                </td>
                <td>
                  <Link className="link" to={user.id}>
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
