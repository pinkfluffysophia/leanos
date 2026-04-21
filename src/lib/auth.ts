import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "@/auth.config";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          return null;
        }

        if (user.status === "inactive") {
          return null;
        }

        if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profilePictureUrl: user.profilePictureUrl,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
        token.profilePictureUrl = (user as { profilePictureUrl: string | null }).profilePictureUrl;
        token.sessionVersion = (user as { sessionVersion: number }).sessionVersion;
      }

      if (trigger === "update" && session) {
        if (session.email) token.email = session.email;
        if (session.firstName) token.firstName = session.firstName;
        if (session.lastName) token.lastName = session.lastName;
        if (session.profilePictureUrl !== undefined) token.profilePictureUrl = session.profilePictureUrl;
        if (session.sessionVersion !== undefined && session.sessionVersion !== token.sessionVersion) {
          if (session.role) token.role = session.role;
          token.sessionVersion = session.sessionVersion;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.profilePictureUrl = token.profilePictureUrl as string | null;
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
