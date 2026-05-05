import { NextResponse, type NextRequest } from "next/server";
import { GoogleApiError, isGooglePermissionError, isGoogleRateLimitError } from "@/lib/google/fetch";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/googleAuth";
import { fetchCalendarEventsForRange, countCalendarConflicts } from "@/lib/google/calendar";
import { fetchGmailMetadataForRange } from "@/lib/google/gmail";
import { getGoogleAccessTokenForRequest } from "@/lib/google/tokens";
import type {
  BriefingContextErrorCode,
  BriefingContextErrorResponse,
  BriefingContextRequest,
  BriefingContextResponse,
} from "@/lib/google/types";

export const runtime = "nodejs";

const MAX_RANGE_DAYS = 31;

function scopeName(scope: string) {
  if (scope === GOOGLE_OAUTH_SCOPES.gmailMetadata) return "gmail.metadata";
  if (scope === GOOGLE_OAUTH_SCOPES.calendarEventsReadonly) return "calendar.events.readonly";
  if (scope === GOOGLE_OAUTH_SCOPES.gmailReadonly) return "gmail.readonly";
  if (scope === GOOGLE_OAUTH_SCOPES.gmailCompose) return "gmail.compose";
  return scope;
}

function safeTokenDiagnosticLog(
  reason: string,
  diagnostics: {
    hasSessionToken: boolean;
    hasGoogleToken: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    grantedScopes: string[];
    missingScopes: string[];
  },
) {
  console.info("[google:briefing-context] auth diagnostic", {
    grantedScopes: diagnostics.grantedScopes.map(scopeName),
    hasAccessToken: diagnostics.hasAccessToken,
    hasGoogleToken: diagnostics.hasGoogleToken,
    hasRefreshToken: diagnostics.hasRefreshToken,
    hasSessionToken: diagnostics.hasSessionToken,
    missingScopes: diagnostics.missingScopes.map(scopeName),
    reason,
  });
}

function missingScopeMessage(missingScopes: string[]) {
  const missingGmailMetadata = missingScopes.includes(GOOGLE_OAUTH_SCOPES.gmailMetadata);
  const missingCalendar = missingScopes.includes(GOOGLE_OAUTH_SCOPES.calendarEventsReadonly);

  if (missingGmailMetadata && missingCalendar) {
    return "Missing Gmail metadata and Calendar permissions. Reconnect Google and approve Gmail metadata and Calendar events read-only access.";
  }

  if (missingGmailMetadata) {
    return "Missing Gmail metadata permission. Reconnect Google and approve Gmail metadata access.";
  }

  if (missingCalendar) {
    return "Missing Calendar permission. Reconnect Google and approve Calendar events read-only access.";
  }

  return "Google token is missing required scopes for this request. Reconnect Google and approve the missing permissions.";
}

function errorResponse(
  code: BriefingContextErrorCode,
  message: string,
  status: number,
  options?: { reconnectRequired?: boolean; missingScopes?: string[] },
) {
  const body: BriefingContextErrorResponse = {
    error: {
      code,
      message,
      ...options,
    },
  };

  return NextResponse.json(body, { status });
}

function parseRange(payload: BriefingContextRequest): { start: Date; end: Date } | { error: string } {
  const start = new Date(payload.start);
  const end = new Date(payload.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { error: "Choose a valid start and end date." };
  }

  if (start >= end) {
    return { error: "The end time must be after the start time." };
  }

  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (days > MAX_RANGE_DAYS) {
    return { error: `Choose a range of ${MAX_RANGE_DAYS} days or less for this prototype.` };
  }

  return { start, end };
}

function normalizeFilters(payload: BriefingContextRequest) {
  return {
    includeCalendar: payload.filters?.includeCalendar !== false,
    includeNewsletters: payload.filters?.includeNewsletters !== false,
    includePromotions: payload.filters?.includePromotions === true,
    includeUnreadOnly: payload.filters?.includeUnreadOnly === true,
  };
}

