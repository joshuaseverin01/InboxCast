export const feedbackStorageKey = "inboxcast.testerFeedback";

export const feedbackCategories = [
  "Briefing was useful",
  "Briefing missed something important",
  "Wrong priority",
  "Audio issue",
  "Concierge answer was wrong",
  "Reply draft was helpful",
  "Reply draft was not useful",
  "Bug / broken flow",
  "Other",
] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number];

export type TesterFeedback = {
  id: string;
  category: FeedbackCategory;
  note: string;
  source: string;
  createdAt: string;
};

export function readTesterFeedback(): TesterFeedback[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(feedbackStorageKey) ?? "[]") as TesterFeedback[];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function saveTesterFeedback(feedback: TesterFeedback) {
  const existing = readTesterFeedback();
  window.localStorage.setItem(feedbackStorageKey, JSON.stringify([feedback, ...existing].slice(0, 50)));
}
