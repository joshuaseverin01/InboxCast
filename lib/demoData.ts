export type DemoPriorityCategory =
  | "urgent"
  | "needs_response"
  | "possible_task"
  | "calendar"
  | "important_fyi"
  | "low_priority";

export type DemoThreadMessage = {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  body: string;
};

export type DemoEmail = {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  timestamp: string;
  snippet: string;
  labels: string[];
  priorityCategory: DemoPriorityCategory;
  needsResponse: boolean;
  possibleTask: boolean;
  fullBody: string;
  threadMessages?: DemoThreadMessage[];
};

export type DemoCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description: string;
};

export type DemoBriefingFocus = "full" | "skip_low_priority" | "action_only";
export type DemoBriefingStyle = "concise" | "executive" | "casual podcast";

export type DemoBriefing = {
  overview: string;
  urgent: string[];
  needsResponse: string[];
  possibleTasks: string[];
  calendarNotes: string[];
  interesting: string[];
  skippedLowPriority: string[];
  suggestedNextSteps: string[];
  fullTranscript: string;
};

export const demoEmails: DemoEmail[] = [
  {
    id: "demo-msg-001",
    threadId: "demo-thread-roadmap",
    sender: "Jordan Ellis",
    senderEmail: "jordan.ellis@example.com",
    subject: "Re: Roadmap review before Thursday standup",
    timestamp: "2026-05-04T07:42:00-07:00",
    snippet:
      "Could you review the launch notes before Thursday? The main open question is whether we should move the integrations section earlier.",
    labels: ["INBOX", "IMPORTANT"],
    priorityCategory: "needs_response",
    needsResponse: true,
    possibleTask: true,
    fullBody:
      "Hi there,\n\nCould you review the launch notes before Thursday's standup? The main open question is whether we should move the integrations section earlier and keep the security notes in the appendix.\n\nA short yes/no with any comments is enough. If you think the order is wrong, please mark the two sections you would swap.\n\nThanks,\nJordan",
    threadMessages: [
      {
        id: "demo-thread-roadmap-1",
        from: "You",
        to: "Jordan Ellis",
        timestamp: "2026-05-03T16:20:00-07:00",
        body: "I can look at the launch notes tomorrow morning. Send over the latest version when it is ready.",
      },
      {
        id: "demo-thread-roadmap-2",
        from: "Jordan Ellis",
        to: "You",
        timestamp: "2026-05-04T07:42:00-07:00",
        body:
          "Could you review the launch notes before Thursday's standup? The main open question is whether we should move the integrations section earlier and keep the security notes in the appendix.",
      },
    ],
  },
  {
    id: "demo-msg-002",
    threadId: "demo-thread-schedule",
    sender: "Riley Morgan",
    senderEmail: "riley.morgan@example.com",
    subject: "Can we move the 2 PM prep call?",
    timestamp: "2026-05-04T08:05:00-07:00",
    snippet: "I have a conflict at 2 PM. Are you free at 3:30 or tomorrow morning instead?",
    labels: ["INBOX"],
    priorityCategory: "calendar",
    needsResponse: true,
    possibleTask: false,
    fullBody:
      "Hi,\n\nI have a conflict at 2 PM today. Are you free at 3:30 PM, or would tomorrow morning be easier? I can also send notes async if neither time works.\n\nRiley",
    threadMessages: [
      {
        id: "demo-thread-schedule-1",
        from: "Riley Morgan",
        to: "You",
        timestamp: "2026-05-03T14:12:00-07:00",
        body: "Let's hold 2 PM tomorrow for prep unless the calendar moves.",
      },
      {
        id: "demo-thread-schedule-2",
        from: "Riley Morgan",
        to: "You",
        timestamp: "2026-05-04T08:05:00-07:00",
        body: "I have a conflict at 2 PM today. Are you free at 3:30 PM, or would tomorrow morning be easier?",
      },
    ],
  },
  {
    id: "demo-msg-003",
    threadId: "demo-thread-deadline",
    sender: "Avery Patel",
    senderEmail: "avery.patel@example.edu",
    subject: "Final project outline due tonight",
    timestamp: "2026-05-04T08:31:00-07:00",
    snippet: "Reminder that the final project outline is due by 11:59 PM. Please include scope, sources, and a short risk note.",
    labels: ["INBOX", "IMPORTANT"],
    priorityCategory: "urgent",
    needsResponse: false,
    possibleTask: true,
    fullBody:
      "Hello,\n\nReminder that the final project outline is due by 11:59 PM tonight. Please include the project scope, at least three sources, and a short note on risks or unknowns.\n\nNo need to reply unless you have a question.\n\nAvery",
  },
  {
    id: "demo-msg-004",
    threadId: "demo-thread-recruiting",
    sender: "Mina Brooks",
    senderEmail: "mina.brooks@example.com",
    subject: "Coffee chat follow-up",
    timestamp: "2026-05-04T09:08:00-07:00",
    snippet: "Great speaking last week. If you are interested, send two windows for a follow-up with our product lead.",
    labels: ["INBOX"],
    priorityCategory: "needs_response",
    needsResponse: true,
    possibleTask: true,
    fullBody:
      "Hi,\n\nGreat speaking last week. If you are interested in continuing the conversation, send me two windows this week and I can coordinate a follow-up with our product lead.\n\nBest,\nMina",
  },
  {
    id: "demo-msg-005",
    threadId: "demo-thread-meeting-prep",
    sender: "Noah Grant",
    senderEmail: "noah.grant@example.com",
    subject: "Prep notes for 11 AM investor sync",
    timestamp: "2026-05-04T09:22:00-07:00",
    snippet: "For the 11 AM sync, please be ready to explain activation, data privacy posture, and next validation milestones.",
    labels: ["INBOX", "IMPORTANT"],
    priorityCategory: "calendar",
    needsResponse: false,
    possibleTask: true,
    fullBody:
      "For the 11 AM sync, please be ready to explain activation, data privacy posture, and next validation milestones. The only decision we need today is whether to invite two additional testers this week.",
  },
  {
    id: "demo-msg-006",
    threadId: "demo-thread-client",
    sender: "Camille Rivera",
    senderEmail: "camille.rivera@example.com",
    subject: "Question on the revised proposal",
    timestamp: "2026-05-04T09:47:00-07:00",
    snippet: "Can you clarify whether the timeline assumes one review cycle or two? We want to avoid surprising the team.",
    labels: ["INBOX"],
    priorityCategory: "needs_response",
    needsResponse: true,
    possibleTask: false,
    fullBody:
      "Hi,\n\nCan you clarify whether the timeline assumes one review cycle or two? We want to avoid surprising the team when we share the proposal internally.\n\nA quick explanation is fine.\n\nCamille",
  },
  {
    id: "demo-msg-007",
    threadId: "demo-thread-receipt",
    sender: "CloudDesk Billing",
    senderEmail: "billing@example-service.com",
    subject: "Receipt for your May subscription",
    timestamp: "2026-05-04T06:18:00-07:00",
    snippet: "Your receipt for the May subscription is attached. No action is required.",
    labels: ["INBOX", "CATEGORY_UPDATES"],
    priorityCategory: "low_priority",
    needsResponse: false,
    possibleTask: false,
    fullBody:
      "Your receipt for the May subscription is available. No action is required. This is an automated demo billing notice.",
  },
  {
    id: "demo-msg-008",
    threadId: "demo-thread-newsletter",
    sender: "Product Notes Weekly",
    senderEmail: "newsletter@example-publication.com",
    subject: "This week in product systems",
    timestamp: "2026-05-04T05:44:00-07:00",
    snippet: "New essays on onboarding, team rituals, and making complex tools feel calm.",
    labels: ["INBOX", "CATEGORY_UPDATES"],
    priorityCategory: "low_priority",
    needsResponse: false,
    possibleTask: false,
    fullBody:
      "This fictional newsletter includes links about onboarding, team rituals, and making complex tools feel calm. It is useful background reading but not time-sensitive.",
  },
  {
    id: "demo-msg-009",
    threadId: "demo-thread-promo",
    sender: "Studio Market",
    senderEmail: "deals@example-market.com",
    subject: "48-hour workspace sale",
    timestamp: "2026-05-04T04:20:00-07:00",
    snippet: "Save on desk accessories, notebooks, and travel gear through Wednesday.",
    labels: ["INBOX", "CATEGORY_PROMOTIONS"],
    priorityCategory: "low_priority",
    needsResponse: false,
    possibleTask: false,
    fullBody:
      "A fictional promotional email about a 48-hour workspace sale. This demo item exists to show how InboxCast compresses low-priority promotional updates.",
  },
  {
    id: "demo-msg-010",
    threadId: "demo-thread-team",
    sender: "Taylor Nguyen",
    senderEmail: "taylor.nguyen@example.com",
    subject: "Action required: confirm launch checklist owner",
    timestamp: "2026-05-04T10:02:00-07:00",
    snippet: "Can you confirm who owns the launch checklist by noon? I need the name before the planning doc goes out.",
    labels: ["INBOX", "IMPORTANT"],
    priorityCategory: "urgent",
    needsResponse: true,
    possibleTask: true,
    fullBody:
      "Can you confirm who owns the launch checklist by noon? I need the name before the planning doc goes out. If you are the owner, just reply with confirmation and I will update the document.",
  },
  {
    id: "demo-msg-011",
    threadId: "demo-thread-mentor",
    sender: "Elliot Shaw",
    senderEmail: "elliot.shaw@example.com",
    subject: "Intro offer",
    timestamp: "2026-05-03T19:55:00-07:00",
    snippet: "Happy to introduce you to a founder who has been thinking about voice-first productivity. Want me to make the intro?",
    labels: ["INBOX"],
    priorityCategory: "important_fyi",
    needsResponse: true,
    possibleTask: false,
    fullBody:
      "Happy to introduce you to a founder who has been thinking about voice-first productivity. Want me to make the intro? No pressure if this week is packed.",
  },
  {
    id: "demo-msg-012",
    threadId: "demo-thread-docs",
    sender: "Docs Bot",
    senderEmail: "no-reply@example-docs.com",
    subject: "Comment activity digest",
    timestamp: "2026-05-04T03:05:00-07:00",
    snippet: "Four comments were added to shared documents yesterday.",
    labels: ["INBOX", "CATEGORY_UPDATES"],
    priorityCategory: "low_priority",
    needsResponse: false,
    possibleTask: false,
    fullBody:
      "This fictional automated digest summarizes document comments. InboxCast treats this as low priority unless the snippet suggests a direct ask.",
  },
  {
    id: "demo-msg-013",
    threadId: "demo-thread-interview",
    sender: "Leah Stone",
    senderEmail: "leah.stone@example.com",
    subject: "Interview panel agenda",
    timestamp: "2026-05-03T18:12:00-07:00",
    snippet: "Sharing the agenda for tomorrow's panel. Please review the candidate brief before 10 AM.",
    labels: ["INBOX", "IMPORTANT"],
    priorityCategory: "calendar",
    needsResponse: false,
    possibleTask: true,
    fullBody:
      "Sharing the agenda for tomorrow's panel. Please review the candidate brief before 10 AM and bring one product judgment question.",
  },
  {
    id: "demo-msg-014",
    threadId: "demo-thread-community",
    sender: "Design Systems Forum",
    senderEmail: "updates@example-forum.com",
    subject: "Upcoming webinar: Designing for trust",
    timestamp: "2026-05-03T17:30:00-07:00",
    snippet: "Join a fictional webinar about trust, privacy copy, and onboarding design.",
    labels: ["INBOX", "CATEGORY_FORUMS"],
    priorityCategory: "low_priority",
    needsResponse: false,
    possibleTask: false,
    fullBody:
      "This fictional forum update promotes a webinar. It is not actionable for the morning briefing unless the user wants background reading.",
  },
  {
    id: "demo-msg-015",
    threadId: "demo-thread-plan",
    sender: "Morgan Lee",
    senderEmail: "morgan.lee@example.com",
    subject: "Could you send the tester plan?",
    timestamp: "2026-05-03T16:48:00-07:00",
    snippet: "Could you send the tester plan by end of day? I mainly need target users, feedback questions, and safety notes.",
    labels: ["INBOX"],
    priorityCategory: "possible_task",
    needsResponse: true,
    possibleTask: true,
    fullBody:
      "Could you send the tester plan by end of day? I mainly need target users, feedback questions, and safety notes. A rough version is fine.",
  },
];

