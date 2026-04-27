import Link from "next/link";
import { ChevronRight, Mail, Timer } from "lucide-react";
import type { Email } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const priorityClasses: Record<Email["priority"], string> = {
  High: "border-ember-300/30 bg-ember-300/10 text-ember-300",
  Medium: "border-violet-300/30 bg-violet-300/10 text-violet-300",
  Low: "border-teal-300/25 bg-teal-300/[0.09] text-teal-300",
};

export function EmailCard({ email, compact = false }: { email: Email; compact?: boolean }) {
  return (
    <Link
      className={cn(
        "surface-card focus-ring group block rounded-[1.75rem] p-4 transition hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.07]",
        compact && "rounded-3xl",
      )}
      href={`/emails/${email.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-mist-100">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-mist-50">{email.sender}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", priorityClasses[email.priority])}>
              {email.priority}
            </span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-mist-50">{email.subject}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-mist-500">{email.preview}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mist-500">
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {email.timestamp}
            </span>
            <span className="h-1 w-1 rounded-full bg-mist-700" />
            <span>{email.section}</span>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-mist-700 transition group-hover:translate-x-0.5 group-hover:text-mist-300" />
      </div>
    </Link>
  );
}
