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

export async function initKeycloak(): Promise<boolean> {
  try {
    return await keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
  } catch (error) {
    console.error('Falha ao inicializar Keycloak:', error)
    return false
  }
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
