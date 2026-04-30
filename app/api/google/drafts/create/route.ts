import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/googleAuth";
import { getGoogleAccessTokenForRequest } from "@/lib/google/tokens";

export const runtime = "nodejs";

type DraftRequest = {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: unknown;
  body?: unknown;
};

type GmailDraftResponse = {
  id?: string;
};

type ValidDraft = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
};

type ValidationResult = { ok: true; draft: ValidDraft } | { ok: false; error: string };

type RecipientParseResult = { recipients: string[] } | { error: string };

const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 20_000;
const recipientPattern = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;

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

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function rejectHeaderInjection(value: string) {
  return /[\r\n]/.test(value);
}

function parseRecipients(value: string, required: boolean): RecipientParseResult {
  const recipients = value
    .split(/[;,]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  if (required && recipients.length === 0) {
    return { error: "Add at least one recipient before creating a Gmail draft." };
  }

  const invalid = recipients.find((recipient) => rejectHeaderInjection(recipient) || !recipientPattern.test(recipient));
  if (invalid) {
    return { error: "Use plain recipient email addresses like name@example.com." };
  }

  return { recipients };
}

function encodeHeaderValue(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMessage({
  bcc,
  body,
  cc,
  subject,
  to,
}: {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}) {
  const headers = [
    `To: ${to.join(", ")}`,
    ...(cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
    ...(bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${encodeHeaderValue(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];

  return toBase64Url(`${headers.join("\r\n")}\r\n\r\n${body.replace(/\r?\n/g, "\r\n")}`);
}

function validatePayload(payload: DraftRequest): ValidationResult {
  const to = parseRecipients(asText(payload.to), true);
  if ("error" in to) return { error: to.error, ok: false };

  const cc = parseRecipients(asText(payload.cc), false);
  if ("error" in cc) return { error: cc.error, ok: false };

  const bcc = parseRecipients(asText(payload.bcc), false);
  if ("error" in bcc) return { error: bcc.error, ok: false };

  const subject = asText(payload.subject);
  if (!subject) return { error: "Add a subject before creating a Gmail draft.", ok: false };
  if (rejectHeaderInjection(subject)) return { error: "Subject cannot contain line breaks.", ok: false };
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { error: `Keep the subject under ${MAX_SUBJECT_LENGTH} characters.`, ok: false };
  }

  const body = asText(payload.body);
  if (!body) return { error: "Add a body before creating a Gmail draft.", ok: false };
  if (body.length > MAX_BODY_LENGTH) {
    return { error: `Keep the draft body under ${MAX_BODY_LENGTH} characters.`, ok: false };
  }

  return {
    draft: {
      bcc: bcc.recipients,
      body,
      cc: cc.recipients,
      subject,
      to: to.recipients,
    },
    ok: true,
  };
}

export async function POST(request: NextRequest) {
  // Draft creation uses gmail.compose only and never calls Gmail send; token values stay server-side.
  const token = await getGoogleAccessTokenForRequest(request, [GOOGLE_OAUTH_SCOPES.gmailCompose]);

  if (!token.ok) {
    if (token.reason === "missing_scope") {
      return errorResponse("To create Gmail drafts, reconnect Google and approve Gmail draft permission.", 403, {
        missingScopes: token.missingScopes,
        reconnectRequired: true,
      });
    }

    if (token.reason === "misconfigured") {
      return errorResponse("Google OAuth is not configured for this deployment.", 500);
    }

    return errorResponse("Reconnect Google account before creating Gmail drafts.", 401, {
      reconnectRequired: true,
    });
  }

  const payload = (await request.json().catch(() => null)) as DraftRequest | null;
  if (!payload) return errorResponse("Draft request was not valid JSON.", 400);

  const draft = validatePayload(payload);
  if (!draft.ok) return errorResponse(draft.error, 400);

  // Validate recipients and subject before RFC 2822 encoding to prevent malformed headers.
  const raw = buildRawMessage(draft.draft);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    body: JSON.stringify({ message: { raw } }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return errorResponse("Reconnect Google account before creating Gmail drafts.", 401, {
        reconnectRequired: true,
      });
    }

    if (response.status === 403) {
      return errorResponse("To create Gmail drafts, reconnect Google and approve Gmail draft permission.", 403, {
        missingScopes: [GOOGLE_OAUTH_SCOPES.gmailCompose],
        reconnectRequired: true,
      });
    }

    return errorResponse("Gmail API could not create the draft. Try again from Outputs.", response.status);
  }

  const createdDraft = (await response.json().catch(() => ({}))) as GmailDraftResponse;

  return NextResponse.json({
    draftId: createdDraft.id ?? "",
    success: true,
  });
}
