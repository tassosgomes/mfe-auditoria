import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { initTelemetry } from '@auditoria/telemetry'
import {
  getTokenPayload,
  getUserFromToken,
  initKeycloak,
  keycloak,
  logout,
  type AuthUser,
} from './keycloak'

type AuthContextType = {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_API_BASE_URL = 'http://localhost:5000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const telemetryInitialized = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const setupEvents = () => {
      keycloak.onTokenExpired = async () => {
        try {
          const refreshed = await keycloak.updateToken(30)
          if (refreshed && mountedRef.current) {
            setUser(getUserFromToken())
          }
        } catch (error) {
          console.error('Falha ao atualizar token do Keycloak:', error)
          if (mountedRef.current) {
            setIsAuthenticated(false)
          }
          keycloak.login()
        }
      }

      keycloak.onAuthLogout = () => {
        if (mountedRef.current) {
          setIsAuthenticated(false)
          setUser(null)
        }
      }
    }

    const initialize = async () => {
      const authenticated = await initKeycloak()
      if (!mountedRef.current) return

      setupEvents()
      setIsAuthenticated(authenticated)
      if (authenticated) {
        setUser(getUserFromToken())

        if (!telemetryInitialized.current) {
          const apiBaseUrl =
            import.meta.env.VITE_AUDIT_API_URL ?? DEFAULT_API_BASE_URL

          initTelemetry({
            apiBaseUrl,
            getKeycloakToken: getTokenPayload,
          })
          telemetryInitialized.current = true
        }
      } else {
        keycloak.login()
      }

      setIsLoading(false)
    }

    void initialize()

    return () => {
      mountedRef.current = false
    }
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      logout,
    }),
    [isAuthenticated, isLoading, user]
  )

  if (isLoading) {
    return <div className="page-state">Carregando...</div>
  }

  if (!isAuthenticated) {
    return <div className="page-state">Redirecionando para login...</div>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
