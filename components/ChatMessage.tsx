"use client";

import { useState } from "react";
import { Copy, Sparkles, UserRound } from "lucide-react";
import type { ChatMessageData } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const assistantActions = ["Save to Outputs", "Copy", "Make shorter", "Make warmer", "Make more professional"];

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

  async function copyMessage() {
    await navigator.clipboard?.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className={cn("flex gap-3", !isAssistant && "justify-end")}>
      {isAssistant && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-300/[0.14] text-teal-300">
          <Sparkles className="h-5 w-5" />
        </div>
      )}
      <div className={cn("max-w-3xl rounded-[1.75rem] p-4", isAssistant ? "surface-card" : "bg-mist-50 text-ink-950")}>
        <p className={cn("whitespace-pre-line text-sm leading-6", isAssistant ? "text-mist-100" : "text-ink-950")}>
          {message.content}
        </p>
        {message.reasoning && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <p className="text-xs font-medium uppercase text-violet-300">Reasoning</p>
            <p className="mt-2 text-sm leading-6 text-mist-300">{message.reasoning}</p>
          </div>
        )}
        {isAssistant && (
          <div className="mt-4 flex flex-wrap gap-2">
            {assistantActions.map((action) => (
              <button
                className="secondary-button px-3 py-2 text-xs"
                key={action}
                onClick={action === "Copy" ? copyMessage : undefined}
                type="button"
              >
                {action === "Copy" && <Copy className="h-3.5 w-3.5" />}
                {action === "Copy" && copied ? "Copied" : action}
              </button>
            ))}
          </div>
        )}
      </div>
      {!isAssistant && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mist-50 text-ink-950">
          <UserRound className="h-5 w-5" />
        </div>
      )}
    </article>
  );
}
