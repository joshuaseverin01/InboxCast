"use client";

import { useState } from "react";
import { Copy, FileText, Trash2 } from "lucide-react";
import type { Output } from "@/lib/mockData";

export function OutputCard({ output }: { output: Output }) {
  const [content, setContent] = useState(output.content);
  const [copied, setCopied] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <div className="quiet-card rounded-[1.75rem] p-5 text-sm text-mist-500">
        Output removed from this prototype view.
      </div>
    );
  }

  async function copyOutput() {
    await navigator.clipboard?.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="surface-card rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-300/[0.12] text-violet-300">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-teal-300">{output.type}</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-mist-50">{output.title}</h3>
            <p className="mt-1 text-sm text-mist-500">{output.createdDate}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-3 text-xs text-mist-500">
        Linked email: <span className="text-mist-200">{output.linkedEmail}</span>
      </div>

      <textarea
        aria-label={`Editable output: ${output.title}`}
        className="field mt-4 min-h-40 resize-y leading-6"
        onChange={(event) => setContent(event.target.value)}
        value={content}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="secondary-button px-4 py-2" onClick={copyOutput} type="button">
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          className="secondary-button px-4 py-2 text-mist-300 hover:text-ember-300"
          onClick={() => setDeleted(true)}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </article>
  );
}
