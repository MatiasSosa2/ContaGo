import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      emailVerified?: boolean
    }
    activeBusiness?: {
      id: string
      name: string
      role: 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
    } | null
    auth?: {
      provider: 'google' | 'apple' | 'credentials' | 'mock'
      challengeSatisfied: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    activeBusinessId?: string | null
    activeBusinessName?: string | null
    activeBusinessRole?: 'ADMIN' | 'COLLABORATOR' | 'VIEWER' | null
    authProvider?: 'google' | 'apple' | 'credentials' | 'mock'
    challengeSatisfied?: boolean
    emailVerified?: boolean
  }
}