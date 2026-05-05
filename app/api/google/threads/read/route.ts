import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { GoogleApiError } from "@/lib/google/fetch";
import { fetchSelectedGmailThread } from "@/lib/google/gmail";
import { getGoogleAccessTokenForRequest } from "@/lib/google/tokens";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/googleAuth";

export const runtime = "nodejs";

type ReadThreadRequest = {
  threadId?: unknown;
};

type ThreadIdResult = { threadId: string } | { error: string };

const threadIdPattern = /^[A-Za-z0-9_-]+$/;

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

function parseThreadId(payload: ReadThreadRequest): ThreadIdResult {
  if (typeof payload.threadId !== "string") return { error: "Choose a thread to read." };

  const threadId = payload.threadId.trim();
  if (!threadId) return { error: "Choose a thread to read." };
  if (!threadIdPattern.test(threadId)) return { error: "Gmail thread ID was invalid." };

  return { threadId };
}

export async function POST(request: NextRequest) {
  // Full thread content is fetched only after explicit user approval. Tokens stay server-side;
  // Gmail readonly does not send, modify, archive, delete, or mark messages read.
  const [session, token] = await Promise.all([
    auth(),
    getGoogleAccessTokenForRequest(request, [GOOGLE_OAUTH_SCOPES.gmailReadonly]),
  ]);

  if (!session?.user?.email) {
    return errorResponse("Sign in before reading a selected Gmail thread.", 401, { reconnectRequired: true });
  }

  if (!token.ok) {
    if (token.reason === "missing_scope") {
      return errorResponse("To read full threads, reconnect Google and approve Gmail read-only permission.", 403, {
        missingScopes: token.missingScopes,
        reconnectRequired: true,
      });
    }

    return errorResponse("Reconnect Google account before reading a selected thread.", 401, {
      reconnectRequired: true,
    });
  }

  const payload = (await request.json().catch(() => null)) as ReadThreadRequest | null;
  if (!payload) return errorResponse("Selected thread request was not valid JSON.", 400);

  const parsed = parseThreadId(payload);
  if ("error" in parsed) return errorResponse(parsed.error, 400);

  try {
    const thread = await fetchSelectedGmailThread({
      accessToken: token.accessToken,
      threadId: parsed.threadId,
      userEmail: session.user.email,
    });

    if (thread.messages.length === 0) return errorResponse("Gmail returned an empty thread.", 404);

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return errorResponse("Gmail API could not read the selected thread.", error.status, {
        reconnectRequired: error.reconnectRequired,
      });
    }

    return errorResponse("InboxCast could not read the selected thread.", 500);
  }
}
