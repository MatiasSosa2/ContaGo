export const AUTHENTICATION_UNAVAILABLE = 'AuthenticationUnavailable'

export function isAuthenticationUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === AUTHENTICATION_UNAVAILABLE
}
