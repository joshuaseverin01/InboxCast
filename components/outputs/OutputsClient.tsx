"use client";

import { useEffect, useState } from "react";
import { Copy, FileText, Trash2 } from "lucide-react";

type SavedOutput = {
  id: string;
  type: string;
  title: string;
  linkedEmail: string;
  createdDate: string;
  content: string;
};

const outputsStorageKey = "inboxcast.outputs";

function readOutputs() {
  try {
    return JSON.parse(window.localStorage.getItem(outputsStorageKey) ?? "[]") as SavedOutput[];
  } catch {
    return [];
  }
}

function writeOutputs(outputs: SavedOutput[]) {
  window.localStorage.setItem(outputsStorageKey, JSON.stringify(outputs));
}

export function OutputsClient() {
  const [outputs, setOutputs] = useState<SavedOutput[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setOutputs(readOutputs());
  }, []);

  function updateOutput(id: string, content: string) {
    const nextOutputs = outputs.map((output) => (output.id === id ? { ...output, content } : output));
    setOutputs(nextOutputs);
    writeOutputs(nextOutputs);
  }

  function deleteOutput(id: string) {
    const nextOutputs = outputs.filter((output) => output.id !== id);
    setOutputs(nextOutputs);
    writeOutputs(nextOutputs);
  }

  async function copyOutput(output: SavedOutput) {
    await navigator.clipboard?.writeText(output.content);
    setCopiedId(output.id);
    window.setTimeout(() => setCopiedId(null), 1200);
  }

  if (outputs.length === 0) {
    return (
      <section className="quiet-card rounded-[2rem] p-6 text-center">
        <p className="font-semibold text-mist-50">No saved outputs yet</p>
        <p className="mt-2 text-sm leading-6 text-mist-500">
          Save a Concierge response and it will appear here for editing, copying, or deleting.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {outputs.map((output) => (
        <article className="surface-card rounded-[1.75rem] p-5" key={output.id}>
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-3 text-xs text-mist-500">
            Linked context: <span className="text-mist-200">{output.linkedEmail}</span>
          </div>

          <textarea
            aria-label={`Editable output: ${output.title}`}
            className="field mt-4 min-h-40 resize-y leading-6"
            onChange={(event) => updateOutput(output.id, event.target.value)}
            value={output.content}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="secondary-button px-4 py-2" onClick={() => copyOutput(output)} type="button">
              <Copy className="h-4 w-4" />
              {copiedId === output.id ? "Copied" : "Copy"}
            </button>
            <button
              className="secondary-button px-4 py-2 text-mist-300 hover:text-ember-300"
              onClick={() => deleteOutput(output.id)}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
