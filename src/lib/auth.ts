import { NextAuthOptions } from "next-auth";
import type { JWT } from 'next-auth/jwt'
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import prismaClient from '@/lib/prisma'
import type { EmailChallengePurpose } from '@/server/auth/challenges'
import { createEmailChallenge, findVerifiedChallengeForLogin } from '@/server/auth/challenges'
import { sendAuthCodeEmail } from '@/server/auth/email'
import { decideLoginChallenge, shouldRequirePeriodicRiskChallenge } from '@/server/auth/login-security'

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === 'true';
const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL)
const useMockAuth = isMock || !hasDatabaseConfig
const prisma = useMockAuth ? null : prismaClient;

type CredentialsAuthUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  emailVerified: Date | null
  lastSecurityChallengeAt: Date | null
  isTemporaryAccess?: boolean
}

function getTemporaryAccessAdminEmail() {
  return process.env.TEMP_ACCESS_ADMIN_EMAIL?.trim().toLowerCase() || null
}

function getConfiguredProviders() {
  const providers = []

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    )
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push(
      AppleProvider({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
      }),
    )
  }

  providers.push(
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        temporaryAccess: { label: "TemporaryAccess", type: "text" },
        postVerifyChallengeId: { label: "PostVerifyChallengeId", type: "text" },
      },
      async authorize(credentials) {
        if (useMockAuth) {
          return null;
        }

        const wantsTemporaryAccess = credentials?.temporaryAccess === 'true'
        const normalizedEmail = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        const postVerifyChallengeId = credentials?.postVerifyChallengeId?.trim() || null

        if (wantsTemporaryAccess) {
          const temporaryAccessEmail = getTemporaryAccessAdminEmail()

          if (!temporaryAccessEmail || !prisma) {
            console.warn('[auth] acceso temporal deshabilitado: TEMP_ACCESS_ADMIN_EMAIL no configurado o prisma ausente')
            return null
          }

          // Buscar user (los emails en DB se guardan normalizados a lowercase)
          const user = await prisma.user.findUnique({
            where: { email: temporaryAccessEmail },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              emailVerified: true,
              lastSecurityChallengeAt: true,
              memberships: {
                where: { status: 'ACTIVE', role: 'ADMIN' },
                select: { businessId: true },
                take: 1,
              },
            },
          })

          if (!user) {
            console.warn(`[auth] acceso temporal: no existe user con email ${temporaryAccessEmail}`)
            return null
          }
          if (user.memberships.length === 0) {
            console.warn(`[auth] acceso temporal: user ${user.id} no tiene membership ACTIVE+ADMIN`)
            return null
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            lastSecurityChallengeAt: user.lastSecurityChallengeAt,
            isTemporaryAccess: true,
          } as CredentialsAuthUser
        }

        // Post-verificación: permite iniciar sesión con un challengeId recién consumido
        // (sin reingresar password) en la ventana de 2 minutos después del verify-code.
        if (postVerifyChallengeId && normalizedEmail && prisma) {
          const verified = await findVerifiedChallengeForLogin({
            email: normalizedEmail,
            challengeId: postVerifyChallengeId,
          })
          if (!verified) {
            console.warn('[auth] postVerifyChallengeId no valido o expirado')
            return null
          }

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              emailVerified: true,
              lastSecurityChallengeAt: true,
            },
          })
          if (!user) return null

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            lastSecurityChallengeAt: user.lastSecurityChallengeAt,
          } as CredentialsAuthUser
        }

        if (!normalizedEmail || !password) {
          throw new Error("Credenciales inválidas")
        }

        try {
          if (!prisma) return null;

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              password: true,
              emailVerified: true,
              lastSecurityChallengeAt: true,
            },
          });

          if (!user || !user.password) {
            return null;
          }

          const isCorrectPassword = await bcrypt.compare(password, user.password);
          if (!isCorrectPassword) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            lastSecurityChallengeAt: user.lastSecurityChallengeAt,
          } as CredentialsAuthUser;
        } catch {
          return null;
        }
      },
    }),
  )

  return providers
}