export const demoCalendarEvents: DemoCalendarEvent[] = [
  {
    id: "demo-cal-001",
    title: "Investor sync",
    start: "2026-05-04T11:00:00-07:00",
    end: "2026-05-04T11:45:00-07:00",
    location: "Video call",
    description: "Discuss activation, data privacy posture, and next validation milestones.",
  },
  {
    id: "demo-cal-002",
    title: "Prep call with Riley",
    start: "2026-05-04T14:00:00-07:00",
    end: "2026-05-04T14:30:00-07:00",
    location: "Phone",
    description: "Potentially needs rescheduling based on Riley's email.",
  },
  {
    id: "demo-cal-003",
    title: "Project outline block",
    start: "2026-05-04T16:00:00-07:00",
    end: "2026-05-04T17:00:00-07:00",
    description: "Work block for final project outline due tonight.",
  },
  {
    id: "demo-cal-004",
    title: "Interview panel",
    start: "2026-05-05T10:00:00-07:00",
    end: "2026-05-05T11:00:00-07:00",
    location: "Conference room",
    description: "Review candidate brief and prepare one product judgment question.",
  },
];

const focusLabels: Record<DemoBriefingFocus, string> = {
  action_only: "Action-only",
  full: "Full briefing",
  skip_low_priority: "Skip low priority",
};

