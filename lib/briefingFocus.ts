import type { BriefingFocus } from "@/lib/google/types";

export const defaultBriefingFocus: BriefingFocus = "skip_low_priority";

export const briefingFocusOptions: Array<{ value: BriefingFocus; label: string; description: string }> = [
  {
    description: "Priority emails, action items, calendar context, FYIs, and next steps.",
    label: "Full briefing",
    value: "full",
  },
  {
    description: "Only urgent items, response needs, possible tasks, and immediate scheduling issues.",
    label: "Action-only",
    value: "action_only",
  },
  {
    description: "Top priorities, response needs, tasks, important FYIs, and relevant calendar context.",
    label: "Skip low priority",
    value: "skip_low_priority",
  },
];

export function briefingFocusLabel(value: BriefingFocus) {
  return briefingFocusOptions.find((option) => option.value === value)?.label ?? "Skip low priority";
}
