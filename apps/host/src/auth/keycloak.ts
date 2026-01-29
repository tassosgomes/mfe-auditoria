import Keycloak, { type KeycloakTokenParsed } from 'keycloak-js'

type TokenPayload = KeycloakTokenParsed & {
  sub?: string
  email?: string
  name?: string
  preferred_username?: string
}

export type AuthUser = {
  userId: string
  email?: string
  name?: string
}

export const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'auditoria-poc',
  clientId: 'mfe-host',
})

let keycloakInitialized = false
let initPromise: Promise<boolean> | null = null

export async function initKeycloak(): Promise<boolean> {
  // Se já foi inicializado com sucesso, retorna true
  if (keycloakInitialized && keycloak.authenticated !== undefined) {
    return keycloak.authenticated
  }

  // Se já existe uma inicialização em andamento, aguarda ela
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      const authenticated = await keycloak.init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      keycloakInitialized = true
      return authenticated
    } catch (error) {
      console.error('Falha ao inicializar Keycloak:', error)
      initPromise = null
      return false
    }
  })()

  return initPromise
}

export function getUserFromToken(): AuthUser | null {
  const token = keycloak.tokenParsed as TokenPayload | undefined
  if (!token) return null

  const userId = token.sub ?? token.preferred_username
  if (!userId) return null

  return {
    userId,
    email: token.email,
    name: token.name ?? token.preferred_username,
  }
}

export function getTokenPayload(): {
  sub: string
  email?: string
  name?: string
} | null {
  const token = keycloak.tokenParsed as TokenPayload | undefined
  if (!token) return null

  const userId = token.sub ?? token.preferred_username
  if (!userId) return null

  return {
    sub: userId,
    email: token.email,
    name: token.name ?? token.preferred_username,
  }
}

export function logout(): void {
  keycloak.logout({ redirectUri: window.location.origin })
}
