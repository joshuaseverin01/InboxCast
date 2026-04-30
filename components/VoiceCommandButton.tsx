"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceCommandExecutionResult = {
  action: string;
  heard: string;
  intent: string;
  range?: string;
  status: "error" | "success";
};

type VoiceCommandButtonProps = {
  className?: string;
  disabled?: boolean;
  onCommand: (command: string) => Promise<VoiceCommandExecutionResult>;
};

type RecognitionEventLike = {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type RecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function errorMessage(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission was denied. Enable microphone access or use the typed command box.";
  }

  if (error === "no-speech") {
    return "I did not catch that. Try again or type the command.";
  }

  return "Voice command failed. Try again or use the typed command box.";
}

export function VoiceCommandButton({ className, disabled = false, onCommand }: VoiceCommandButtonProps) {
  const [mode, setMode] = useState<"idle" | "listening" | "processing">("idle");
  const [typedCommand, setTypedCommand] = useState("");
  const [result, setResult] = useState<VoiceCommandExecutionResult | null>(null);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  async function runCommand(command: string) {
    const heard = command.trim();
    if (!heard || mode === "processing") return;

    setMode("processing");
    setResult({
      action: "Processing command...",
      heard,
      intent: "Processing",
      status: "success",
    });

    try {
      setResult(await onCommand(heard));
    } catch {
      setResult({
        action: "Voice command failed. Try again or use the typed command box.",
        heard,
        intent: "Command error",
        status: "error",
      });
    } finally {
      setMode("idle");
    }
  }

  function startListening() {
    if (disabled || mode === "processing") return;

    if (mode === "listening") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setMode("idle");
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechSupported(false);
      setResult({
        action: "Voice commands are not supported in this browser yet. Try Chrome or Safari, or use the typed command box.",
        heard: "",
        intent: "Browser support",
        status: "error",
      });
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript ?? "";
      recognitionRef.current = null;
      setTypedCommand(transcript);
      void runCommand(transcript);
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setMode("idle");
      setResult({
        action: errorMessage(event.error),
        heard: "",
        intent: "Speech recognition",
        status: "error",
      });
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setMode((current) => (current === "listening" ? "idle" : current));
    };

    setResult(null);
    setMode("listening");
    recognition.start();
  }

  function submitTypedCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runCommand(typedCommand);
  }

  return (
    <section className={cn("surface-card rounded-[2rem] p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-300">Voice command</p>
          <p className="mt-1 text-sm leading-6 text-mist-500">Tap to talk, or type the same command below.</p>
        </div>
        <button
          className="primary-button min-h-12 justify-center px-5"
          disabled={disabled || mode === "processing"}
          onClick={startListening}
          type="button"
        >
          {mode === "processing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {mode === "listening" ? "Listening..." : mode === "processing" ? "Processing..." : "Voice command"}
        </button>
      </div>

      {speechSupported === false && (
        <div className="mt-4 rounded-2xl border border-ember-300/25 bg-ember-300/10 p-3 text-sm leading-6 text-ember-300">
          Voice commands are not supported in this browser yet. Try Chrome or Safari, or use the typed command box.
        </div>
      )}

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitTypedCommand}>
        <input
          className="field"
          onChange={(event) => setTypedCommand(event.target.value)}
          placeholder="Try: Give me a briefing since yesterday"
          value={typedCommand}
        />
        <button className="secondary-button shrink-0 px-4 py-3" disabled={disabled || mode === "processing"} type="submit">
          <SendHorizonal className="h-4 w-4" />
          Run
        </button>
      </form>

      {result && (
        <div
          className={cn(
            "mt-4 rounded-2xl border p-3 text-sm leading-6",
            result.status === "success"
              ? "border-teal-300/25 bg-teal-300/10 text-mist-100"
              : "border-ember-300/25 bg-ember-300/10 text-ember-300",
          )}
        >
          {result.heard && (
            <p>
              <span className="font-medium text-mist-50">Heard:</span> "{result.heard}"
            </p>
          )}
          <p>
            <span className="font-medium text-mist-50">Intent:</span> {result.intent}
          </p>
          {result.range && (
            <p>
              <span className="font-medium text-mist-50">Range:</span> {result.range}
            </p>
          )}
          <p>
            <span className="font-medium text-mist-50">Status:</span> {result.action}
          </p>
        </div>
      )}
    </section>
  );
}
