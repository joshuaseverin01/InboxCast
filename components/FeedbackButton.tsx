"use client";

import { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { feedbackCategories, saveTesterFeedback, type FeedbackCategory } from "@/lib/feedback";

export function FeedbackButton({
  source = "General",
}: {
  source?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("Briefing was useful");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function submitFeedback() {
    saveTesterFeedback({
      category,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      note: note.trim(),
      source,
    });

    const feedbackEmail = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;
    if (feedbackEmail) {
      const subject = encodeURIComponent("InboxCast feedback");
      const body = encodeURIComponent(
        [
          `Source: ${source}`,
          `Category: ${category}`,
          "",
          "Note:",
          note.trim() || "(No note)",
          "",
          "Please do not include sensitive email content in feedback.",
        ].join("\n"),
      );
      window.location.href = `mailto:${feedbackEmail}?subject=${subject}&body=${body}`;
      setStatus("Feedback saved locally and opened in email.");
    } else {
      setStatus("Feedback saved locally in this browser.");
    }

    setNote("");
    window.setTimeout(() => {
      setOpen(false);
      setStatus(null);
    }, 1400);
  }

  return (
    <>
      <button className="secondary-button px-4 py-2 text-xs" onClick={() => setOpen(true)} type="button">
        <MessageSquare className="h-3.5 w-3.5" />
        Send feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/75 px-3 pb-24 pt-6 backdrop-blur-xl sm:items-center sm:p-6 lg:pb-6">
          <section
            aria-labelledby="feedback-title"
            aria-modal="true"
            className="surface-card max-h-[calc(100vh-7rem)] w-full max-w-lg overflow-y-auto rounded-[2rem] p-5 shadow-2xl sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-teal-300">Private beta feedback</p>
                <h2 id="feedback-title" className="mt-2 text-2xl font-semibold text-mist-50">
                  Tell me what happened
                </h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  Feedback stores only the category and note you type. It does not attach email content or tokens.
                </p>
              </div>
              <button className="secondary-button h-10 w-10 px-0" onClick={() => setOpen(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium text-mist-300">
              Category
              <select
                className="field mt-2"
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                value={category}
              >
                {feedbackCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-medium text-mist-300">
              Optional note
              <textarea
                className="field mt-2 min-h-28 resize-y leading-6"
                onChange={(event) => setNote(event.target.value)}
                placeholder="What should I know? Please avoid pasting sensitive email content."
                value={note}
              />
            </label>

            {status && (
              <div className="mt-4 rounded-2xl border border-teal-300/25 bg-teal-300/10 p-3 text-sm leading-6 text-teal-100">
                {status}
              </div>
            )}

            <button className="primary-button mt-5 w-full justify-center" onClick={submitFeedback} type="button">
              <Send className="h-4 w-4" />
              Leave feedback
            </button>
          </section>
        </div>
      )}
    </>
  );
}
