import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { getGoogleOAuthAuthorizationParams, hasGoogleOAuthCredentials } from "@/lib/googleAuth";

const providers = hasGoogleOAuthCredentials()
  ? [
      Google({
        authorization: {
          params: getGoogleOAuthAuthorizationParams(),
        },
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      }),
    ]
  : [];

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        // Google OAuth tokens are kept in the server-readable Auth.js JWT only.
        // The session callback below intentionally exposes connection metadata, never token values.
        token.google = {
          accessToken: account.access_token,
          expiresAt: account.expires_at,
          refreshToken: account.refresh_token ?? token.google?.refreshToken,
          scope: account.scope,
          tokenType: account.token_type,
        };
      }

      return token;
    },
    async session({ session, token }) {
      session.google = {
        // Client components only need connection state and granted scopes for UI decisions.
        connected: Boolean(token.google?.accessToken),
        expiresAt: token.google?.expiresAt,
        grantedScopes: token.google?.scope ?? "",
        hasAccessToken: Boolean(token.google?.accessToken),
        hasRefreshToken: Boolean(token.google?.refreshToken),
      };

      return session;
    },
  },
  pages: {
    error: "/auth/error",
  },
  providers,
  session: {
    strategy: "jwt",
  },
  trustHost: true,
} satisfies NextAuthConfig);
