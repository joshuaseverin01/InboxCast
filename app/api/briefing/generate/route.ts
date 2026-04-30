import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { openAIProviderErrorMessage } from "@/lib/openai/errors";
import type {
  BriefingContextResponse,
  WrittenBriefing,
  WrittenBriefingErrorResponse,
  WrittenBriefingRequest,
  WrittenBriefingResponse,
} from "@/lib/google/types";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_BRIEFING_MODEL || "gpt-4o-mini";
const MAX_EMAILS = 20;
const MAX_EVENTS = 20;
const MAX_EMAIL_SNIPPET_CHARS = 280;
const MAX_CALENDAR_DESCRIPTION_CHARS = 300;

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function errorResponse(message: string, status: number) {
  const body: WrittenBriefingErrorResponse = { error: { message } };
  return NextResponse.json(body, { status });
}

function truncateText(value: string | undefined, maxLength: number) {
  if (!value) return value;
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value;
}

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function compactContext(context: BriefingContextResponse) {
  return {
    calendar: {
      events: context.calendar.events.slice(0, MAX_EVENTS).map((event) => ({
        descriptionSnippet: truncateText(event.descriptionSnippet, MAX_CALENDAR_DESCRIPTION_CHARS),
        end: event.end,
        location: event.location,
        start: event.start,
        title: event.title,
      })),
      skipped: context.calendar.skipped,
    },
    gmail: {
      messages: context.gmail.messages.slice(0, MAX_EMAILS).map((message) => ({
        date: message.date,
        from: message.from,
        labels: message.labels,
        snippet: truncateText(message.snippet, MAX_EMAIL_SNIPPET_CHARS),
        subject: message.subject,
        timestamp: message.timestamp,
      })),
      truncated: context.gmail.truncated,
    },
    range: context.range,
    summary: context.summary,
  };
}

function isWrittenBriefing(value: unknown): value is WrittenBriefing {
  if (!value || typeof value !== "object") return false;
  const briefing = value as Partial<Record<keyof WrittenBriefing, unknown>>;
  return (
    typeof briefing.intro === "string" &&
    Array.isArray(briefing.priorityEmails) &&
    Array.isArray(briefing.actionItems) &&
    Array.isArray(briefing.calendarContext) &&
    Array.isArray(briefing.lowPriorityFYI) &&
    Array.isArray(briefing.suggestedNextSteps) &&
    typeof briefing.fullTranscript === "string"
  );
}

const briefingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intro",
    "priorityEmails",
    "actionItems",
    "calendarContext",
    "lowPriorityFYI",
    "suggestedNextSteps",
    "fullTranscript",
  ],
  properties: {
    intro: { type: "string" },
    priorityEmails: { type: "array", items: { type: "string" } },
    actionItems: { type: "array", items: { type: "string" } },
    calendarContext: { type: "array", items: { type: "string" } },
    lowPriorityFYI: { type: "array", items: { type: "string" } },
    suggestedNextSteps: { type: "array", items: { type: "string" } },
    fullTranscript: { type: "string" },
  },
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return errorResponse("Sign in to generate a briefing.", 401);
  }

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("OPENAI_API_KEY is not configured.", 500);
  }

  try {
    const payload = (await request.json()) as WrittenBriefingRequest;

    if (!payload.context?.gmail || !payload.context?.calendar) {
      return errorResponse("Missing briefing context.", 400);
    }

    // Send only compact Gmail metadata, snippets, labels, and Calendar snippets to OpenAI.
    // This route does not fetch email bodies and does not persist user data server-side.
    const contextForOpenAI = compactContext(payload.context);

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content:
              "You write calm personal morning briefings from Gmail metadata and calendar event data. Use only the provided metadata, snippets, labels, and calendar snippets. Do not imply you read full email bodies. Do not draft or send emails. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Generate a written briefing transcript. Sound like a calm personal morning assistant. Prioritize likely important messages, action items, calendar pressure, low-priority FYIs, and next steps. If there is little data, say that plainly.",
              style: payload.style,
              context: contextForOpenAI,
            }),
          },
        ],
        max_output_tokens: 1400,
        model: MODEL,
        text: {
          format: {
            name: "written_briefing",
            schema: briefingSchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const openAiPayload = (await response.json().catch(() => ({}))) as OpenAIResponse;

    if (!response.ok) {
      return errorResponse(
        openAIProviderErrorMessage(
          response.status,
          "OpenAI could not generate the briefing. Check server OpenAI configuration and model access.",
          openAiPayload,
        ),
        response.status,
      );
    }

    const outputText = extractOutputText(openAiPayload);
    const parsed = JSON.parse(outputText) as unknown;

    if (!isWrittenBriefing(parsed)) {
      return errorResponse("OpenAI returned an unexpected briefing shape.", 502);
    }

    const body: WrittenBriefingResponse = { briefing: parsed };
    return NextResponse.json(body);
  } catch {
    return errorResponse("InboxCast could not generate the written briefing.", 500);
  }
}
