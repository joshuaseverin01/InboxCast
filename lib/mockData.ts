// Future integration: replace these mocks with Gmail, Calendar, OpenAI, and Supabase-backed data services.
export type BriefingOption = {
  id: string;
  label: string;
  description: string;
};

export type SummaryMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "violet" | "ember" | "mist";
};

export type Email = {
  id: string;
  sender: string;
  senderRole: string;
  senderEmail: string;
  subject: string;
  timestamp: string;
  priority: "High" | "Medium" | "Low";
  section: "Priority emails" | "Action items" | "Calendar context" | "Low-priority FYIs";
  preview: string;
  body: string[];
  summary: string;
  actionItems: string[];
  suggestedReply: string;
  tags: string[];
};

export type Briefing = {
  id: string;
  title: string;
  date: string;
  duration: string;
  durationSeconds: number;
  tone: string;
  transcript: Array<{
    title: string;
    text: string;
  }>;
};

export type Output = {
  id: string;
  type: "Draft reply" | "Task plan" | "Meeting prep";
  title: string;
  linkedEmail: string;
  createdDate: string;
  content: string;
};

export type ChatMessageData = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
};

export const userProfile = {
  name: "Alex",
  email: "alex.morgan@gmail.com",
};

export const briefingOptions: BriefingOption[] = [
  {
    id: "since-yesterday",
    label: "Since yesterday",
    description: "Catch up from your last close-of-day scan.",
  },
  {
    id: "last-24",
    label: "Last 24 hours",
    description: "A complete rolling window across mail and calendar.",
  },
  {
    id: "morning",
    label: "This morning",
    description: "Only what landed while you were starting the day.",
  },
  {
    id: "custom",
    label: "Custom range",
    description: "Choose exact dates, times, and briefing filters.",
  },
];

export const summaryMetrics: SummaryMetric[] = [
  {
    id: "emails",
    label: "Emails found",
    value: "14",
    detail: "Across primary, updates, and newsletters",
    tone: "teal",
  },
  {
    id: "attention",
    label: "Need attention",
    value: "5",
    detail: "Likely reply, review, or decision needed",
    tone: "violet",
  },
  {
    id: "tasks",
    label: "Possible tasks",
    value: "3",
    detail: "Drafted into lightweight next steps",
    tone: "ember",
  },
  {
    id: "conflicts",
    label: "Calendar conflicts",
    value: "2",
    detail: "Detected overlap or prep pressure",
    tone: "mist",
  },
];

export const emails: Email[] = [
  {
    id: "sarah-launch-review",
    sender: "Sarah Chen",
    senderRole: "Product Lead, Northstar Labs",
    senderEmail: "sarah@northstarlabs.co",
    subject: "Launch review notes before Thursday",
    timestamp: "Today, 7:42 AM",
    priority: "High",
    section: "Priority emails",
    preview:
      "Sarah shared final review notes and asked for your take on timeline risk before Thursday's launch meeting.",
    body: [
      "Hi Alex, thanks again for pushing the launch plan forward. I left a few comments in the review doc, mostly around customer support coverage and how we want to frame the beta learnings.",
      "Could you send me your read on timeline risk before Thursday morning? I would especially love your view on whether we should pull the onboarding polish into this release or keep it scoped for the follow-up.",
      "If you have ten minutes before the leadership sync, I can also jump on a quick call.",
    ],
    summary:
      "Sarah wants a concise risk assessment before Thursday, with a recommendation on whether onboarding polish belongs in the launch or should move to the follow-up release.",
    actionItems: [
      "Review Sarah's comments in the launch review doc.",
      "Decide whether onboarding polish should stay in scope.",
      "Send a timeline-risk note before Thursday morning.",
    ],
    suggestedReply:
      "Hi Sarah, thanks for the thoughtful notes. I’ll review the comments today and send you a concise read on timeline risk by tomorrow morning. My initial instinct is to protect the launch scope and move onboarding polish into the follow-up unless we see a clear retention risk, but I’ll validate that against the latest support plan first. Happy to do a quick ten-minute sync before leadership if useful.",
    tags: ["Launch", "Reply needed", "Timeline"],
  },
  {
    id: "maya-calendar-conflict",
    sender: "Maya Patel",
    senderRole: "Program Manager",
    senderEmail: "maya@studioatlas.com",
    subject: "Overlap with 1:1 and design critique",
    timestamp: "Today, 6:58 AM",
    priority: "High",
    section: "Calendar context",
    preview:
      "Maya flagged a calendar overlap between your design critique and a standing 1:1.",
    body: [
      "Morning Alex, I noticed your design critique overlaps with Jordan's 1:1 by fifteen minutes today.",
      "Should I move the critique back to 2:30 PM or ask Jordan if the 1:1 can shift earlier? The critique has three reviewers confirmed, so my bias is to protect that slot if possible.",
    ],
    summary:
      "Maya needs a scheduling decision for today's overlap. The design critique has more attendees committed, so protecting that slot may be the cleanest option.",
    actionItems: [
      "Choose whether to move Jordan's 1:1 or the critique.",
      "Reply to Maya with your preferred schedule change.",
    ],
    suggestedReply:
      "Thanks for catching this, Maya. Let’s protect the critique slot since the reviewers are already confirmed. Could you ask Jordan whether the 1:1 can shift earlier today? If that creates friction, I’m comfortable moving the 1:1 to tomorrow.",
    tags: ["Calendar", "Decision", "Today"],
  },
  {
    id: "ben-contract",
    sender: "Ben Ortiz",
    senderRole: "Legal Counsel",
    senderEmail: "ben@cliftonlegal.com",
    subject: "Vendor agreement redlines",
    timestamp: "Yesterday, 4:21 PM",
    priority: "Medium",
    section: "Action items",
    preview:
      "Ben returned vendor agreement redlines and highlighted two clauses that need business input.",
    body: [
      "Alex, attached are the latest redlines from the vendor. Most of this is standard cleanup, but two items need your business call: the renewal notification window and the data-retention language.",
      "Please send me your preference by end of week so I can turn the draft around.",
    ],
    summary:
      "Legal needs your business preference on renewal notice timing and data-retention language before the agreement can move forward.",
    actionItems: [
      "Review renewal notification window.",
      "Review data-retention clause.",
      "Send Ben business preferences by end of week.",
    ],
    suggestedReply:
      "Hi Ben, thanks for turning this around. I’ll review the renewal window and data-retention language today and send you my business preferences by end of week. If either clause has a strong legal recommendation, please flag it and I’ll factor that in.",
    tags: ["Legal", "Vendor", "This week"],
  },
  {
    id: "weekly-digest",
    sender: "Research Weekly",
    senderRole: "Newsletter",
    senderEmail: "digest@researchweekly.com",
    subject: "AI agents in everyday productivity",
    timestamp: "Yesterday, 8:12 AM",
    priority: "Low",
    section: "Low-priority FYIs",
    preview:
      "A useful long read on agentic workflows, probably worth saving for later rather than handling now.",
    body: [
      "This week's edition looks at how lightweight agents are being embedded into everyday productivity tools, from calendars to research notebooks.",
      "The most practical examples came from teams using audio summaries and ambient capture to reduce morning triage time.",
    ],
    summary:
      "Relevant thought leadership for InboxCast-style workflows, but there is no direct action needed today.",
    actionItems: ["Save for later reading if the topic is useful."],
    suggestedReply:
      "No reply needed. Consider saving this for a later product research pass.",
    tags: ["Newsletter", "Read later"],
  },
];

