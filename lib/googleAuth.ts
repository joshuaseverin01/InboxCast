import type { Session } from "next-auth";

export const GOOGLE_OAUTH_SCOPES = {
  openid: "openid",
  email: "email",
  profile: "profile",
  gmailMetadata: "https://www.googleapis.com/auth/gmail.metadata",
  gmailCompose: "https://www.googleapis.com/auth/gmail.compose",
  gmailReadonly: "https://www.googleapis.com/auth/gmail.readonly",
  calendarEventsReadonly: "https://www.googleapis.com/auth/calendar.events.readonly",
} as const;

export const GOOGLE_REQUIRED_SCOPES = [
  GOOGLE_OAUTH_SCOPES.openid,
  GOOGLE_OAUTH_SCOPES.email,
  GOOGLE_OAUTH_SCOPES.profile,
  GOOGLE_OAUTH_SCOPES.gmailMetadata,
  GOOGLE_OAUTH_SCOPES.gmailCompose,
  GOOGLE_OAUTH_SCOPES.gmailReadonly,
  GOOGLE_OAUTH_SCOPES.calendarEventsReadonly,
] as const;

export const GOOGLE_SCOPE_DESCRIPTIONS = [
  {
    scope: GOOGLE_OAUTH_SCOPES.gmailMetadata,
    label: "Gmail metadata",
    description: "Read message IDs, labels, thread IDs, and headers only. No email bodies or attachments.",
  },
  {
    scope: GOOGLE_OAUTH_SCOPES.gmailCompose,
    label: "Gmail draft creation",
    description: "Create user-approved Gmail drafts only. InboxCast cannot send emails.",
  },
  {
    scope: GOOGLE_OAUTH_SCOPES.gmailReadonly,
    label: "Selected email read-only",
    description: "Read full content only for messages you explicitly select. No send or modify permission.",
  },
  {
    scope: GOOGLE_OAUTH_SCOPES.calendarEventsReadonly,
    label: "Calendar events read-only",
    description: "Read calendar event context for briefings. No calendar edits, creates, or deletes.",
  },
];

export type GoogleConnectionState = {
  signedIn: boolean;
  connected: boolean;
  hasAllRequiredScopes: boolean;
  hasBriefingScopes: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  gmailConnected: boolean;
  gmailDraftConnected: boolean;
  gmailReadonlyConnected: boolean;
  calendarConnected: boolean;
  email: string | null;
  name: string | null;
  image: string | null;
  grantedScopes: string[];
  missingScopes: string[];
  missingBriefingScopes: string[];
  expiresAt?: number;
};

export function getGoogleOAuthScopeString() {
  return GOOGLE_REQUIRED_SCOPES.join(" ");
}

export function getGoogleOAuthAuthorizationParams() {
  return {
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    response_type: "code",
    scope: getGoogleOAuthScopeString(),
  };
}

export function hasGoogleOAuthCredentials() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function parseGrantedScopes(scope?: string | null) {
  return new Set((scope ?? "").split(/\s+/).filter(Boolean));
}

export function getGoogleConnectionState(session: Session | null): GoogleConnectionState {
  const granted = parseGrantedScopes(session?.google?.grantedScopes);
  const missingScopes = GOOGLE_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
  const briefingScopes = [GOOGLE_OAUTH_SCOPES.gmailMetadata, GOOGLE_OAUTH_SCOPES.calendarEventsReadonly];
  const missingBriefingScopes = briefingScopes.filter((scope) => !granted.has(scope));
  const gmailConnected = granted.has(GOOGLE_OAUTH_SCOPES.gmailMetadata);
  const gmailDraftConnected = granted.has(GOOGLE_OAUTH_SCOPES.gmailCompose);
  const gmailReadonlyConnected = granted.has(GOOGLE_OAUTH_SCOPES.gmailReadonly);
  const calendarConnected = granted.has(GOOGLE_OAUTH_SCOPES.calendarEventsReadonly);
  const hasAccessToken = Boolean(session?.google?.hasAccessToken ?? session?.google?.connected);
  const hasRefreshToken = Boolean(session?.google?.hasRefreshToken);
  const signedIn = Boolean(session?.user?.email);

  return {
    signedIn,
    connected: signedIn && hasAccessToken,
    hasAccessToken,
    hasAllRequiredScopes: signedIn && hasAccessToken && missingScopes.length === 0,
    hasBriefingScopes: signedIn && hasAccessToken && missingBriefingScopes.length === 0,
    hasRefreshToken,
    gmailConnected,
    gmailDraftConnected,
    gmailReadonlyConnected,
    calendarConnected,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    grantedScopes: Array.from(granted),
    missingBriefingScopes,
    missingScopes,
    expiresAt: session?.google?.expiresAt,
  };
}
