import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { logScreenAccess } from '@auditoria/telemetry'
import { mockUsers } from '../data/users'

export function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const user = mockUsers.find((item) => item.id === id)

  useEffect(() => {
    if (!id) return
    logScreenAccess('users-details', { userId: id, sourceMfe: 'mfe-users' })
  }, [id])

  if (!id) {
    return (
      <section className="user-detail">
        <div className="card">
          <h1>Usuário não informado</h1>
          <p className="muted">Selecione um usuário na listagem.</p>
          <Link className="link" to=".." relative="path">
            ← Voltar para lista
          </Link>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="user-detail">
        <div className="card">
          <h1>Usuário não encontrado</h1>
          <p className="muted">Não encontramos o usuário solicitado.</p>
          <Link className="link" to=".." relative="path">
            ← Voltar para lista
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="user-detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">Detalhe</p>
          <h1>{user.name}</h1>
          <p className="subtitle">Informações do usuário selecionado.</p>
        </div>
        <Link className="link" to=".." relative="path">
          ← Voltar para lista
        </Link>
      </header>

      <div className="detail-grid">
        <div className="card">
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Departamento</dt>
              <dd>{user.department}</dd>
            </div>
            <div>
              <dt>ID</dt>
              <dd>{user.id}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
