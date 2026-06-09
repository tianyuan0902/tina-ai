import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const FALLBACK_TRANSCRIPTION_MODEL = "whisper-1";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Voice transcription is not configured yet." }, { status: 503 });
  }

  let audio: FormDataEntryValue | null = null;

  try {
    const formData = await request.formData();
    audio = formData.get("audio");
  } catch {
    return NextResponse.json({ error: "Could not read the voice memo upload." }, { status: 400 });
  }

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "No audio file was uploaded." }, { status: 400 });
  }

  if (!audio.size) {
    return NextResponse.json({ error: "The voice memo was empty." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That voice memo is too long. Try a shorter recording." }, { status: 413 });
  }

  const primaryModel = process.env.TINA_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL;
  const primary = await transcribeAudio(audio, primaryModel);

  if (primary.ok) {
    return NextResponse.json({ transcript: primary.transcript });
  }

  if (primaryModel !== FALLBACK_TRANSCRIPTION_MODEL && shouldTryFallbackTranscription(primary.errorText)) {
    const fallback = await transcribeAudio(audio, FALLBACK_TRANSCRIPTION_MODEL);
    if (fallback.ok) {
      return NextResponse.json({ transcript: fallback.transcript });
    }
    return NextResponse.json({ error: fallback.userMessage }, { status: fallback.status || 502 });
  }

  return NextResponse.json({ error: primary.userMessage }, { status: primary.status || 502 });
}

async function transcribeAudio(audio: File, model: string) {
  try {
    const formData = new FormData();
    formData.append("file", audio, audio.name || "tina-voice-memo.webm");
    formData.append("model", model);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData,
      cache: "no-store"
    });

    const data = (await response.json()) as { text?: string; error?: { message?: string; code?: string; type?: string } };

    if (!response.ok) {
      const errorText = `${data.error?.code || ""} ${data.error?.type || ""} ${data.error?.message || ""}`.trim();
      return {
        ok: false as const,
        status: response.status,
        errorText,
        userMessage: transcriptionUserMessage(errorText)
      };
    }

    const transcript = data.text?.trim();
    if (!transcript) {
      return {
        ok: false as const,
        status: 422,
        errorText: "empty_transcript",
        userMessage: "I could not hear enough to transcribe that. Try again."
      };
    }

    return { ok: true as const, transcript };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      status: 502,
      errorText,
      userMessage: "Could not transcribe the voice memo. Try again."
    };
  }
}

function shouldTryFallbackTranscription(errorText: string) {
  const text = errorText.toLowerCase();
  return text.includes("model") || text.includes("does not exist") || text.includes("access");
}

function transcriptionUserMessage(errorText: string) {
  const text = errorText.toLowerCase();

  if (text.includes("invalid_api_key") || text.includes("unauthorized")) {
    return "Voice transcription is not configured correctly.";
  }

  if (text.includes("quota") || text.includes("billing")) {
    return "Voice transcription is temporarily unavailable.";
  }

  if (text.includes("rate")) {
    return "Voice transcription is busy. Try again in a moment.";
  }

  if (text.includes("audio") || text.includes("file")) {
    return "I could not read that audio. Try recording again.";
  }

  return "Could not transcribe the voice memo. Try again.";
}
