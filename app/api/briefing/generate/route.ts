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

const priorityCategories = [
  "Needs response",
  "Possible task",
  "Calendar/scheduling related",
  "Important FYI",
  "Low priority / newsletter / promotion",
] as const;

const styleGuidance: Record<string, string> = {
  "casual podcast":
    "Conversational and warm, but not fluffy. Use natural spoken transitions and keep the briefing useful.",
  concise:
    "Short and direct. Prefer compact bullets and only the most important context.",
  detailed:
    "Include more explanation about why items matter, while staying grounded in the available snippet evidence.",
  executive:
    "Priority and action focused. Lead with decisions, response needs, risks, and calendar pressure.",
};

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

function textIncludesAny(value: string, patterns: string[]) {
  const lowerValue = value.toLowerCase();
  return patterns.some((pattern) => lowerValue.includes(pattern));
}

function categoryHints(message: BriefingContextResponse["gmail"]["messages"][number]) {
  const labels = message.labels ?? [];
  const text = `${message.from} ${message.subject} ${message.snippet ?? ""}`;
  const categories: string[] = [];

  if (
    labels.includes("CATEGORY_PROMOTIONS") ||
    labels.includes("CATEGORY_SOCIAL") ||
    textIncludesAny(text, ["unsubscribe", "newsletter", "digest", "sale", "promo", "webinar"])
  ) {
    categories.push("Low priority / newsletter / promotion");
  }

  if (
    textIncludesAny(text, [
      "can you",
      "could you",
      "please",
      "reply",
      "respond",
      "let me know",
      "confirm",
      "approve",
      "review",
      "feedback",
      "send me",
      "thoughts",
    ])
  ) {
    categories.push("Needs response");
  }

  if (
    textIncludesAny(text, [
      "todo",
      "to do",
      "action",
      "follow up",
      "deadline",
      "due",
      "by end of",
      "next step",
      "review",
      "approve",
      "send",
      "prepare",
    ])
  ) {
    categories.push("Possible task");
  }

  if (
    textIncludesAny(text, [
      "meeting",
      "calendar",
      "schedule",
      "reschedule",
      "invite",
      "call",
      "sync",
      "1:1",
      "appointment",
      "conflict",
      "availability",
    ])
  ) {
    categories.push("Calendar/scheduling related");
  }

  if (labels.includes("IMPORTANT") || labels.includes("CATEGORY_PRIMARY")) {
    categories.push("Important FYI");
  }

  return Array.from(new Set(categories.length > 0 ? categories : ["Important FYI"]));
}

