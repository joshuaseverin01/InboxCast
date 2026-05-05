"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Inbox,
  Loader2,
  MailOpen,
  MailPlus,
  MessageSquareText,
  Pause,
  Play,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  demoCalendarEvents,
  demoEmails,
  getDemoBriefing,
  getPriorityLabel,
  type DemoBriefing,
  type DemoBriefingFocus,
  type DemoBriefingStyle,
  type DemoEmail,
  type DemoThreadMessage,
} from "@/lib/demoData";
import { cn } from "@/lib/utils";

type DemoTab = "overview" | "briefing" | "concierge" | "outputs" | "privacy";
type DemoLoadingStep = "idle" | "checking" | "prioritizing" | "generating" | "ready";

type DemoOutput = {
  id: string;
  title: string;
  linkedContext: string;
  createdAt: string;
  content: string;
};

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SelectedDemoContext =
  | {
      kind: "email";
      email: DemoEmail;
    }
  | {
      kind: "thread";
      email: DemoEmail;
      messages: DemoThreadMessage[];
    };

type DemoDraftState = {
  source: SelectedDemoContext;
  body: string;
  copied: boolean;
  saved: boolean;
  draftCreated: boolean;
};

const demoOutputsStorageKey = "inboxcast_demo_outputs";
const demoTabs: Array<{ id: DemoTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "briefing", label: "Briefing" },
  { id: "concierge", label: "Concierge" },
  { id: "outputs", label: "Outputs" },
  { id: "privacy", label: "Privacy" },
];
const focusOptions: Array<{ value: DemoBriefingFocus; label: string; description: string }> = [
  {
    description: "Priority items, calendar context, FYIs, and low-priority compression.",
    label: "Full briefing",
    value: "full",
  },
  {
    description: "Default demo mode. Keeps priorities and skips promotional noise.",
    label: "Skip low priority",
    value: "skip_low_priority",
  },
  {
    description: "Only response needs, tasks, urgent items, and scheduling issues.",
    label: "Action-only",
    value: "action_only",
  },
];
const styleOptions: Array<{ value: DemoBriefingStyle; label: string }> = [
  { label: "Concise", value: "concise" },
  { label: "Executive", value: "executive" },
  { label: "Casual podcast", value: "casual podcast" },
];
const suggestedPrompts = [
  "What needs my attention?",
  "Which emails need a response?",
  "Summarize the meeting thread.",
  "Draft a reply to Jordan.",
  "Only tell me what needs action.",
];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function loadDemoOutputs() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(demoOutputsStorageKey) ?? "[]") as DemoOutput[];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeDemoOutputs(outputs: DemoOutput[]) {
  window.localStorage.setItem(demoOutputsStorageKey, JSON.stringify(outputs));
}

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "demo-output"
  );
}

function sourceLabel(context: SelectedDemoContext) {
  if (context.kind === "thread") return `Thread: ${context.email.subject}`;
  return `Email: ${context.email.subject}`;
}

function buildDemoReply(context: SelectedDemoContext) {
  if (context.kind === "thread") {
    return [
      "Hi Jordan,",
      "",
      "Thanks for sending the latest notes. I can review them before Thursday's standup.",
      "",
      "My first instinct is to move the integrations section earlier if that is the main decision point, then keep the security notes as appendix material unless we need them for the opening narrative. I will mark the two sections I would swap and send comments back today.",
      "",
      "Best,",
    ].join("\n");
  }

  if (context.email.sender === "Riley Morgan") {
    return [
      "Hi Riley,",
      "",
      "Thanks for the heads up. 3:30 PM today works for me. If that changes on your side, tomorrow morning is also fine.",
      "",
      "Best,",
    ].join("\n");
  }

  if (context.email.sender === "Camille Rivera") {
    return [
      "Hi Camille,",
      "",
      "The current timeline assumes one review cycle. If your team expects two, I would adjust the schedule now so there are no surprises later.",
      "",
      "Happy to revise the proposal language to make that assumption clearer.",
      "",
      "Best,",
    ].join("\n");
  }

  return [
    `Hi ${context.email.sender.split(" ")[0]},`,
    "",
    "Thanks for the note. I can take a look and follow up with a concise answer today.",
    "",
    "Best,",
  ].join("\n");
}

