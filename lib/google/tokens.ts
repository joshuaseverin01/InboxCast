import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseGrantedScopes } from "@/lib/googleAuth";

export type GoogleTokenDiagnostics = {
  hasSessionToken: boolean;
  hasGoogleToken: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  grantedScopes: string[];
  missingScopes: string[];
};

type AccessTokenResult =
  | {
      ok: true;
      accessToken: string;
      scope: string;
      diagnostics: GoogleTokenDiagnostics;
    }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "no_access_token"
        | "no_refresh_token"
        | "missing_scope"
        | "refresh_failed"
        | "misconfigured";
      diagnostics: GoogleTokenDiagnostics;
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

function diagnosticsFor({
  grantedScopesString,
  hasAccessToken,
  hasGoogleToken,
  hasRefreshToken,
  hasSessionToken,
  requiredScopes,
}: {
  hasSessionToken: boolean;
  hasGoogleToken: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  grantedScopesString?: string | null;
  requiredScopes: string[];
}): GoogleTokenDiagnostics {
  const grantedScopes = Array.from(parseGrantedScopes(grantedScopesString));

  return {
    grantedScopes,
    hasAccessToken,
    hasGoogleToken,
    hasRefreshToken,
    hasSessionToken,
    missingScopes: requiredScopes.filter((scope) => !grantedScopes.includes(scope)),
  };
}

async function refreshAccessToken({
  diagnostics,
  refreshToken,
  requiredScopes,
  scope,
}: {
  refreshToken: string;
  requiredScopes: string[];
  scope: string;
  diagnostics: GoogleTokenDiagnostics;
}): Promise<AccessTokenResult> {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return { diagnostics, ok: false, reason: "misconfigured" };
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
    return { diagnostics, ok: false, reason: "refresh_failed" };
  }

  const refreshedScope = payload.scope ?? scope;
  const refreshedDiagnostics = diagnosticsFor({
    grantedScopesString: refreshedScope,
    hasAccessToken: true,
    hasGoogleToken: true,
    hasRefreshToken: true,
    hasSessionToken: true,
    requiredScopes,
  });

  if (refreshedDiagnostics.missingScopes.length > 0) {
    return {
      diagnostics: refreshedDiagnostics,
      missingScopes: refreshedDiagnostics.missingScopes,
      ok: false,
      reason: "missing_scope",
    };
  }

  return {
    accessToken: payload.access_token,
    diagnostics: refreshedDiagnostics,
    ok: true,
    scope: refreshedScope,
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
    secret: process.env.AUTH_SECRET,
  });
  const grantedScopesString = token?.google?.scope ?? "";
  const diagnostics = diagnosticsFor({
    grantedScopesString,
    hasAccessToken: Boolean(token?.google?.accessToken),
    hasGoogleToken: Boolean(token?.google),
    hasRefreshToken: Boolean(token?.google?.refreshToken),
    hasSessionToken: Boolean(token),
    requiredScopes,
  });

  if (!token) {
    return { diagnostics, ok: false, reason: "not_authenticated" };
  }

  if (!token.google) {
    return { diagnostics, ok: false, reason: "no_access_token" };
  }

  if (diagnostics.missingScopes.length > 0) {
    return { diagnostics, missingScopes: diagnostics.missingScopes, ok: false, reason: "missing_scope" };
  }

  if (!token.google.accessToken) {
    if (!token.google.refreshToken) {
      return { diagnostics, ok: false, reason: "no_access_token" };
    }

    return refreshAccessToken({
      diagnostics,
      refreshToken: token.google.refreshToken,
      requiredScopes,
      scope: token.google.scope ?? "",
    });
  }

  if (isFresh(token.google.expiresAt)) {
    return {
      accessToken: token.google.accessToken,
      diagnostics,
      ok: true,
      scope: token.google.scope ?? "",
    };
  }

  if (!token.google.refreshToken) {
    return { diagnostics, ok: false, reason: "no_refresh_token" };
  }

  return refreshAccessToken({
    diagnostics,
    refreshToken: token.google.refreshToken,
    requiredScopes,
    scope: token.google.scope ?? "",
  });
}
