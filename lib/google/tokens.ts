import type { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";
import { parseGrantedScopes } from "@/lib/googleAuth";

export type GoogleTokenDiagnostics = {
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  expiryPresent: boolean;
  scopePresent: boolean;
};

type AccessTokenResult =
  | {
      ok: true;
      accessToken: string;
      diagnostics: GoogleTokenDiagnostics;
      scope: string;
    }
  | {
      ok: false;
      diagnostics: GoogleTokenDiagnostics;
      reason: "not_connected" | "missing_scope" | "refresh_failed" | "misconfigured";
      missingScopes?: string[];
    };

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

function isFresh(expiresAt?: number) {
  if (!expiresAt) return true;
  return expiresAt * 1000 - Date.now() > 60_000;
}

function getAuthProtocol(request: NextRequest) {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (authUrl) {
    try {
      return new URL(authUrl).protocol;
    } catch {
      // Fall back to request headers if the deployment URL is malformed.
    }
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto.endsWith(":") ? forwardedProto : `${forwardedProto}:`;
  }

  return request.nextUrl.protocol;
}

function usesSecureAuthCookie(request: NextRequest) {
  return getAuthProtocol(request) === "https:";
}

function diagnosticsForGoogleToken(token: JWT | null): GoogleTokenDiagnostics {
  return {
    accessTokenPresent: Boolean(token?.google?.accessToken),
    refreshTokenPresent: Boolean(token?.google?.refreshToken),
    expiryPresent: Boolean(token?.google?.expiresAt),
    scopePresent: Boolean(token?.google?.scope),
  };
}

async function refreshAccessToken(
  refreshToken: string,
  diagnostics: GoogleTokenDiagnostics,
  currentScope: string,
): Promise<AccessTokenResult> {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return { ok: false, diagnostics, reason: "misconfigured" };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      client_secret: process.env.AUTH_GOOGLE_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleRefreshResponse;

  if (!response.ok || !payload.access_token) {
    return { ok: false, diagnostics, reason: "refresh_failed" };
  }

  return {
    ok: true,
    accessToken: payload.access_token,
    diagnostics: {
      ...diagnostics,
      accessTokenPresent: true,
      scopePresent: Boolean(payload.scope ?? currentScope),
    },
    scope: payload.scope ?? currentScope,
  };
}

export async function getGoogleAccessTokenForRequest(
  request: NextRequest,
  requiredScopes: string[],
): Promise<AccessTokenResult> {
  // Google tokens are read and refreshed only inside server routes. Never return
  // token values to client components or include them in logs.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: usesSecureAuthCookie(request),
  });
  const diagnostics = diagnosticsForGoogleToken(token);
  const grantedScopesString = token?.google?.scope ?? "";
  const grantedScopes = parseGrantedScopes(grantedScopesString);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));

  if (!token?.google?.accessToken) {
    return { ok: false, diagnostics, reason: "not_connected" };
  }

  if (missingScopes.length > 0) {
    return { ok: false, diagnostics, reason: "missing_scope", missingScopes };
  }

  if (isFresh(token.google.expiresAt)) {
    return {
      ok: true,
      accessToken: token.google.accessToken,
      diagnostics,
      scope: token.google.scope ?? "",
    };
  }

  if (!token.google.refreshToken) {
    return { ok: false, diagnostics, reason: "refresh_failed" };
  }

  return refreshAccessToken(token.google.refreshToken, diagnostics, token.google.scope ?? "");
}
