import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  Headphones,
  MailCheck,
  MessageSquareText,
  Mic2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AudioPlayerCard } from "@/components/AudioPlayerCard";
import { currentBriefing } from "@/lib/mockData";

const features = [
  {
    title: "Email briefings",
    description: "Turn crowded threads into a calm spoken rundown of what matters.",
    icon: MailCheck,
  },
  {
    title: "Calendar context",
    description: "Hear meeting pressure, conflicts, and prep prompts alongside your inbox.",
    icon: CalendarDays,
  },
  {
    title: "AI reply brainstorming",
    description: "Move from messy intention to polished reply drafts in one flow.",
    icon: MessageSquareText,
  },
  {
    title: "Saved outputs",
    description: "Keep useful replies, task outlines, and prep notes in a dedicated space.",
    icon: Archive,
  },
  {
    title: "Voice-first workflow",
    description: "Designed for breakfast, walking, commuting, and hands-busy mornings.",
    icon: Headphones,
  },
  {
    title: "Privacy-first design",
    description: "Clear controls for connected accounts, local data, and future retention.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-app-shell text-mist-50">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="pt-2 lg:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-teal-300 shadow-soft">
            <Mic2 className="h-4 w-4" />
            Personal AI audio briefings
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] text-mist-50 sm:text-6xl lg:text-7xl">
            InboxCast
          </h1>
          <p className="mt-5 max-w-2xl text-2xl font-semibold leading-tight text-mist-100 sm:text-3xl">
            Your inbox, turned into a personal morning briefing.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-mist-300 sm:text-lg">
            Listen to your emails, calendar, action items, and suggested replies in a calm podcast-style briefing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="primary-button" href="/dashboard">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="secondary-button" href="/briefing">
              Open Briefing Flow
            </Link>
          </div>
        </div>

        <div className="relative pb-10 lg:pb-0">
          <div className="surface-card rounded-[2.35rem] p-3 shadow-glow">
            <AudioPlayerCard briefing={currentBriefing} variant="hero" />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {["14 emails", "5 need attention", "2 conflicts"].map((item) => (
                <div className="quiet-card rounded-3xl px-4 py-3 text-sm font-medium text-mist-100" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-teal-300">
              <Sparkles className="h-4 w-4" />
              Built for quiet control
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-mist-50">A chief-of-staff layer for your morning</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-mist-500">
            InboxCast starts with a listenable briefing, then gives you a concierge and output library when you need to act.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="surface-card rounded-[1.75rem] p-5" key={feature.title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.07] text-teal-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-mist-50">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mist-500">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