function styleOpening(style: DemoBriefingStyle) {
  if (style === "executive") {
    return "Here is the executive readout: a few items need decisions or replies today, and the rest can stay out of your way.";
  }

  if (style === "casual podcast") {
    return "Good morning. I checked the demo inbox and calendar, and the useful signal is pretty clear today.";
  }

  return "Good morning. Here is the concise briefing from the demo inbox and calendar.";
}

function buildTranscript(briefing: Omit<DemoBriefing, "fullTranscript">, style: DemoBriefingStyle, focus: DemoBriefingFocus) {
  const sections = [
    ["Overview", [briefing.overview]],
    ["Urgent and time-sensitive", briefing.urgent],
    ["Needs response", briefing.needsResponse],
    ["Possible tasks", briefing.possibleTasks],
    ["Calendar and scheduling", briefing.calendarNotes],
    focus === "action_only" ? null : ["Interesting but not urgent", briefing.interesting],
    focus === "full" ? ["Skipped or low-priority items", briefing.skippedLowPriority] : null,
    ["Suggested next steps", briefing.suggestedNextSteps],
  ].filter(Boolean) as Array<[string, string[]]>;

  const body = sections
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");

  const closing =
    style === "casual podcast"
      ? "That is the useful part. I would handle the noon launch owner, reply on scheduling, then protect time for the project outline."
      : "Recommended order: confirm the launch owner, resolve scheduling, review the roadmap notes, then handle the project outline.";

  return `${styleOpening(style)}\n\n${body}\n\n${closing}`;
}