export const currentBriefing: Briefing = {
  id: "morning-briefing",
  title: "Morning Briefing",
  date: "Today, 8:10 AM",
  duration: "8 min",
  durationSeconds: 480,
  tone: "Calm professional",
  transcript: [
    {
      title: "Priority emails",
      text:
        "You have two priority emails this morning. Sarah needs a launch-risk read before Thursday, and Maya needs a decision on a calendar overlap today.",
    },
    {
      title: "Action items",
      text:
        "Three possible tasks emerged: review launch comments, decide on a schedule conflict, and send legal business preferences on the vendor agreement.",
    },
    {
      title: "Calendar context",
      text:
        "Your design critique overlaps with a standing 1:1. Because three reviewers are confirmed, InboxCast recommends protecting the critique slot and moving the 1:1 if possible.",
    },
    {
      title: "Low-priority FYIs",
      text:
        "One newsletter looks relevant for future product research, but it does not need your attention during the morning workflow.",
    },
  ],
};

export const recentBriefings: Briefing[] = [
  currentBriefing,
  {
    id: "yesterday-evening",
    title: "Evening Catch-up",
    date: "Yesterday, 5:45 PM",
    duration: "6 min",
    durationSeconds: 360,
    tone: "Executive",
    transcript: [],
  },
  {
    id: "monday-morning",
    title: "Monday Reset",
    date: "Mon, 8:05 AM",
    duration: "10 min",
    durationSeconds: 600,
    tone: "Detailed",
    transcript: [],
  },
];

export const outputs: Output[] = [
  {
    id: "reply-sarah",
    type: "Draft reply",
    title: "Reply to Sarah about launch risk",
    linkedEmail: "Launch review notes before Thursday",
    createdDate: "Today, 8:18 AM",
    content:
      "Hi Sarah, thanks for the thoughtful notes. I’ll review the comments today and send you a concise read on timeline risk by tomorrow morning. My initial instinct is to protect the launch scope and move onboarding polish into the follow-up unless we see a clear retention risk, but I’ll validate that against the latest support plan first.",
  },
  {
    id: "task-plan-vendor",
    type: "Task plan",
    title: "Vendor agreement review plan",
    linkedEmail: "Vendor agreement redlines",
    createdDate: "Yesterday, 5:10 PM",
    content:
      "1. Review renewal notification window.\n2. Compare data-retention language against internal policy.\n3. Send Ben a business preference with any open legal questions.\n4. Add a reminder for Friday if the review is not complete.",
  },
  {
    id: "meeting-prep-critique",
    type: "Meeting prep",
    title: "Design critique prep notes",
    linkedEmail: "Overlap with 1:1 and design critique",
    createdDate: "Today, 7:04 AM",
    content:
      "Lead with the onboarding risk, ask reviewers for the smallest viable polish pass, and close with a clear launch/follow-up decision.",
  },
];

export const chatMessages: ChatMessageData[] = [
  {
    id: "user-1",
    role: "user",
    content: "Help me respond to Sarah professionally.",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content:
      "Hi Sarah, thanks for the thoughtful notes. I’ll review the comments today and send you a concise read on timeline risk by tomorrow morning. My initial instinct is to protect the launch scope and move onboarding polish into the follow-up unless we see a clear retention risk, but I’ll validate that against the latest support plan first. Happy to do a quick ten-minute sync before leadership if useful.",
    reasoning:
      "This keeps the reply warm and decisive, confirms ownership, gives Sarah a clear deadline, and leaves room for a quick sync without overcommitting.",
  },
];

export const connectedAccounts = [
  {
    name: "Gmail",
    email: userProfile.email,
    status: "Mock connected",
  },
  {
    name: "Google Calendar",
    email: userProfile.email,
    status: "Mock connected",
  },
];

export const briefingStyles = ["Concise", "Detailed", "Executive", "Casual podcast"];
export const voiceOptions = ["Calm", "Professional", "Energetic"];
