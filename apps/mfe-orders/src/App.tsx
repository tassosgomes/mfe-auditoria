import { Navigate, Route, Routes } from 'react-router-dom'
import { OrdersList } from './pages/OrdersList'
import { OrderDetail } from './pages/OrderDetail'
import './App.css'

export default function App() {
  return (
    <div className="orders-app">
      <Routes>
        <Route index element={<OrdersList />} />
        <Route path=":id" element={<OrderDetail />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  )
}
