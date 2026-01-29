import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Navigation } from './components/Navigation'
import { Home } from './pages/Home'

const MfeUsersApp = lazy(() => import('mfeUsers/App'))
const MfeOrdersApp = lazy(() => import('mfeOrders/App'))

const LoadingFallback = ({ message }: { message: string }) => (
  <div className="page-state">{message}</div>
)

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Navigation />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/users/*"
                element={
                  <ErrorBoundary
                    fallback={<LoadingFallback message="Erro ao carregar MFE Users." />}
                  >
                    <Suspense fallback={<LoadingFallback message="Carregando MFE Users..." />}>
                      <MfeUsersApp />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/orders/*"
                element={
                  <ErrorBoundary
                    fallback={<LoadingFallback message="Erro ao carregar MFE Orders." />}
                  >
                    <Suspense fallback={<LoadingFallback message="Carregando MFE Orders..." />}>
                      <MfeOrdersApp />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="*"
                element={<LoadingFallback message="Página não encontrada." />}
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
