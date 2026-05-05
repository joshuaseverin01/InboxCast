import { NextResponse, type NextRequest } from "next/server";
import { GoogleApiError } from "@/lib/google/fetch";
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
      if (token.reason === "missing_scope") {
        return errorResponse("MISSING_SCOPE", "Google token is missing required scopes for this request.", 403, {
          missingScopes: token.missingScopes,
          reconnectRequired: true,
        });
      }

      return errorResponse(
        token.reason === "not_connected" ? "NOT_CONNECTED" : "REFRESH_FAILED",
        "Reconnect Google account to fetch Gmail and Calendar context.",
        401,
        { reconnectRequired: true },
      );
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
      const isRateLimited =
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("too many concurrent requests");

      return errorResponse("GOOGLE_API_ERROR", `Google API error: ${error.message}`, error.status, {
        reconnectRequired: error.reconnectRequired && !isRateLimited,
      });
    }

    return errorResponse("SERVER_ERROR", "InboxCast could not fetch briefing context.", 500);
  }
}
