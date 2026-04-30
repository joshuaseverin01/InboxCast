"use client";

import { useEffect, useState } from "react";
import { Copy, Download, FileText, Loader2, MailPlus, Trash2, X } from "lucide-react";

type SavedOutput = {
  id: string;
  type: string;
  title: string;
  linkedEmail: string;
  createdDate: string;
  content: string;
};

type ExportStatus = {
  state: "loading" | "success" | "error";
  message: string;
};

type DraftFormState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

type DraftStatus = {
  state: "loading" | "success" | "error";
  message: string;
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

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "output"
  );
}

function fileDatePart() {
  return new Date().toISOString().slice(0, 10);
}

function isProbablyMobile() {
  return window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function preventLongTokenClipping(value: string) {
  return value.replace(/\S{64,}/g, (token) => token.match(/.{1,48}/g)?.join(" ") ?? token);
}

async function exportOutputPdf(output: SavedOutput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "letter", unit: "pt" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const footerY = pageHeight - 34;
  const maxWidth = pageWidth - marginX * 2;
  const bottomY = footerY - 24;
  const filename = `inboxcast-${safeFilePart(output.title)}-${fileDatePart()}.pdf`;
  let y = 58;

  function ensureSpace(height: number) {
    if (y + height <= bottomY) return;
    doc.addPage();
    y = 58;
  }

  function addWrappedText(text: string, options: { size: number; lineHeight: number; color?: [number, number, number] }) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(options.size);
    doc.setTextColor(...(options.color ?? [34, 39, 48]));

    const lines = text.trim() ? doc.splitTextToSize(preventLongTokenClipping(text), maxWidth) : [""];
    ensureSpace(lines.length * options.lineHeight);
    doc.text(lines, marginX, y);
    y += lines.length * options.lineHeight;
  }

  doc.setTextColor(45, 100, 112);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("InboxCast", marginX, y);
  y += 28;

  doc.setTextColor(18, 24, 32);
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(preventLongTokenClipping(output.title || "Saved output"), maxWidth);
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 26 + 8;

  addWrappedText(`Created: ${output.createdDate || "Unknown date"}`, {
    color: [92, 101, 116],
    lineHeight: 14,
    size: 10,
  });
  y += 2;
  addWrappedText(`Linked context: ${output.linkedEmail || "Latest briefing"}`, {
    color: [92, 101, 116],
    lineHeight: 14,
    size: 10,
  });
  y += 28;

  doc.setDrawColor(218, 224, 232);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  for (const paragraph of (output.content || "(No content)").split(/\n/)) {
    addWrappedText(paragraph, { lineHeight: 17, size: 11 });
    y += paragraph.trim() ? 8 : 6;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(128, 138, 151);
    doc.text("Generated with InboxCast", marginX, footerY);
    doc.text(`${page} / ${pageCount}`, pageWidth - marginX, footerY, { align: "right" });
  }

  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  if (isProbablyMobile() && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: output.title,
      text: "Generated with InboxCast",
    });
    return "Ready to share";
  }

  doc.save(filename);
  return "PDF exported";
}