function conciergeAnswer(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("need") && normalized.includes("response")) {
    return [
      "Three demo emails likely need a response:",
      "",
      "1. Taylor Nguyen needs the launch checklist owner confirmed by noon.",
      "2. Riley Morgan needs a new time for the prep call.",
      "3. Camille Rivera needs clarification on whether the proposal timeline includes one review cycle or two.",
      "",
      "Jordan Ellis also needs a review decision, but the snippet suggests a short answer may be enough after you inspect the notes.",
    ].join("\n");
  }

  if (normalized.includes("meeting thread") || normalized.includes("thread")) {
    return [
      "The demo meeting thread is about the roadmap review before Thursday's standup.",
      "",
      "Jordan asked for a review of the launch notes and specifically wants a decision on whether integrations should move earlier while security notes stay in the appendix.",
      "",
      "In the real app, this stronger thread-level answer is available only after you explicitly approve reading that selected thread.",
    ].join("\n");
  }

  if (normalized.includes("draft") || normalized.includes("jordan")) {
    return [
      "Draft direction for Jordan:",
      "",
      "Confirm you can review the notes before Thursday, give a tentative direction on section order, and say you will mark specific comments today. Avoid pretending you have already reviewed the document unless you have.",
      "",
      "You can also read the full demo thread and use Draft reply to see the reviewed draft workflow.",
    ].join("\n");
  }

  if (normalized.includes("action")) {
    return [
      "Action-only demo summary:",
      "",
      "- Confirm the launch checklist owner for Taylor by noon.",
      "- Reply to Riley with a prep-call time.",
      "- Answer Camille's proposal timeline question.",
      "- Review Jordan's launch notes before Thursday.",
      "- Use the 4 PM block for the project outline due tonight.",
    ].join("\n");
  }

  return [
    "The main attention items are Taylor's noon confirmation, Riley's scheduling conflict, Camille's proposal question, Jordan's roadmap review, and the project outline due tonight.",
    "",
    "Newsletters, receipts, promotions, and automated digests are present in the demo inbox, but they are not driving the day.",
  ].join("\n");
}

