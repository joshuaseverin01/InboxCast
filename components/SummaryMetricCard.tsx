import { ArrowUpRight, CalendarClock, CheckCircle2, Inbox, ListTodo } from "lucide-react";
import type { SummaryMetric } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const iconById = {
  emails: Inbox,
  attention: CheckCircle2,
  tasks: ListTodo,
  conflicts: CalendarClock,
};

const toneClasses: Record<SummaryMetric["tone"], string> = {
  teal: "from-teal-300/[0.18] text-teal-300",
  violet: "from-violet-300/[0.18] text-violet-300",
  ember: "from-ember-300/[0.18] text-ember-300",
  mist: "from-mist-100/[0.14] text-mist-100",
};

export function SummaryMetricCard({ metric }: { metric: SummaryMetric }) {
  const Icon = iconById[metric.id as keyof typeof iconById] ?? ArrowUpRight;

  return (
    <article className="surface-card rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br to-white/[0.035]",
            toneClasses[metric.tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-mist-700" />
      </div>
      <div className="mt-5 text-3xl font-semibold text-mist-50">{metric.value}</div>
      <h3 className="mt-1 text-sm font-medium text-mist-100">{metric.label}</h3>
      <p className="mt-2 text-sm leading-5 text-mist-500">{metric.detail}</p>
    </article>
  );
}
