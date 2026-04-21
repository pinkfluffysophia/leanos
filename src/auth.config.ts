import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth;
      const pathname = nextUrl.pathname;

      const publicRoutes = [
        "/",
        "/login",
        "/signup",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/waitlist",
        "/products",
        "/buy",
      ];
      const isPublicRoute = publicRoutes.some(
        (route) =>
          pathname === route ||
          (pathname.startsWith(route) && route !== "/")
      );

      if (isPublicRoute) {
        if (
          isLoggedIn &&
          pathname !== "/" &&
          !pathname.startsWith("/reset-password") &&
          !pathname.startsWith("/verify-email") &&
          !pathname.startsWith("/waitlist") &&
          !pathname.startsWith("/products") &&
          !pathname.startsWith("/buy")
        ) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      return true;
    },
  },
  providers: [],
};