function SectionList({ items, title }: { title: string; items: string[] }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <h3 className="text-sm font-semibold text-mist-50">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-mist-500">Nothing notable in this demo section.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li className="text-sm leading-6 text-mist-300" key={item}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-[1.75rem] border border-teal-300/20 bg-teal-300/[0.09] p-4 text-sm leading-6 text-teal-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
          <p>
            <span className="font-semibold text-mist-50">Demo Mode — fictional inbox and calendar data.</span> No Google
            account connected. No emails sent.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoAudio({ transcript }: { transcript: string }) {
  const [status, setStatus] = useState("Ready");
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  function play() {
    if (!supported) {
      setPlaying(true);
      setStatus("Simulating demo audio playback");
      window.setTimeout(() => {
        setPlaying(false);
        setStatus("Demo audio simulation complete");
      }, 1800);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setPlaying(true);
      setStatus("Playing browser speech demo");
    };
    utterance.onend = () => {
      setPlaying(false);
      setStatus("Playback complete");
    };
    utterance.onerror = () => {
      setPlaying(false);
      setStatus("Browser speech playback was interrupted");
    };
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setStatus("Stopped");
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-ink-950/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
            <Volume2 className="h-4 w-4" />
            Demo audio
          </div>
          <p className="mt-1 text-sm leading-6 text-mist-500">
            Demo audio uses browser speech playback. The real app uses higher-quality AI TTS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button px-4 py-2 text-xs" onClick={play} type="button">
            <Play className="h-3.5 w-3.5 fill-current" />
            Play demo audio
          </button>
          <button className="secondary-button px-4 py-2 text-xs" onClick={stop} type="button">
            <Pause className="h-3.5 w-3.5" />
            Stop
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-mist-300">
        <span className={cn("rounded-full px-3 py-1", playing ? "bg-teal-300/15 text-teal-100" : "bg-white/[0.06]")}>
          {status}
        </span>
        {[1, 1.25, 1.5].map((value) => (
          <button
            className={cn(
              "secondary-button px-3 py-1.5 text-xs",
              rate === value && "border-teal-300/35 text-teal-300",
            )}
            key={value}
            onClick={() => setRate(value)}
            type="button"
          >
            {value}x
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoEmailCard({
  email,
  onReadEmail,
  onReadThread,
}: {
  email: DemoEmail;
  onReadEmail: (email: DemoEmail) => void;
  onReadThread: (email: DemoEmail) => void;
}) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-mist-50">{email.sender}</p>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-teal-300">
              {getPriorityLabel(email.priorityCategory)}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-mist-100">{email.subject}</h3>
          <p className="mt-1 text-xs text-mist-500">{formatTime(email.timestamp)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button className="secondary-button px-3 py-2 text-xs" onClick={() => onReadEmail(email)} type="button">
            <MailOpen className="h-3.5 w-3.5" />
            Read full email
          </button>
          {email.threadMessages && (
            <button className="secondary-button px-3 py-2 text-xs" onClick={() => onReadThread(email)} type="button">
              <MailOpen className="h-3.5 w-3.5" />
              Read full thread
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-mist-300">{email.snippet}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {email.labels.map((label) => (
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-mist-500" key={label}>
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function DemoOutputCard({
  onCopy,
  onDelete,
  onExport,
  onUpdate,
  output,
  status,
}: {
  output: DemoOutput;
  status?: string;
  onCopy: (output: DemoOutput) => void;
  onDelete: (id: string) => void;
  onExport: (output: DemoOutput) => void;
  onUpdate: (id: string, content: string) => void;
}) {
  return (
    <article className="surface-card rounded-[1.75rem] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-300/[0.12] text-violet-300">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-lg font-semibold text-mist-50">{output.title}</h3>
          <p className="mt-1 text-sm text-mist-500">{output.createdAt}</p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-white/10 bg-ink-950/40 p-3 text-xs leading-5 text-mist-500">
        Demo context: <span className="text-mist-200">{output.linkedContext}</span>
      </p>
      <textarea
        className="field mt-4 min-h-36 resize-y leading-6"
        onChange={(event) => onUpdate(output.id, event.target.value)}
        value={output.content}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="secondary-button px-4 py-2 text-xs" onClick={() => onCopy(output)} type="button">
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
        <button className="secondary-button px-4 py-2 text-xs" onClick={() => onExport(output)} type="button">
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </button>
        <button className="secondary-button px-4 py-2 text-xs text-mist-300" onClick={() => onDelete(output.id)} type="button">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
      {status && (
        <div className="mt-3 rounded-2xl border border-teal-300/20 bg-teal-300/10 p-3 text-sm text-teal-100">
          {status}
        </div>
      )}
    </article>
  );
}

export function DemoExperience() {
  const [tab, setTab] = useState<DemoTab>("overview");
  const [focus, setFocus] = useState<DemoBriefingFocus>("skip_low_priority");
  const [style, setStyle] = useState<DemoBriefingStyle>("concise");
  const [loadingStep, setLoadingStep] = useState<DemoLoadingStep>("idle");
  const [briefingStarted, setBriefingStarted] = useState(false);
  const [selectedContext, setSelectedContext] = useState<SelectedDemoContext | null>(null);
  const [draft, setDraft] = useState<DemoDraftState | null>(null);
  const [outputs, setOutputs] = useState<DemoOutput[]>([]);
  const [outputStatus, setOutputStatus] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      content:
        "Ask me about the fictional inbox, or try a suggested prompt. Demo Concierge is deterministic and does not call OpenAI.",
      id: "demo-welcome",
      role: "assistant",
    },
  ]);
  const [conciergeInput, setConciergeInput] = useState("");
  const briefing: DemoBriefing = useMemo(() => getDemoBriefing(focus, style), [focus, style]);
  const actionEmails = demoEmails.filter((email) => email.needsResponse || email.possibleTask || email.priorityCategory === "urgent");
  const lowPriorityCount = demoEmails.filter((email) => email.priorityCategory === "low_priority").length;

  useEffect(() => {
    setOutputs(loadDemoOutputs());
  }, []);

  async function startDemoBriefing() {
    setTab("briefing");
    setBriefingStarted(false);
    setSelectedContext(null);
    setDraft(null);
    setLoadingStep("checking");
    await sleep(550);
    setLoadingStep("prioritizing");
    await sleep(650);
    setLoadingStep("generating");
    await sleep(700);
    setBriefingStarted(true);
    setLoadingStep("ready");
  }

  function saveDemoOutput(content: string, title = "Demo Concierge response", linkedContext = "Demo inbox") {
    const nextOutput: DemoOutput = {
      content,
      createdAt: new Date().toLocaleString(),
      id: randomId(),
      linkedContext,
      title,
    };
    const nextOutputs = [nextOutput, ...outputs].slice(0, 20);
    setOutputs(nextOutputs);
    writeDemoOutputs(nextOutputs);
    setTab("outputs");
  }

  function updateOutput(id: string, content: string) {
    const nextOutputs = outputs.map((output) => (output.id === id ? { ...output, content } : output));
    setOutputs(nextOutputs);
    writeDemoOutputs(nextOutputs);
  }

  function deleteOutput(id: string) {
    const nextOutputs = outputs.filter((output) => output.id !== id);
    setOutputs(nextOutputs);
    writeDemoOutputs(nextOutputs);
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text);
  }

  async function exportDemoPdf(output: DemoOutput) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ format: "letter", unit: "pt" });
      const margin = 56;
      const width = doc.internal.pageSize.getWidth() - margin * 2;
      let y = 58;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(45, 100, 112);
      doc.text("InboxCast Demo", margin, y);
      y += 30;
      doc.setTextColor(18, 24, 32);
      doc.setFontSize(20);
      const titleLines = doc.splitTextToSize(output.title, width);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 24 + 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(92, 101, 116);
      doc.text(`Created: ${output.createdAt}`, margin, y);
      y += 16;
      doc.text(`Demo context: ${output.linkedContext}`, margin, y);
      y += 28;
      doc.setDrawColor(218, 224, 232);
      doc.line(margin, y, margin + width, y);
      y += 26;
      doc.setTextColor(34, 39, 48);
      doc.setFontSize(11);
      for (const paragraph of output.content.split(/\n/)) {
        const lines = doc.splitTextToSize(paragraph || " ", width);
        if (y + lines.length * 17 > 735) {
          doc.addPage();
          y = 58;
        }
        doc.text(lines, margin, y);
        y += lines.length * 17 + 8;
      }
      doc.save(`inboxcast-demo-${safeFilePart(output.title)}.pdf`);
      setOutputStatus((current) => ({ ...current, [output.id]: "Demo PDF exported" }));
    } catch {
      setOutputStatus((current) => ({ ...current, [output.id]: "Demo PDF export failed. Copy the output instead." }));
    }
  }

  function sendConciergePrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const answer = conciergeAnswer(trimmed);
    setMessages((current) => [
      ...current,
      { content: trimmed, id: randomId(), role: "user" },
      { content: answer, id: randomId(), role: "assistant" },
    ]);
    setConciergeInput("");
  }

  function readEmail(email: DemoEmail) {
    setSelectedContext({ email, kind: "email" });
    setDraft(null);
  }

  function readThread(email: DemoEmail) {
    if (!email.threadMessages) return;
    setSelectedContext({ email, kind: "thread", messages: email.threadMessages });
    setDraft(null);
  }

  function startDraft(context = selectedContext) {
    if (!context) return;
    setDraft({
      body: buildDemoReply(context),
      copied: false,
      draftCreated: false,
      saved: false,
      source: context,
    });
  }

  function saveDraftToOutputs() {
    if (!draft) return;
    saveDemoOutput(draft.body, `Demo reply draft: ${draft.source.email.subject}`, sourceLabel(draft.source));
    setDraft((current) => (current ? { ...current, saved: true } : current));
  }

  return (
    <main className="min-h-screen bg-app-shell text-mist-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <DemoBanner />

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_26rem]">
          <div className="surface-card rounded-[2rem] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
              <Sparkles className="h-4 w-4" />
              Public interactive demo
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-mist-50 sm:text-5xl">
              See InboxCast turn a fictional inbox into a briefing, Concierge answers, and reviewed drafts.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-mist-300">
              This route mirrors the product workflow with safe demo data. It does not require login, does not connect
              Google, does not call OpenAI, and does not create real Gmail drafts.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button className="primary-button" onClick={startDemoBriefing} type="button">
                <Play className="h-4 w-4 fill-current" />
                Start demo briefing
              </button>
            </div>
          </div>

          <aside className="surface-card rounded-[2rem] p-5">
            <p className="text-sm font-medium text-violet-300">Demo context</p>
            <div className="mt-4 grid gap-3">
              {[
                { icon: Inbox, label: "Fictional emails", value: String(demoEmails.length) },
                { icon: CalendarDays, label: "Calendar events", value: String(demoCalendarEvents.length) },
                { icon: MailOpen, label: "Need response", value: String(demoEmails.filter((email) => email.needsResponse).length) },
                { icon: Archive, label: "Low priority", value: String(lowPriorityCount) },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4" key={metric.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold text-mist-50">{metric.value}</p>
                        <p className="mt-1 text-sm text-mist-500">{metric.label}</p>
                      </div>
                      <Icon className="h-5 w-5 text-teal-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <nav className="sticky top-0 z-20 mt-6 overflow-x-auto border-b border-white/10 bg-ink-950/90 py-3 backdrop-blur-xl">
          <div className="flex gap-2">
            {demoTabs.map((item) => (
              <button
                className={cn(
                  "focus-ring rounded-full px-4 py-2 text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-mist-50 text-ink-950"
                    : "border border-white/10 bg-white/[0.05] text-mist-300 hover:bg-white/[0.08]",
                )}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-6">
          {tab === "overview" && (
            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                <p className="text-sm font-medium text-teal-300">What this demo shows</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">A safe walkthrough of the daily flow</h2>
                <div className="mt-5 space-y-3">
                  {[
                    "Start a briefing from fictional email and calendar data.",
                    "Switch focus modes to see action-only or fuller summaries.",
                    "Use browser speech for demo audio playback.",
                    "Ask deterministic Concierge questions without OpenAI.",
                    "Read fictional full emails or threads after explicit approval.",
                    "Draft, save, copy, export, and simulate Gmail draft creation.",
                  ].map((item) => (
                    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3" key={item}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                      <p className="text-sm leading-6 text-mist-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                <p className="text-sm font-medium text-violet-300">Demo inbox sample</p>
                <div className="mt-4 space-y-3">
                  {demoEmails.slice(0, 5).map((email) => (
                    <DemoEmailCard email={email} key={email.id} onReadEmail={readEmail} onReadThread={readThread} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "briefing" && (
            <section className="space-y-6">
              <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-teal-300">Demo briefing</p>
                    <h2 className="mt-2 text-2xl font-semibold text-mist-50">Fictional briefing generator</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
                      Deterministic briefing copy from fictional data. No Google or OpenAI routes are called.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <select className="field" onChange={(event) => setStyle(event.target.value as DemoBriefingStyle)} value={style}>
                      {styleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select className="field" onChange={(event) => setFocus(event.target.value as DemoBriefingFocus)} value={focus}>
                      {focusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button className="primary-button" onClick={startDemoBriefing} type="button">
                      {loadingStep !== "idle" && loadingStep !== "ready" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Start demo briefing
                    </button>
                  </div>
                </div>

                {loadingStep !== "idle" && loadingStep !== "ready" && (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-mist-300">
                    {loadingStep === "checking" && "Checking demo inbox context..."}
                    {loadingStep === "prioritizing" && "Prioritizing emails..."}
                    {loadingStep === "generating" && "Generating briefing..."}
                  </div>
                )}
              </div>

              {briefingStarted ? (
                <>
                  <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
                      <FileText className="h-4 w-4" />
                      Briefing ready
                    </div>
                    <p className="mt-3 text-sm leading-6 text-mist-300">{briefing.overview}</p>
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      <SectionList items={briefing.urgent} title="Urgent / time-sensitive" />
                      <SectionList items={briefing.needsResponse} title="Needs response" />
                      <SectionList items={briefing.possibleTasks} title="Possible tasks" />
                      <SectionList items={briefing.calendarNotes} title="Calendar / scheduling notes" />
                      <SectionList items={briefing.interesting} title="Interesting but not urgent" />
                      <SectionList items={briefing.skippedLowPriority} title="Skipped low-priority items" />
                      <SectionList items={briefing.suggestedNextSteps} title="Suggested next steps" />
                    </div>
                    <div className="mt-5 rounded-3xl border border-white/10 bg-ink-950/45 p-4">
                      <h3 className="text-sm font-semibold text-mist-50">Full transcript</h3>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-mist-300">{briefing.fullTranscript}</p>
                    </div>
                    <div className="mt-5">
                      <DemoAudio transcript={briefing.fullTranscript} />
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-teal-300">Fictional Gmail metadata</p>
                        <h2 className="mt-2 text-2xl font-semibold text-mist-50">Demo email cards</h2>
                      </div>
                      <div className="space-y-3">
                        {demoEmails.map((email) => (
                          <DemoEmailCard email={email} key={email.id} onReadEmail={readEmail} onReadThread={readThread} />
                        ))}
                      </div>
                    </section>
                    <section className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-violet-300">Fictional calendar</p>
                        <h2 className="mt-2 text-2xl font-semibold text-mist-50">Calendar context</h2>
                      </div>
                      {demoCalendarEvents.map((event) => (
                        <article className="surface-card rounded-[1.5rem] p-4" key={event.id}>
                          <h3 className="text-base font-semibold text-mist-50">{event.title}</h3>
                          <p className="mt-2 text-sm text-mist-300">
                            {formatTime(event.start)} to {formatTime(event.end)}
                          </p>
                          {event.location && <p className="mt-1 text-sm text-mist-500">{event.location}</p>}
                          <p className="mt-3 text-sm leading-6 text-mist-500">{event.description}</p>
                        </article>
                      ))}
                    </section>
                  </div>
                </>
              ) : (
                <div className="quiet-card rounded-[2rem] p-6 text-center">
                  <p className="font-semibold text-mist-50">Start the demo briefing</p>
                  <p className="mt-2 text-sm leading-6 text-mist-500">
                    The loading sequence is simulated and uses only fictional data.
                  </p>
                </div>
              )}
            </section>
          )}

          {tab === "concierge" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
              <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      className="secondary-button px-4 py-2 text-xs"
                      key={prompt}
                      onClick={() => sendConciergePrompt(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="mt-6 space-y-4">
                  {messages.map((message) => (
                    <article className={cn("flex", message.role === "user" && "justify-end")} key={message.id}>
                      <div
                        className={cn(
                          "max-w-3xl rounded-[1.5rem] p-4 text-sm leading-6",
                          message.role === "assistant" ? "quiet-card text-mist-100" : "bg-mist-50 text-ink-950",
                        )}
                      >
                        <p className="whitespace-pre-line">{message.content}</p>
                        {message.role === "assistant" && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button className="secondary-button px-3 py-2 text-xs" onClick={() => copyText(message.content)} type="button">
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                            <button
                              className="secondary-button px-3 py-2 text-xs"
                              onClick={() => saveDemoOutput(message.content)}
                              type="button"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Save to demo Outputs
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-ink-950/45 p-3">
                  <div className="flex items-end gap-3">
                    <textarea
                      className="min-h-16 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-mist-100 outline-none placeholder:text-mist-700"
                      onChange={(event) => setConciergeInput(event.target.value)}
                      placeholder="Try: Which emails need a response?"
                      value={conciergeInput}
                    />
                    <button className="primary-button h-12 w-12 shrink-0 px-0" onClick={() => sendConciergePrompt(conciergeInput)} type="button">
                      <SendHorizonal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="surface-card rounded-[2rem] p-5">
                  <p className="text-sm font-medium text-violet-300">Selected-read simulation</p>
                  <p className="mt-2 text-sm leading-6 text-mist-500">
                    Read a fictional email or thread to simulate the real explicit approval flow.
                  </p>
                  <div className="mt-4 space-y-3">
                    {actionEmails.slice(0, 4).map((email) => (
                      <DemoEmailCard email={email} key={email.id} onReadEmail={readEmail} onReadThread={readThread} />
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          )}

          {tab === "outputs" && (
            <section className="space-y-5">
              <div className="surface-card rounded-[2rem] p-5 sm:p-6">
                <p className="text-sm font-medium text-teal-300">Demo Outputs</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">Saved demo responses and drafts</h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  Uses the separate localStorage key <code>inboxcast_demo_outputs</code>. It does not write to the real
                  app Outputs key.
                </p>
              </div>
              {outputs.length === 0 ? (
                <div className="quiet-card rounded-[2rem] p-6 text-center">
                  <p className="font-semibold text-mist-50">No demo outputs yet</p>
                  <p className="mt-2 text-sm leading-6 text-mist-500">
                    Save a demo Concierge answer or draft reply and it will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {outputs.map((output) => (
                    <DemoOutputCard
                      key={output.id}
                      onCopy={(nextOutput) => copyText(nextOutput.content)}
                      onDelete={deleteOutput}
                      onExport={exportDemoPdf}
                      onUpdate={updateOutput}
                      output={output}
                      status={outputStatus[output.id]}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "privacy" && (
            <section className="surface-card rounded-[2rem] p-5 sm:p-6">
              <p className="text-sm font-medium text-teal-300">Demo privacy</p>
              <h2 className="mt-2 text-2xl font-semibold text-mist-50">Safe by design for public walkthroughs</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  "This demo uses fictional data only.",
                  "No Google account is connected.",
                  "No API calls are made to Google or OpenAI in demo mode.",
                  "The real app connects to Gmail and Calendar only after OAuth consent.",
                  "The real app creates Gmail drafts only after confirmation.",
                  "The real app does not send emails automatically.",
                ].map((item) => (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={item}>
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    <p className="text-sm leading-6 text-mist-300">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {selectedContext && (
          <section className="mt-6 surface-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-teal-300">
                  {selectedContext.kind === "thread" ? "Fictional full thread" : "Fictional full email"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">{selectedContext.email.subject}</h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  In the real app, InboxCast reads full email or thread content only after explicit approval.
                </p>
              </div>
              <button className="primary-button px-4 py-2" onClick={() => startDraft()} type="button">
                <MailPlus className="h-4 w-4" />
                Draft reply
              </button>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-ink-950/45 p-4">
              {selectedContext.kind === "email" ? (
                <p className="whitespace-pre-line text-sm leading-7 text-mist-300">{selectedContext.email.fullBody}</p>
              ) : (
                <div className="space-y-4">
                  {selectedContext.messages.map((message) => (
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={message.id}>
                      <p className="text-sm font-semibold text-mist-50">
                        {message.from} to {message.to}
                      </p>
                      <p className="mt-1 text-xs text-mist-500">{formatTime(message.timestamp)}</p>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-mist-300">{message.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {draft && (
          <section className="mt-6 rounded-[2rem] border border-teal-300/20 bg-teal-300/[0.07] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-teal-300">Demo reply draft</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">{sourceLabel(draft.source)}</h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  Review and edit before simulating a Gmail draft. No Gmail API is called here.
                </p>
              </div>
              <button className="secondary-button px-4 py-2 text-xs" onClick={() => setDraft(null)} type="button">
                Close
              </button>
            </div>
            <textarea
              className="field mt-5 min-h-48 resize-y leading-6"
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, body: event.target.value, draftCreated: false, saved: false } : current))
              }
              value={draft.body}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="secondary-button px-4 py-2 text-xs"
                onClick={async () => {
                  await copyText(draft.body);
                  setDraft((current) => (current ? { ...current, copied: true } : current));
                }}
                type="button"
              >
                <Copy className="h-3.5 w-3.5" />
                {draft.copied ? "Copied" : "Copy"}
              </button>
              <button className="secondary-button px-4 py-2 text-xs" onClick={saveDraftToOutputs} type="button">
                <Archive className="h-3.5 w-3.5" />
                {draft.saved ? "Saved" : "Save to demo Outputs"}
              </button>
              <button
                className="secondary-button px-4 py-2 text-xs"
                onClick={() => setDraft((current) => (current ? { ...current, draftCreated: true } : current))}
                type="button"
              >
                <MailPlus className="h-3.5 w-3.5" />
                Simulate Gmail draft
              </button>
            </div>
            {draft.draftCreated && (
              <div className="mt-4 rounded-2xl border border-teal-300/25 bg-teal-300/10 p-3 text-sm leading-6 text-teal-100">
                Demo draft created. In the real app, InboxCast creates a Gmail draft only after user confirmation and
                never sends automatically.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
