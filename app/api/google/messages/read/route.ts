import { NextResponse, type NextRequest } from "next/server";
import { GoogleApiError } from "@/lib/google/fetch";
import { fetchSelectedGmailFullMessages } from "@/lib/google/gmail";
import { getGoogleAccessTokenForRequest } from "@/lib/google/tokens";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/googleAuth";

export const runtime = "nodejs";

type ReadMessagesRequest = {
  messageIds?: unknown;
};

type MessageIdsResult = { messageIds: string[] } | { error: string };
type TokenFailure = Extract<Awaited<ReturnType<typeof getGoogleAccessTokenForRequest>>, { ok: false }>;

const MAX_MESSAGES_PER_READ = 3;
const messageIdPattern = /^[A-Za-z0-9_-]+$/;

function errorResponse(message: string, status: number, options?: { reconnectRequired?: boolean; missingScopes?: string[] }) {
  return NextResponse.json(
    {
      error: {
        message,
        ...options,
      },
    },
    { status },
  );
}

function tokenErrorResponse(token: TokenFailure) {
  if (token.reason === "missing_scope") {
    return errorResponse("To read full email content, reconnect Google and approve Gmail read-only permission.", 403, {
      missingScopes: token.missingScopes,
      reconnectRequired: true,
    });
  }

  if (token.reason === "not_authenticated") {
    return errorResponse("Sign in before reading selected emails.", 401, { reconnectRequired: true });
  }

  if (token.reason === "no_access_token") {
    return errorResponse("Google access token is missing. Sign out and reconnect Google.", 401, {
      reconnectRequired: true,
    });
  }

  if (token.reason === "no_refresh_token" || token.reason === "refresh_failed") {
    return errorResponse("Google token refresh failed. Sign out and reconnect Google.", 401, {
      reconnectRequired: true,
    });
  }

  return errorResponse("Google OAuth is not configured for this deployment.", 500);
}

function parseMessageIds(payload: ReadMessagesRequest): MessageIdsResult {
  if (!Array.isArray(payload.messageIds)) {
    return { error: "Choose one to three emails to read." };
  }

  const messageIds = Array.from(
    new Set(payload.messageIds.filter((id): id is string => typeof id === "string").map((id) => id.trim())),
  ).filter(Boolean);

  if (messageIds.length === 0) {
    return { error: "Choose at least one email to read." };
  }

  if (messageIds.length > MAX_MESSAGES_PER_READ) {
    return { error: `Choose up to ${MAX_MESSAGES_PER_READ} emails at a time.` };
  }

  if (messageIds.some((id) => !messageIdPattern.test(id))) {
    return { error: "One or more Gmail message IDs were invalid." };
  }

  return { messageIds };
}

export async function POST(request: NextRequest) {
  // Full email bodies require explicit user selection and gmail.readonly; tokens stay server-side.
  const token = await getGoogleAccessTokenForRequest(request, [GOOGLE_OAUTH_SCOPES.gmailReadonly]);

  if (!token.ok) {
    return tokenErrorResponse(token);
  }

  const payload = (await request.json().catch(() => null)) as ReadMessagesRequest | null;
  if (!payload) return errorResponse("Selected email request was not valid JSON.", 400);

  const parsed = parseMessageIds(payload);
  if ("error" in parsed) return errorResponse(parsed.error, 400);

  try {
    const messages = await fetchSelectedGmailFullMessages({
      accessToken: token.accessToken,
      messageIds: parsed.messageIds,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return errorResponse("Gmail API could not read the selected email content.", error.status, {
        reconnectRequired: error.reconnectRequired,
      });
    }

    return errorResponse("InboxCast could not read the selected email content.", 500);
  }
}
