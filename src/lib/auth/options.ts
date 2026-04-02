import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import argon2 from "argon2";
import { sendWelcomeEmail } from "@/lib/email";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { accounts: { select: { provider: true }, take: 1 } },
        });

        if (!user) return null;

        if (!user.passwordHash) {
          const isGoogle = user.accounts?.some(
            (a: { provider: string }) => a.provider === "google"
          );
          if (isGoogle) {
            throw new Error("GOOGLE_ACCOUNT");
          }
          return null;
        }

        const valid = await argon2.verify(user.passwordHash, credentials.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  events: {
    async createUser({ user }) {
      if (user.email) {
        sendWelcomeEmail(user.email, user.name || "").catch(() => {});
      }
      if (user.id) {
        prisma.activityLog.create({
          data: { userId: user.id, action: "signup", detail: user.email || undefined },
        }).catch(() => {});
      }
    },
    async signIn({ user }) {
      if (user.id) {
        prisma.activityLog.create({
          data: { userId: user.id, action: "login" },
        }).catch(() => {});
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tier: true, role: true, name: true, image: true, bannedUntil: true, email: true },
        });
        if (dbUser) {
          if (dbUser.email === "balsarafshubham@gmail.com" && (dbUser.role !== "ADMIN" || dbUser.tier !== "PRO")) {
            await prisma.user.update({
              where: { id: token.id as string },
              data: { role: "ADMIN", tier: "PRO" },
            });
            dbUser.role = "ADMIN";
            dbUser.tier = "PRO";
          }
          token.tier = dbUser.tier;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.banned = dbUser.bannedUntil && new Date(dbUser.bannedUntil) > new Date();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).tier = token.tier;
        (session.user as any).role = token.role;
        (session.user as any).banned = token.banned;
      }
      return session;
    },
  },
};