export function getDemoBriefing(focus: DemoBriefingFocus, style: DemoBriefingStyle): DemoBriefing {
  const includeLowPriority = focus === "full";
  const includeInteresting = focus !== "action_only";

  const overview =
    focus === "action_only"
      ? "InboxCast found 4 clear action items, 3 likely replies, and 2 calendar-linked items. Low-priority updates are omitted."
      : "InboxCast found 15 demo emails and 4 calendar events. Four emails look actionable, three likely need replies, and newsletters/promotions are separated from the priority flow.";

  const urgent = [
    "Taylor Nguyen asks you to confirm the launch checklist owner by noon.",
    "Avery Patel's project outline reminder is due by 11:59 PM tonight.",
  ];

  const needsResponse = [
    "Jordan Ellis needs a quick review decision on whether to reorder the launch notes before Thursday's standup.",
    "Riley Morgan asks whether 3:30 PM today or tomorrow morning works for the prep call.",
    "Camille Rivera asks whether the revised proposal timeline assumes one review cycle or two.",
  ];

  const possibleTasks = [
    "Review the candidate brief before tomorrow's interview panel.",
    "Prepare activation, privacy posture, and validation milestone talking points for the 11 AM investor sync.",
    "Send Morgan Lee a rough tester plan with target users, feedback questions, and safety notes.",
  ];

  const calendarNotes = [
    "The 11 AM investor sync is connected to Noah Grant's prep-note email.",
    "The 2 PM prep call may need to move because Riley flagged a conflict.",
    "The 4 PM project outline block is a useful protected window for tonight's deadline.",
  ];

  const interesting = includeInteresting
    ? [
        "Elliot Shaw offered an intro to a founder thinking about voice-first productivity. Useful, but less urgent than today's replies.",
        "Leah Stone shared tomorrow's interview panel agenda. This matters for prep, not immediate inbox triage.",
      ]
    : [];

  const skippedLowPriority = includeLowPriority
    ? [
        "Product Notes Weekly, Studio Market, CloudDesk Billing, Docs Bot, and Design Systems Forum are low-priority or automated demo items.",
        "No action is needed on the receipt, promotional sale, newsletter, forum update, or document digest based on the preview text.",
      ]
    : ["I skipped newsletters, promotions, receipts, and automated digests for this focus mode."];

  const suggestedNextSteps =
    focus === "action_only"
      ? [
          "Reply to Taylor with the launch checklist owner.",
          "Send Riley a scheduling preference.",
          "Answer Camille's timeline question.",
          "Block or use the 4 PM work session for the project outline.",
        ]
      : [
          "Handle the noon launch checklist confirmation first.",
          "Reply to Riley and Camille while the context is fresh.",
          "Review Jordan's launch notes before Thursday.",
          "Use the 4 PM block for the project outline and defer low-priority demo updates.",
        ];

  const briefing = {
    calendarNotes,
    interesting,
    needsResponse,
    overview,
    possibleTasks,
    skippedLowPriority,
    suggestedNextSteps,
    urgent,
  };

  return {
    ...briefing,
    fullTranscript: buildTranscript(briefing, style, focus),
  };
}

export function getPriorityLabel(category: DemoPriorityCategory) {
  const labels: Record<DemoPriorityCategory, string> = {
    calendar: "Calendar",
    important_fyi: "Important FYI",
    low_priority: "Low priority",
    needs_response: "Needs response",
    possible_task: "Possible task",
    urgent: "Urgent",
  };

  return labels[category];
}