function importantEmailCount(messages: BriefingContextResponse["gmail"]["messages"]) {
  return messages.filter((message) => message.labels.includes("IMPORTANT")).length;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as BriefingContextRequest;
    const parsed = parseRange(payload);

    if ("error" in parsed) {
      return errorResponse("BAD_REQUEST", parsed.error, 400);
    }

    const filters = normalizeFilters(payload);
    const requiredScopes = [
      GOOGLE_OAUTH_SCOPES.gmailMetadata,
      ...(filters.includeCalendar ? [GOOGLE_OAUTH_SCOPES.calendarEventsReadonly] : []),
    ];
    const token = await getGoogleAccessTokenForRequest(request, requiredScopes);

    if (!token.ok) {
      safeTokenDiagnosticLog(token.reason, token.diagnostics);

      if (token.reason === "missing_scope") {
        return errorResponse("MISSING_SCOPE", missingScopeMessage(token.missingScopes ?? []), 403, {
          missingScopes: token.missingScopes,
          reconnectRequired: true,
        });
      }

      if (token.reason === "not_authenticated") {
        return errorResponse("NOT_AUTHENTICATED", "Sign in with Google before fetching Gmail and Calendar context.", 401, {
          reconnectRequired: true,
        });
      }

      if (token.reason === "no_access_token") {
        return errorResponse("NO_ACCESS_TOKEN", "Google access token is missing. Sign out and reconnect Google.", 401, {
          reconnectRequired: true,
        });
      }

      if (token.reason === "no_refresh_token") {
        return errorResponse(
          "NO_REFRESH_TOKEN",
          "Google refresh token is missing. Sign out and reconnect Google so InboxCast can request offline access.",
          401,
          { reconnectRequired: true },
        );
      }

      if (token.reason === "refresh_failed") {
        return errorResponse("REFRESH_FAILED", "Google token refresh failed. Sign out and reconnect Google.", 401, {
          reconnectRequired: true,
        });
      }

      return errorResponse("SERVER_ERROR", "Google OAuth is not configured for this deployment.", 500);
    }

    const [gmail, calendarEvents] = await Promise.all([
      fetchGmailMetadataForRange({
        accessToken: token.accessToken,
        end: parsed.end,
        filters,
        start: parsed.start,
      }),
      filters.includeCalendar
        ? fetchCalendarEventsForRange({
            accessToken: token.accessToken,
            end: parsed.end,
            start: parsed.start,
          })
        : Promise.resolve([]),
    ]);

    const response: BriefingContextResponse = {
      calendar: {
        events: calendarEvents,
        skipped: !filters.includeCalendar,
      },
      fetchedAt: new Date().toISOString(),
      gmail,
      range: {
        end: parsed.end.toISOString(),
        start: parsed.start.toISOString(),
      },
      summary: {
        calendarConflictCount: countCalendarConflicts(calendarEvents),
        calendarEventCount: calendarEvents.length,
        emailCount: gmail.messages.length,
        importantEmailCount: importantEmailCount(gmail.messages),
        unreadEmailCount: gmail.messages.filter((message) => message.labels.includes("UNREAD")).length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof GoogleApiError) {
      const isRateLimited = isGoogleRateLimitError(error.status, error.message);

      if (isRateLimited) {
        return errorResponse("GOOGLE_RATE_LIMIT", "Google rate limit reached. Try again in a minute.", error.status, {
          reconnectRequired: false,
        });
      }

      if (isGooglePermissionError(error.status)) {
        return errorResponse(
          "GOOGLE_PERMISSION_ERROR",
          error.status === 401
            ? "Google API authentication failed. Sign out and reconnect Google."
            : "Google API permission error. Reconnect Google and approve the required Gmail and Calendar permissions.",
          error.status,
          { reconnectRequired: true },
        );
      }

      return errorResponse(
        "GOOGLE_API_ERROR",
        `Unknown Google API error while fetching briefing context. Status: ${error.status}.`,
        error.status,
        {
          reconnectRequired: error.reconnectRequired,
        },
      );
    }

    return errorResponse("SERVER_ERROR", "InboxCast could not fetch briefing context.", 500);
  }
}