export function OutputsClient() {
  const [outputs, setOutputs] = useState<SavedOutput[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<Record<string, ExportStatus>>({});
  const [draftForms, setDraftForms] = useState<Record<string, DraftFormState>>({});
  const [draftStatus, setDraftStatus] = useState<Record<string, DraftStatus>>({});
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);

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

  async function exportPdf(output: SavedOutput) {
    setExportStatus((current) => ({
      ...current,
      [output.id]: { message: "Preparing PDF", state: "loading" },
    }));

    try {
      const message = await exportOutputPdf(output);
      setExportStatus((current) => ({
        ...current,
        [output.id]: { message, state: "success" },
      }));
      window.setTimeout(() => {
        setExportStatus((current) => {
          const { [output.id]: _removed, ...rest } = current;
          return rest;
        });
      }, 1800);
    } catch {
      setExportStatus((current) => ({
        ...current,
        [output.id]: {
          message: "PDF export failed. Try again or copy the output instead.",
          state: "error",
        },
      }));
    }
  }

  function openDraftForm(output: SavedOutput) {
    setOpenDraftId((current) => (current === output.id ? null : output.id));
    setDraftForms((current) => ({
      ...current,
      [output.id]: current[output.id] ?? {
        bcc: "",
        body: output.content,
        cc: "",
        subject: output.title,
        to: "",
      },
    }));
  }

  function updateDraftForm(id: string, field: keyof DraftFormState, value: string) {
    setDraftForms((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { bcc: "", body: "", cc: "", subject: "", to: "" }),
        [field]: value,
      },
    }));
  }

  async function createGmailDraft(output: SavedOutput) {
    const form = draftForms[output.id];

    if (!form?.to.trim()) {
      setDraftStatus((current) => ({
        ...current,
        [output.id]: { message: "Add at least one recipient before creating a Gmail draft.", state: "error" },
      }));
      return;
    }

    if (!form.subject.trim()) {
      setDraftStatus((current) => ({
        ...current,
        [output.id]: { message: "Add a subject before creating a Gmail draft.", state: "error" },
      }));
      return;
    }

    if (!form.body.trim()) {
      setDraftStatus((current) => ({
        ...current,
        [output.id]: { message: "Add a body before creating a Gmail draft.", state: "error" },
      }));
      return;
    }

    setDraftStatus((current) => ({
      ...current,
      [output.id]: { message: "Creating Gmail draft", state: "loading" },
    }));

    try {
      const response = await fetch("/api/google/drafts/create", {
        body: JSON.stringify(form),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gmail API could not create the draft. Try again from Outputs.");
      }

      setDraftStatus((current) => ({
        ...current,
        [output.id]: {
          message: "Draft created in Gmail. Review it in Gmail before sending.",
          state: "success",
        },
      }));
    } catch (error) {
      setDraftStatus((current) => ({
        ...current,
        [output.id]: {
          message: error instanceof Error ? error.message : "Gmail draft creation failed.",
          state: "error",
        },
      }));
    }
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
              className="secondary-button px-4 py-2"
              disabled={exportStatus[output.id]?.state === "loading"}
              onClick={() => exportPdf(output)}
              type="button"
            >
              {exportStatus[output.id]?.state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exportStatus[output.id]?.state === "loading" ? "Exporting" : "Export PDF"}
            </button>
            <button className="secondary-button px-4 py-2" onClick={() => openDraftForm(output)} type="button">
              <MailPlus className="h-4 w-4" />
              Create Gmail draft
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

          {exportStatus[output.id] && exportStatus[output.id].state !== "loading" && (
            <div
              className={[
                "mt-3 rounded-2xl border p-3 text-sm leading-6",
                exportStatus[output.id].state === "success"
                  ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                  : "border-ember-300/25 bg-ember-300/10 text-ember-300",
              ].join(" ")}
            >
              {exportStatus[output.id].message}
            </div>
          )}

          {openDraftId === output.id && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-ink-950/[0.42] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-mist-50">Create Gmail draft</p>
                  <p className="mt-1 text-sm leading-6 text-mist-500">
                    InboxCast only creates a draft. It will not send email.
                  </p>
                </div>
                <button
                  aria-label="Close Gmail draft form"
                  className="secondary-button h-9 w-9 px-0"
                  onClick={() => setOpenDraftId(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-sm font-medium text-mist-300">
                  To
                  <input
                    className="field mt-2"
                    onChange={(event) => updateDraftForm(output.id, "to", event.target.value)}
                    placeholder="name@example.com"
                    type="email"
                    value={draftForms[output.id]?.to ?? ""}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-mist-300">
                    Cc
                    <input
                      className="field mt-2"
                      onChange={(event) => updateDraftForm(output.id, "cc", event.target.value)}
                      placeholder="Optional"
                      type="text"
                      value={draftForms[output.id]?.cc ?? ""}
                    />
                  </label>
                  <label className="text-sm font-medium text-mist-300">
                    Bcc
                    <input
                      className="field mt-2"
                      onChange={(event) => updateDraftForm(output.id, "bcc", event.target.value)}
                      placeholder="Optional"
                      type="text"
                      value={draftForms[output.id]?.bcc ?? ""}
                    />
                  </label>
                </div>

                <label className="text-sm font-medium text-mist-300">
                  Subject
                  <input
                    className="field mt-2"
                    onChange={(event) => updateDraftForm(output.id, "subject", event.target.value)}
                    placeholder="Draft subject"
                    type="text"
                    value={draftForms[output.id]?.subject ?? ""}
                  />
                </label>

                <label className="text-sm font-medium text-mist-300">
                  Body
                  <textarea
                    className="field mt-2 min-h-40 resize-y leading-6"
                    onChange={(event) => updateDraftForm(output.id, "body", event.target.value)}
                    value={draftForms[output.id]?.body ?? ""}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="primary-button px-4 py-2"
                  disabled={draftStatus[output.id]?.state === "loading"}
                  onClick={() => createGmailDraft(output)}
                  type="button"
                >
                  {draftStatus[output.id]?.state === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailPlus className="h-4 w-4" />
                  )}
                  {draftStatus[output.id]?.state === "loading" ? "Creating draft" : "Create draft in Gmail"}
                </button>
              </div>

              {draftStatus[output.id] && (
                <div
                  className={[
                    "mt-3 rounded-2xl border p-3 text-sm leading-6",
                    draftStatus[output.id].state === "success"
                      ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                      : draftStatus[output.id].state === "error"
                        ? "border-ember-300/25 bg-ember-300/10 text-ember-300"
                        : "border-white/10 bg-white/[0.04] text-mist-300",
                  ].join(" ")}
                >
                  {draftStatus[output.id].message}
                </div>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
