import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseGrantedScopes } from "@/lib/googleAuth";

type AccessTokenResult =
  | {
      ok: true;
      accessToken: string;
      scope: string;
    }
  | {
      ok: false;
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

async function refreshAccessToken(refreshToken: string): Promise<AccessTokenResult> {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return { ok: false, reason: "misconfigured" };
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
    return { ok: false, reason: "refresh_failed" };
  }

  return {
    ok: true,
    accessToken: payload.access_token,
    scope: payload.scope ?? "",
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
  const grantedScopes = parseGrantedScopes(grantedScopesString);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));

  if (!token?.google?.accessToken) {
    return { ok: false, reason: "not_connected" };
  }

  if (missingScopes.length > 0) {
    return { ok: false, reason: "missing_scope", missingScopes };
  }

  if (isFresh(token.google.expiresAt)) {
    return {
      ok: true,
      accessToken: token.google.accessToken,
      scope: token.google.scope ?? "",
    };
  }

  if (!token.google.refreshToken) {
    return { ok: false, reason: "refresh_failed" };
  }

  return refreshAccessToken(token.google.refreshToken);
}
