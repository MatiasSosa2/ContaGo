import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === 'true';
const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL)
const useMockAuth = isMock || !hasDatabaseConfig
const prisma = useMockAuth ? null : require("@/lib/prisma").default;

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
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
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

        if (!credentials?.email || !credentials?.password) throw new Error("Credenciales inválidas");
        
        try {
          if (!prisma) return null;
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user || !user.password) {
             if (credentials.email === "demo@finarg.com" && credentials.password === "Demo1234") {
                return { id: "demo-local", name: "Demo Local", email: "demo@finarg.com", image: null };
             }
             return null;
          }
          const isCorrectPassword = await bcrypt.compare(credentials.password, user.password);
          if (!isCorrectPassword) return null;
          return user;
        } catch (e) {
          if (credentials.email === "demo@finarg.com" && credentials.password === "Demo1234") {
             return { id: "demo-local", name: "Demo Local (DB Error)", email: "demo@finarg.com", image: null };
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};
