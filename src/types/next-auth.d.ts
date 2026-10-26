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
      provider: 'google' | 'apple' | 'azure-ad' | 'credentials' | 'mock'
      challengeSatisfied: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    activeBusinessId?: string | null
    activeBusinessName?: string | null
    activeBusinessRole?: 'ADMIN' | 'COLLABORATOR' | 'VIEWER' | null
    authProvider?: 'google' | 'apple' | 'azure-ad' | 'credentials' | 'mock'
    challengeSatisfied?: boolean
    emailVerified?: boolean
    authSessionId?: string
    authSessionSlot?: 1 | 2 | 3
  }
}