import { NextAuthOptions } from "next-auth";
import type { JWT } from 'next-auth/jwt'
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import prismaClient from '@/lib/prisma'
import { createEmailChallenge } from '@/server/auth/challenges'
import { resolveUserActiveBusiness } from '@/server/auth/business-context'
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
      },
      async authorize(credentials) {
        if (useMockAuth) {
          return { id: "demo-user-id", name: "Usuario Demo", email: "demo@finarg.com", image: null };
        }

        const normalizedEmail = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password

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
            if (normalizedEmail === "demo@finarg.com" && password === "Demo1234") {
              return { id: "demo-local", name: "Demo Local", email: "demo@finarg.com", image: null };
            }
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
          if (normalizedEmail === "demo@finarg.com" && password === "Demo1234") {
            return { id: "demo-local", name: "Demo Local (DB Error)", email: "demo@finarg.com", image: null };
          }
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

  const [user, activeBusiness] = await Promise.all([
    prisma.user.findUnique({
      where: { id: token.sub },
      select: {
        emailVerified: true,
        defaultBusinessId: true,
        lastSecurityChallengeAt: true,
      },
    }),
    resolveUserActiveBusiness(token.sub, token.activeBusinessId),
  ])

  token.emailVerified = Boolean(user?.emailVerified)
  token.activeBusinessId = activeBusiness?.id ?? null
  token.activeBusinessName = activeBusiness?.name ?? null
  token.activeBusinessRole = activeBusiness?.role ?? null
  token.challengeSatisfied = Boolean(user?.emailVerified) && !shouldRequirePeriodicRiskChallenge(user?.lastSecurityChallengeAt)

  return token
}

function buildVerifyCodeRedirect(email: string, purpose: 'SIGNUP_VERIFY' | 'SOCIAL_LOGIN_VERIFY' | 'RISK_CHALLENGE') {
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

      return hydrateTokenContext(token)
    },
    async signIn({ user, account }) {
      if (!useMockAuth && prisma && user.id && user.email && account?.provider) {
        const provider = account.provider === 'google' || account.provider === 'apple'
          ? account.provider
          : 'credentials'

        const credentialsUser = user as typeof user & Partial<CredentialsAuthUser>

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

        const challengePurpose = dbUser
          ? decideLoginChallenge({
              provider,
              emailVerified: dbUser.emailVerified,
              lastSecurityChallengeAt: dbUser.lastSecurityChallengeAt,
            })
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

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => null)
      }

      return true
    },
  },
};
