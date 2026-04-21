import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const middleware = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|uploads).*)"],
};
