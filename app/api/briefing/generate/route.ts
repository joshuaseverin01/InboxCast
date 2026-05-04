import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { openAIProviderErrorMessage } from "@/lib/openai/errors";
import type {
  BriefingFocus,
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
const DEFAULT_FOCUS: BriefingFocus = "skip_low_priority";

const priorityCategories = [
  "Urgent / time-sensitive",
  "Needs response",
  "Possible task",
  "Calendar/scheduling related",
  "Interesting but not urgent",
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

const focusGuidance: Record<BriefingFocus, string> = {
  action_only:
    "Only include urgent or time-sensitive items, emails likely needing response, possible tasks, and immediate calendar/scheduling issues. Exclude newsletters, promotions, passive updates, interesting-but-not-actionable emails, and low-priority FYIs. Keep the transcript especially short.",
  full:
    "Use the standard full structure: priority emails, action items, relevant calendar context, low-priority FYIs, and next steps. Still summarize groups instead of reading every email one by one.",
  skip_low_priority:
    "Include top priorities, response-needed emails, tasks, important FYIs, and relevant calendar context. Exclude or compress newsletters, promotions, automated updates, and low-priority FYIs. This is the default audio-friendly mode.",
};

const focusItemGuidance: Record<BriefingFocus, string> = {
  action_only:
    "Mention only the most important 3 to 5 actionable items. If no clear urgent/actionable items exist, say: No clear action items found for this range.",
  full:
    "Mention the most important 3 to 7 items, then group lower-priority emails together if useful.",
  skip_low_priority:
    "Mention the most important 3 to 5 items. Add a short omitted low-priority sentence only if newsletters, promotions, or automated updates were skipped.",
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

const urgentPatterns = [
  "urgent",
  "asap",
  "today",
  "tomorrow",
  "deadline",
  "due today",
  "due tomorrow",
  "action required",
  "time sensitive",
  "by end of day",
];

const responsePatterns = [
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
  "are you available",
  "would you",
];

const taskPatterns = [
  "todo",
  "to do",
  "action",
  "follow up",
  "next step",
  "review",
  "approve",
  "send",
  "prepare",
  "finish",
  "complete",
  "fill out",
];

const schedulingPatterns = [
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
  "available",
  "zoom",
  "agenda",
  "interview",
];

const lowPriorityPatterns = [
  "unsubscribe",
  "newsletter",
  "digest",
  "sale",
  "offer",
  "promo",
  "promotion",
  "webinar",
  "event invite",
  "weekly update",
  "monthly update",
  "receipt",
  "invoice paid",
  "social notification",
  "new post",
];

const automatedSenderPatterns = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "notifications@",
  "notification@",
  "newsletter@",
  "marketing@",
  "updates@",
  "support@",
];

const lowPriorityLabels = [
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "CATEGORY_SOCIAL",
  "PROMOTIONS",
];

function senderLooksAutomated(from: string) {
  return textIncludesAny(from, automatedSenderPatterns);
}

function messageText(message: BriefingContextResponse["gmail"]["messages"][number]) {
  return `${message.from} ${message.subject} ${message.snippet ?? ""}`;
}

function hasNearbyCalendarEvent(
  message: BriefingContextResponse["gmail"]["messages"][number],
  events: BriefingContextResponse["calendar"]["events"],
) {
  const emailTime = new Date(message.timestamp).getTime();
  if (!Number.isFinite(emailTime)) return false;

  return events.some((event) => {
    const eventTime = new Date(event.start).getTime();
    if (!Number.isFinite(eventTime)) return false;
    const hoursFromEmail = Math.abs(eventTime - emailTime) / (60 * 60 * 1000);
    return hoursFromEmail <= 48;
  });
}

function buildPriorityProfile(
  message: BriefingContextResponse["gmail"]["messages"][number],
  events: BriefingContextResponse["calendar"]["events"],
) {
  const labels = message.labels ?? [];
  const text = messageText(message);
  const categories = new Set<string>();
  const prioritySignals: string[] = [];
  const lowPrioritySignals: string[] = [];
  let priorityScore = 0;

  if (
    labels.some((label) => lowPriorityLabels.includes(label)) ||
    message.hasListUnsubscribe ||
    textIncludesAny(text, lowPriorityPatterns)
  ) {
    categories.add("Low priority / newsletter / promotion");
    lowPrioritySignals.push("newsletter, promotion, list, or automated category signal");
    priorityScore -= 4;
  }

  if (senderLooksAutomated(message.from)) {
    lowPrioritySignals.push("sender appears automated");
    priorityScore -= 2;
  } else {
    prioritySignals.push("sender appears to be a person");
    priorityScore += 1;
  }

  if (labels.includes("IMPORTANT")) {
    categories.add("Important FYI");
    prioritySignals.push("Gmail marked important");
    priorityScore += 2;
  }

  if (labels.includes("CATEGORY_PRIMARY")) {
    prioritySignals.push("Gmail primary category");
    priorityScore += 1;
  }

  if (textIncludesAny(text, urgentPatterns)) {
    categories.add("Urgent / time-sensitive");
    prioritySignals.push("time-sensitive wording");
    priorityScore += 4;
  }

  if (textIncludesAny(text, responsePatterns) || /\?/.test(message.subject) || /\?/.test(message.snippet ?? "")) {
    categories.add("Needs response");
    prioritySignals.push("question or response-request wording");
    priorityScore += 3;
  }

  if (textIncludesAny(text, taskPatterns) || textIncludesAny(text, ["deadline", "due", "by end of"])) {
    categories.add("Possible task");
    prioritySignals.push("task or follow-up wording");
    priorityScore += 3;
  }

  if (textIncludesAny(text, schedulingPatterns)) {
    categories.add("Calendar/scheduling related");
    prioritySignals.push("calendar or scheduling wording");
    priorityScore += 2;

    if (hasNearbyCalendarEvent(message, events)) {
      prioritySignals.push("scheduling language near a calendar event window");
      priorityScore += 1;
    }
  }

  if (/^(re|fw|fwd):/i.test(message.subject)) {
    prioritySignals.push("reply or forwarded thread");
    priorityScore += 1;
  }

  if (categories.size === 0) {
    categories.add(priorityScore > 1 ? "Interesting but not urgent" : "Important FYI");
  }

  const likelyLowPriority =
    categories.has("Low priority / newsletter / promotion") &&
    !categories.has("Needs response") &&
    !categories.has("Possible task") &&
    !categories.has("Calendar/scheduling related");

  if (likelyLowPriority) {
    priorityScore = Math.min(priorityScore, 0);
  }

  return {
    categoryHints: Array.from(categories),
    categoryReason: message.snippet
      ? `Hints: ${Array.from(categories).join(", ")}. Evidence is limited to subject and snippet.`
      : `Hints: ${Array.from(categories).join(", ")}. No snippet was available, so confidence should be low.`,
    likelyLowPriority,
    lowPrioritySignals,
    priorityScore,
    prioritySignals,
  };
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
  const compactEvents = context.calendar.events.slice(0, MAX_EVENTS).map((event) => ({
    descriptionSnippet: truncateText(event.descriptionSnippet, MAX_CALENDAR_DESCRIPTION_CHARS),
    end: event.end,
    location: event.location,
    start: event.start,
    title: event.title,
  }));
  const compactMessages = context.gmail.messages
    .slice(0, MAX_EMAILS)
    .map((message) => {
      const profile = buildPriorityProfile(message, context.calendar.events);

      return {
        categoryHints: profile.categoryHints,
        categoryReason: profile.categoryReason,
        date: message.date,
        from: message.from,
        labels: message.labels,
        likelyLowPriority: profile.likelyLowPriority,
        lowPrioritySignals: profile.lowPrioritySignals,
        priorityScore: profile.priorityScore,
        prioritySignals: profile.prioritySignals,
        snippet: truncateText(message.snippet, MAX_EMAIL_SNIPPET_CHARS),
        subject: message.subject,
        timestamp: message.timestamp,
      };
    })
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

  return {
    calendar: {
      events: compactEvents,
      skipped: context.calendar.skipped,
    },
    gmail: {
      messages: compactMessages,
      truncated: context.gmail.truncated,
    },
    range: context.range,
    summary: context.summary,
  };
}

function emptyBriefing(
  context: BriefingContextResponse,
  style: WrittenBriefingRequest["style"],
  focus: BriefingFocus,
): WrittenBriefing {
  const start = new Date(context.range.start).toLocaleString();
  const end = new Date(context.range.end).toLocaleString();
  const calendarLine = context.calendar.skipped
    ? "Calendar was not included for this briefing."
    : "No calendar events were returned for this range.";
  const styleLine =
    focus === "action_only"
      ? "No clear action items found for this range."
      : style === "casual podcast"
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

function normalizeFocus(value: unknown): BriefingFocus {
  return value === "full" || value === "action_only" || value === "skip_low_priority" ? value : DEFAULT_FOCUS;
}

function applyFocusGuardrails(briefing: WrittenBriefing, focus: BriefingFocus): WrittenBriefing {
  if (focus === "full") return briefing;

  const next: WrittenBriefing = {
    ...briefing,
    lowPriorityFYI: [],
  };

  if (
    focus === "action_only" &&
    briefing.priorityEmails.length === 0 &&
    briefing.actionItems.length === 0 &&
    briefing.calendarContext.length === 0
  ) {
    return {
      actionItems: [],
      calendarContext: [],
      fullTranscript: [
        "Good morning.",
        "No clear action items found for this range.",
        "I skipped newsletters, promotional updates, and passive FYIs.",
        "Suggested next steps: nothing needs an immediate reply from the available subject and snippet data.",
        "That is the action-only briefing.",
      ].join("\n\n"),
      intro: "No clear action items found for this range.",
      lowPriorityFYI: [],
      priorityEmails: [],
      suggestedNextSteps: ["No immediate action found from the available subject and snippet data."],
    };
  }

  return next;
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
        "Important email items as strings prefixed with one category: Urgent / time-sensitive, Needs response, Possible task, Calendar/scheduling related, Interesting but not urgent, Important FYI, or Low priority / newsletter / promotion. Needs-response items must include why, suggested response direction, and confidence.",
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
        "A concise readable transcript with greeting, overview, urgent/time-sensitive items, response needs, tasks, calendar notes, interesting non-urgent items, FYIs if focus allows them, next steps, and closing.",
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
    const focus = normalizeFocus(payload.focus);
    const contextForOpenAI = compactContext(payload.context);

    if (
      contextForOpenAI.gmail.messages.length === 0 &&
      contextForOpenAI.calendar.events.length === 0
    ) {
      return NextResponse.json({ briefing: emptyBriefing(payload.context, payload.style, focus) });
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
              "Classify emails using exactly these categories when relevant: Urgent / time-sensitive, Needs response, Possible task, Calendar/scheduling related, Interesting but not urgent, Important FYI, Low priority / newsletter / promotion.",
              "Use the provided priorityScore, prioritySignals, lowPrioritySignals, and likelyLowPriority only as guidance. They are hints, not facts.",
              "When likelyLowPriority is true, do not include the email in action-only or skip-low-priority transcripts unless the snippet clearly shows a real user obligation.",
              "For actionItems, every item must include: Source sender, Source subject, Suggested action, Confidence high/medium/low, Reason for confidence.",
              "For needs-response items in priorityEmails, include: sender, subject, why it may need a response, suggested response direction, and confidence high/medium/low.",
              "Reply suggestions should be short directions, not full replies, unless the subject/snippet clearly supports a short response. Never pretend to know missing context.",
              "Include calendar context only when it affects the user's day, creates pressure, conflicts, preparation needs, or scheduling decisions.",
              "Separate urgent or time-sensitive items from interesting-but-not-urgent items. Do not mix them.",
              "Do not read every email one by one unless necessary. Summarize lower-priority groups.",
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
                "The fullTranscript must use this structure: short greeting; quick overview of email volume and calendar context; urgent/time-sensitive items; items that may need a response; possible tasks; calendar/scheduling notes; interesting but not urgent; low-priority FYIs if focus allows them; suggested next steps; short closing.",
                "The priorityEmails array should group important emails by category and include sender, subject, timestamp, and evidence from the snippet.",
                "The actionItems array should only include plausible actions. If evidence is weak, include the item with low confidence or omit it.",
                "The lowPriorityFYI array should capture newsletters, promotions, digests, and passive updates only when focus mode allows low-priority coverage.",
                "The suggestedNextSteps array should be short and practical, including response direction when a reply seems likely.",
                "If focus is action-only and no urgent or actionable items are clear, say: No clear action items found for this range.",
              ].join(" "),
              focus,
              focusGuidance: focusGuidance[focus],
              focusItemGuidance: focusItemGuidance[focus],
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

    const body: WrittenBriefingResponse = { briefing: applyFocusGuardrails(parsed, focus) };
    return NextResponse.json(body);
  } catch {
    return errorResponse("InboxCast could not generate the written briefing.", 500);
  }
}