async function hydrateTokenContext(token: JWT) {
  if (!token.sub) {
    return token
  }

  if (useMockAuth) {
    token.activeBusinessId ??= 'demo-business'
    token.activeBusinessName ??= 'Empresa Demo'
    token.activeBusinessRole ??= 'ADMIN'
    token.authProvider ??= 'mock'
    token.challengeSatisfied ??= true
    token.emailVerified ??= true
    return token
  }

  if (!prisma) {
    return token
  }

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: {
      emailVerified: true,
      defaultBusinessId: true,
      lastSecurityChallengeAt: true,
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          businessId: true,
          business: { select: { id: true, name: true } },
        },
      },
    },
  })

  const memberships = user?.memberships ?? []
  const preferredId = token.activeBusinessId ?? null
  let activeMembership = preferredId
    ? memberships.find((m) => m.businessId === preferredId)
    : undefined

  if (!activeMembership) {
    activeMembership =
      memberships.find((m) => m.businessId === user?.defaultBusinessId) ??
      (memberships.length === 1 ? memberships[0] : undefined)
  }

  const role = activeMembership?.role
  const normalizedRole: 'ADMIN' | 'COLLABORATOR' | 'VIEWER' | null =
    role === 'ADMIN' || role === 'COLLABORATOR' || role === 'VIEWER'
      ? role
      : activeMembership
      ? 'COLLABORATOR'
      : null

  token.emailVerified = Boolean(user?.emailVerified)
  token.activeBusinessId = activeMembership?.business.id ?? null
  token.activeBusinessName = activeMembership?.business.name ?? null
  token.activeBusinessRole = normalizedRole
  token.challengeSatisfied = Boolean(user?.emailVerified) && !shouldRequirePeriodicRiskChallenge(user?.lastSecurityChallengeAt, user?.emailVerified)

  return token
}

function buildVerifyCodeRedirect(
  email: string,
  purpose: Exclude<EmailChallengePurpose, 'PASSWORD_RESET'>,
) {
  const params = new URLSearchParams({ email, purpose })
  const origin = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${origin}/auth/verify-code?${params.toString()}`
}

export const authOptions: NextAuthOptions = {
  adapter: useMockAuth || !prisma ? undefined : PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/register",
  },
  providers: getConfiguredProviders(),
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.emailVerified = Boolean(token.emailVerified)
      }

      session.activeBusiness = token.activeBusinessId && token.activeBusinessName && token.activeBusinessRole
        ? {
            id: token.activeBusinessId,
            name: token.activeBusinessName,
            role: token.activeBusinessRole,
          }
        : null

      session.auth = {
        provider: token.authProvider ?? (useMockAuth ? 'mock' : 'credentials'),
        challengeSatisfied: token.challengeSatisfied ?? false,
      }

      return session;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.sub = user.id;
      }

      if (account?.provider) {
        token.authProvider = account.provider === 'google' || account.provider === 'apple'
          ? account.provider
          : 'credentials'
      }

      if (trigger === 'update' && session?.activeBusiness?.id) {
        token.activeBusinessId = session.activeBusiness.id
        token.activeBusinessName = session.activeBusiness.name
        token.activeBusinessRole = session.activeBusiness.role
      }

      // Solo hidratar desde DB en el login inicial o cuando cambia el contexto.
      // En las requests subsiguientes el token ya trae lo necesario y evitamos
      // 1 query por cada request autenticada.
      const needsHydration =
        Boolean(user) ||
        trigger === 'update' ||
        trigger === 'signUp' ||
        token.emailVerified === undefined

      if (needsHydration) {
        return hydrateTokenContext(token)
      }

      return token
    },
    async signIn({ user, account }) {
      if (!useMockAuth && prisma && user.id && user.email && account?.provider) {
        const provider = account.provider === 'google' || account.provider === 'apple'
          ? account.provider
          : 'credentials'

        const credentialsUser = user as typeof user & Partial<CredentialsAuthUser>
        const isTemporaryAccess = credentialsUser.isTemporaryAccess === true

        if (isTemporaryAccess) {
          void prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(() => null)

          return true
        }

        const dbUser = provider === 'credentials'
          ? {
              email: credentialsUser.email ?? null,
              emailVerified: credentialsUser.emailVerified ?? null,
              lastSecurityChallengeAt: credentialsUser.lastSecurityChallengeAt ?? null,
            }
          : await prisma.user.findUnique({
              where: { id: user.id },
              select: {
                email: true,
                emailVerified: true,
                lastSecurityChallengeAt: true,
              },
            })

        const challengePurpose: Exclude<EmailChallengePurpose, 'PASSWORD_RESET'> | null = dbUser
          ? decideLoginChallenge({
              provider,
              emailVerified: dbUser.emailVerified,
              lastSecurityChallengeAt: dbUser.lastSecurityChallengeAt,
            }) as Exclude<EmailChallengePurpose, 'PASSWORD_RESET'> | null
          : null

        if (dbUser?.email && challengePurpose) {
          const { code } = await createEmailChallenge({
            userId: user.id,
            email: dbUser.email,
            purpose: challengePurpose,
          })

          await sendAuthCodeEmail({
            email: dbUser.email,
            code,
            purpose: challengePurpose,
          })

          return buildVerifyCodeRedirect(dbUser.email, challengePurpose)
        }

        // Fire-and-forget: no bloqueamos el login esperando un update cosmético.
        void prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => null)
      }

      return true
    },
  },
};
