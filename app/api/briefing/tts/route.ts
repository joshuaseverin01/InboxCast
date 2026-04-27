import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "coral";
const MAX_TTS_CHARS = 4096;

type TtsRequest = {
  fullTranscript?: string;
};

async function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return errorResponse("Sign in to generate audio.", 401);
  }

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("OPENAI_API_KEY is not configured.", 500);
  }

  try {
    const payload = (await request.json()) as TtsRequest;
    const input = payload.fullTranscript?.trim();

    if (!input) {
      return errorResponse("Missing fullTranscript.", 400);
    }

    // TTS receives only the generated transcript. Audio is returned directly and is not stored server-side.
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      body: JSON.stringify({
        input: input.slice(0, MAX_TTS_CHARS),
        instructions: "Speak like a calm personal morning assistant. Keep the pacing clear and composed.",
        model: TTS_MODEL,
        response_format: "mp3",
        voice: TTS_VOICE,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      await response.json().catch(() => null);
      return errorResponse(
        "OpenAI could not generate audio. Check server OpenAI configuration and TTS model access.",
        response.status,
      );
    }

    const audio = await response.arrayBuffer();

    return new Response(audio, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/mpeg",
      },
    });
  } catch {
    return errorResponse("InboxCast could not generate audio.", 500);
  }
}
