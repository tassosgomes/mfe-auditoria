import { Navigate, Route, Routes } from 'react-router-dom'
import { UsersList } from './pages/UsersList'
import { UserDetail } from './pages/UserDetail'
import './App.css'

export default function App() {
  return (
    <div className="users-app">
      <Routes>
        <Route index element={<UsersList />} />
        <Route path=":id" element={<UserDetail />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  )
}
