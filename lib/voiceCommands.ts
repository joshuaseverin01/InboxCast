import type { BriefingContextRequest, BriefingFocus } from "@/lib/google/types";

export type ParsedVoiceCommand =
  | {
      kind: "morning_briefing";
      intent: "Generate briefing";
      focus?: BriefingFocus;
    }
  | {
      kind: "focus_briefing";
      intent: "Generate briefing";
      focus: BriefingFocus;
    }
  | {
      kind: "generate_briefing";
      intent: "Generate briefing";
      range: BriefingContextRequest;
      rangeLabel: string;
      focus?: BriefingFocus;
    }
  | {
      kind: "audio";
      intent: "Generate or play audio";
    }
  | {
      kind: "concierge";
      intent: "Ask Concierge";
      prompt: string;
    }
  | {
      kind: "navigate";
      intent: "Navigate";
      href: string;
      pageLabel: string;
    }
  | {
      kind: "time_error";
      intent: "Generate briefing";
      message: string;
    }
  | {
      kind: "unsupported";
      intent: "Unsupported command";
      message: string;
    };

const defaultFilters = {
  includeCalendar: true,
  includeNewsletters: true,
  includePromotions: false,
  includeUnreadOnly: false,
};

const weekdays = [
  { day: 0, label: "Sunday", pattern: /since sunday/ },
  { day: 1, label: "Monday", pattern: /since monday/ },
  { day: 2, label: "Tuesday", pattern: /since tuesday/ },
  { day: 3, label: "Wednesday", pattern: /since wednesday/ },
  { day: 4, label: "Thursday", pattern: /since thursday/ },
  { day: 5, label: "Friday", pattern: /since friday/ },
  { day: 6, label: "Saturday", pattern: /since saturday/ },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function range(start: Date, end: Date): BriefingContextRequest {
  return {
    end: end.toISOString(),
    filters: defaultFilters,
    start: start.toISOString(),
  };
}

function parseTimeRange(normalized: string, now = new Date()) {
  const end = new Date(now);

  if (normalized.includes("last 24 hours")) {
    return {
      label: "Last 24 hours",
      value: range(new Date(end.getTime() - 24 * 60 * 60 * 1000), end),
    };
  }

  if (normalized.includes("last 7 days")) {
    return {
      label: "Last 7 days",
      value: range(new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000), end),
    };
  }

  if (normalized.includes("since yesterday")) {
    const start = startOfDay(end);
    start.setDate(start.getDate() - 1);
    return {
      label: "Since yesterday",
      value: range(start, end),
    };
  }

  if (normalized.includes("this morning") || normalized.includes("morning briefing")) {
    const start = startOfDay(end);
    return {
      label: "This morning",
      value: range(start, end),
    };
  }

  if (normalized.includes("today")) {
    return {
      label: "Today",
      value: range(startOfDay(end), end),
    };
  }

  const weekday = weekdays.find((item) => item.pattern.test(normalized));
  if (weekday) {
    const start = startOfDay(end);
    const delta = (start.getDay() - weekday.day + 7) % 7;
    start.setDate(start.getDate() - delta);
    return {
      label: `Since ${weekday.label}`,
      value: range(start, end),
    };
  }

  return null;
}

function normalize(command: string) {
  return command.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isBriefingCommand(normalized: string) {
  return (
    /\bbriefing\b/.test(normalized) ||
    /\bemails?\s+i\s+got\b/.test(normalized) ||
    /\bwhat\s+emails?\s+i\s+got\b/.test(normalized) ||
    /\btell\s+me\s+what\s+emails?\b/.test(normalized)
  );
}

function parseFocus(normalized: string): BriefingFocus | null {
  if (
    normalized.includes("action only") ||
    normalized.includes("needs action") ||
    normalized.includes("only tell me what needs action") ||
    normalized.includes("what needs action")
  ) {
    return "action_only";
  }

  if (normalized.includes("skip low priority") || normalized.includes("skip the low priority")) {
    return "skip_low_priority";
  }

  if (normalized.includes("full briefing") || normalized.includes("the full briefing")) {
    return "full";
  }

  return null;
}

export function parseVoiceCommand(command: string): ParsedVoiceCommand {
  const normalized = normalize(command);
  const focus = parseFocus(normalized);

  if (!normalized) {
    return {
      intent: "Unsupported command",
      kind: "unsupported",
      message: "Say or type a command first.",
    };
  }

  if (/\b(go to|open)\s+outputs?\b/.test(normalized)) {
    return { href: "/outputs", intent: "Navigate", kind: "navigate", pageLabel: "Outputs" };
  }

  if (/\b(open)\s+settings\b/.test(normalized) || /\bgo to\s+settings\b/.test(normalized)) {
    return { href: "/settings", intent: "Navigate", kind: "navigate", pageLabel: "Settings" };
  }

  if (/\b(go to|open)\s+dashboard\b/.test(normalized) || /\bgo home\b/.test(normalized)) {
    return { href: "/dashboard", intent: "Navigate", kind: "navigate", pageLabel: "Dashboard" };
  }

  if (/\b(go to|open)\s+briefing\b/.test(normalized)) {
    return { href: "/briefing", intent: "Navigate", kind: "navigate", pageLabel: "Briefing" };
  }

  if (
    normalized.includes("read it out loud") ||
    normalized.includes("play the briefing") ||
    normalized.includes("generate audio")
  ) {
    return { intent: "Generate or play audio", kind: "audio" };
  }

  if (/\b(my )?morning briefing\b/.test(normalized)) {
    return {
      focus: focus ?? undefined,
      intent: "Generate briefing",
      kind: "morning_briefing",
    };
  }

  if (
    normalized.includes("ask concierge") ||
    normalized.includes("what needs my attention") ||
    normalized.includes("what emails need a response") ||
    normalized.includes("turn my action items into a plan")
  ) {
    return {
      intent: "Ask Concierge",
      kind: "concierge",
      prompt: command.trim(),
    };
  }

  if (isBriefingCommand(normalized)) {
    const parsedRange = parseTimeRange(normalized);

    if (!parsedRange) {
      if (focus) {
        return {
          focus,
          intent: "Generate briefing",
          kind: "focus_briefing",
        };
      }

      return {
        intent: "Generate briefing",
        kind: "time_error",
        message: "I understood the command, but not the time range. Try 'since yesterday' or 'last 24 hours.'",
      };
    }

    return {
      focus: focus ?? undefined,
      intent: "Generate briefing",
      kind: "generate_briefing",
      range: parsedRange.value,
      rangeLabel: parsedRange.label,
    };
  }

  if (focus && (normalized.includes("skip low priority") || normalized.includes("needs action"))) {
    return {
      focus,
      intent: "Generate briefing",
      kind: "focus_briefing",
    };
  }

  return {
    intent: "Unsupported command",
    kind: "unsupported",
    message: "I can handle briefing, audio, Concierge, or navigation commands.",
  };
}