function categoryReason(message: BriefingContextResponse["gmail"]["messages"][number]) {
  const hints = categoryHints(message);
  if (message.snippet) return `Hints: ${hints.join(", ")}. Evidence is limited to subject and snippet.`;
  return `Hints: ${hints.join(", ")}. No snippet was available, so confidence should be low.`;
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
        categoryHints: categoryHints(message),
        categoryReason: categoryReason(message),
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

function emptyBriefing(context: BriefingContextResponse, style: WrittenBriefingRequest["style"]): WrittenBriefing {
  const start = new Date(context.range.start).toLocaleString();
  const end = new Date(context.range.end).toLocaleString();
  const calendarLine = context.calendar.skipped
    ? "Calendar was not included for this briefing."
    : "No calendar events were returned for this range.";
  const styleLine =
    style === "casual podcast"
      ? "Nice and quiet: there is nothing new to narrate in this window."
      : "There is nothing new that needs attention in this window.";

  return {
    actionItems: [],
    calendarContext: [],
    fullTranscript: [
      "Good morning.",
      `${styleLine} InboxCast found no Gmail messages between ${start} and ${end}. ${calendarLine}`,
      "Top priorities: none.",
      "Items that may need a response: none.",
      "Possible tasks: none.",
      "Calendar or scheduling notes: none.",
      "Low-priority FYIs: none.",
      "Suggested next steps: you can widen the time range or continue with your day.",
      "That is the full briefing for now.",
    ].join("\n\n"),
    intro: styleLine,
    lowPriorityFYI: [],
    priorityEmails: [],
    suggestedNextSteps: ["No action needed. Try a wider time range if you expected email or calendar activity."],
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
    intro: {
      type: "string",
      description: "One calm, specific opening sentence grounded in the available email snippets and calendar events.",
    },
    priorityEmails: {
      type: "array",
      description:
        "Important email items as strings prefixed with one category: Needs response, Possible task, Calendar/scheduling related, Important FYI, or Low priority / newsletter / promotion.",
      items: { type: "string" },
    },
    actionItems: {
      type: "array",
      description:
        "Possible actions. Each string must include Source sender, Source subject, Suggested action, Confidence high/medium/low, and reason for confidence.",
      items: { type: "string" },
    },
    calendarContext: {
      type: "array",
      description: "Only relevant calendar pressure, conflicts, preparation needs, or scheduling context.",
      items: { type: "string" },
    },
    lowPriorityFYI: {
      type: "array",
      description: "Newsletters, promotions, passive updates, or items that likely do not need action.",
      items: { type: "string" },
    },
    suggestedNextSteps: {
      type: "array",
      description:
        "Short practical next steps. Reply suggestions should be directions, not full drafts, unless the snippet clearly supports a short response.",
      items: { type: "string" },
    },
    fullTranscript: {
      type: "string",
      description:
        "A complete readable transcript with greeting, overview, top priorities, response needs, tasks, calendar notes, FYIs, next steps, and closing.",
    },
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

    // Briefings are based only on Gmail metadata/snippets and Calendar snippets, not full email bodies.
    // This route does not fetch email bodies and does not persist user data server-side.
    const contextForOpenAI = compactContext(payload.context);

    if (
      contextForOpenAI.gmail.messages.length === 0 &&
      contextForOpenAI.calendar.events.length === 0
    ) {
      return NextResponse.json({ briefing: emptyBriefing(payload.context, payload.style) });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content: [
              "You write calm, useful personal morning briefings from Gmail message headers/snippets and Google Calendar event snippets.",
              "You have not read full email bodies. Never claim that you have.",
              "Use sender, subject, timestamp, labels, provided category hints, and snippets carefully. If the snippet is vague or missing, say there is not enough information and lower confidence.",
              "Do not invent deadlines, obligations, relationships, reply content, or urgency. Do not overstate importance.",
              "Do not mention 'metadata' awkwardly to the user; say 'from the subject and snippet' only when a caveat is needed.",
              "Classify emails using exactly these categories when relevant: Needs response, Possible task, Calendar/scheduling related, Important FYI, Low priority / newsletter / promotion.",
              "For actionItems, every item must include: Source sender, Source subject, Suggested action, Confidence high/medium/low, Reason for confidence.",
              "Reply suggestions should be short directions, not full replies, unless the subject/snippet clearly supports a short response. Never pretend to know missing context.",
              "Include calendar context only when it affects the user's day, creates pressure, conflicts, preparation needs, or scheduling decisions.",
              "Keep private-looking details out of the transcript unless they are necessary to understand the action.",
              "If there are no emails and no calendar events, produce a calm empty briefing with no action items.",
              "Return JSON only.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction: [
                "Generate a written briefing that sounds like a calm personal morning assistant: useful, specific, and not generic podcast filler.",
                "Prioritize what actually matters. Clearly separate urgent items from FYIs.",
                "The fullTranscript must use this structure: short greeting; quick overview of email volume and calendar context; top priorities; items that may need a response; possible tasks; calendar/scheduling notes; low-priority FYIs; suggested next steps; short closing.",
                "The priorityEmails array should group important emails by category and include sender, subject, timestamp, and evidence from the snippet.",
                "The actionItems array should only include plausible actions. If evidence is weak, include the item with low confidence or omit it.",
                "The lowPriorityFYI array should capture newsletters, promotions, digests, and passive updates.",
                "The suggestedNextSteps array should be short and practical, including response direction when a reply seems likely.",
              ].join(" "),
              priorityCategories,
              style: payload.style,
              styleGuidance: styleGuidance[payload.style],
              context: contextForOpenAI,
            }),
          },
        ],
        max_output_tokens: 1800,
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
