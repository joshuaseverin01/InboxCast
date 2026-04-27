import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clipboard, Copy, MessageCircle, Save, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { emails } from "@/lib/mockData";

export function generateStaticParams() {
  return emails.map((email) => ({ id: email.id }));
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = emails.find((item) => item.id === id);

  if (!email) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link className="secondary-button px-4 py-2" href="/briefing">
          <ArrowLeft className="h-4 w-4" />
          Back to Briefing
        </Link>

        <section className="surface-card rounded-[2rem] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-teal-300">{email.sender}</p>
              <h1 className="mt-2 text-3xl font-semibold text-mist-50 sm:text-4xl">{email.subject}</h1>
              <p className="mt-3 text-sm text-mist-500">
                {email.senderRole} · {email.senderEmail} · {email.timestamp}
              </p>
            </div>
            <div className="rounded-full border border-ember-300/30 bg-ember-300/10 px-3 py-1.5 text-sm font-medium text-ember-300">
              {email.priority} priority
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-ink-950/[0.48] p-5">
            <p className="text-sm font-medium text-mist-300">Original email</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-mist-300">
              {email.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <article className="surface-card rounded-[2rem] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
                <Sparkles className="h-4 w-4" />
                AI summary
              </div>
              <p className="mt-4 text-sm leading-7 text-mist-300">{email.summary}</p>
            </article>

            <article className="surface-card rounded-[2rem] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
                <Clipboard className="h-4 w-4" />
                Detected action items
              </div>
              <ul className="mt-4 space-y-3">
                {email.actionItems.map((item) => (
                  <li className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-mist-300" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="surface-card rounded-[2rem] p-5">
            <p className="text-sm font-medium text-ember-300">Suggested reply</p>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-ink-950/[0.48] p-4 text-sm leading-7 text-mist-200">
              {email.suggestedReply}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="primary-button" href="/concierge">
                <MessageCircle className="h-4 w-4" />
                Ask Concierge
              </Link>
              <button className="secondary-button px-4 py-3" type="button">
                <Save className="h-4 w-4" />
                Save suggested reply to Outputs
              </button>
              <button className="secondary-button px-4 py-3" type="button">
                <Copy className="h-4 w-4" />
                Copy reply
              </button>
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
