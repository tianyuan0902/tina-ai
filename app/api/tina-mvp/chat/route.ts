import { NextResponse } from "next/server";

import { retrieveBrainContext } from "@/lib/brain/retrieveBrainContext";
import { TINA_SYSTEM_PROMPT } from "@/lib/tina-mvp/system-prompt";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export const dynamic = "force-dynamic";

const USER_FACING_ERROR = "Tina lost context for a second. Try again.";

type OpenAIInputMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages?: TinaMvpMessage[] };
  const cleanMessages = normalizeMessages(messages);
  const latestUserMessage = [...cleanMessages].reverse().find((message) => message.role === "founder");

  if (!cleanMessages.length || !latestUserMessage) {
    return NextResponse.json({ error: "No founder message was provided." }, { status: 400 });
  }

  const brainContext = retrieveBrainContext(latestUserMessage.content);
  const instructions = [
    TINA_SYSTEM_PROMPT,
    "Relevant Tina Brain context follows. Use it as judgment, not as a script. Do not quote file names.",
    brainContext.context
  ].join("\n\n");
  const openaiMessages = cleanMessages.map(toOpenAIInputMessage);
  const finalMessagesForLog = [
    { role: "system", content: instructions },
    ...openaiMessages
  ];
  const openaiPayload = {
    model: process.env.TINA_OPENAI_MODEL || "gpt-4.1-mini",
    instructions,
    input: openaiMessages,
    max_output_tokens: 220,
    temperature: 0.7
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tina MVP] latest user message:", latestUserMessage.content);
    console.log(
      "[Tina MVP] retrieved brain chunks:",
      JSON.stringify(
        brainContext.chunks.map((chunk) => ({
          id: chunk.id,
          file: chunk.file,
          score: chunk.score,
          content: chunk.content
        })),
        null,
        2
      )
    );
    console.log("[Tina MVP] final OpenAI payload:");
    console.log(JSON.stringify(openaiPayload, null, 2));
    console.log("[Tina MVP] final messages array sent to OpenAI:");
    console.log(JSON.stringify(finalMessagesForLog, null, 2));
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[Tina MVP] OPENAI_API_KEY is missing.");
    return NextResponse.json(
      {
        error: USER_FACING_ERROR,
        debugCode: "missing_api_key"
      },
      { status: 500 }
    );
  }

  const { response, data, networkError } = await callOpenAI(openaiPayload);

  if (networkError || !response) {
    console.error("[Tina MVP] OpenAI network request failed:", networkError);
    return NextResponse.json(
      {
        error: USER_FACING_ERROR,
        debugCode: "network_error"
      },
      { status: 502 }
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tina MVP] OpenAI response status:", response.status);
  }

  if (!response.ok) {
    console.error("[Tina MVP] OpenAI request failed:", data);
    return NextResponse.json(
      {
        error: USER_FACING_ERROR,
        debugCode: getOpenAIDebugCode(data)
      },
      { status: response.status }
    );
  }

  const text = getOpenAIText(data);

  if (!text) {
    console.error("[Tina MVP] OpenAI response had no text:", data);
    return NextResponse.json(
      {
        error: USER_FACING_ERROR,
        debugCode: "empty_response"
      },
      { status: 502 }
    );
  }

  console.log("[Tina MVP] OpenAI response id:", data.id);

  return NextResponse.json({
    message: {
      id: data.id || `tina-${Date.now()}`,
      role: "tina",
      content: text
    },
    source: "openai",
    responseId: data.id
  });
}

async function callOpenAI(openaiPayload: object) {
  try {
    const first = await fetchOpenAI(openaiPayload);
    const firstData = await first.json();

    if (first.ok || !shouldRetry(first.status)) {
      return { response: first, data: firstData };
    }

    console.warn("[Tina MVP] OpenAI transient failure, retrying once:", first.status);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const second = await fetchOpenAI(openaiPayload);
    return { response: second, data: await second.json() };
  } catch (error) {
    return { networkError: error instanceof Error ? error.message : String(error) };
  }
}

function fetchOpenAI(openaiPayload: object) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(openaiPayload),
    cache: "no-store"
  });
}

function shouldRetry(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function getOpenAIDebugCode(data: unknown) {
  if (!data || typeof data !== "object") return "openai_error";
  const error = (data as { error?: { code?: string; type?: string; message?: string } }).error;
  const text = `${error?.code || ""} ${error?.type || ""} ${error?.message || ""}`.toLowerCase();

  if (text.includes("insufficient_quota") || text.includes("quota") || text.includes("billing")) return "billing_or_quota";
  if (text.includes("invalid_api_key") || text.includes("incorrect api key") || text.includes("unauthorized")) return "invalid_api_key";
  if (text.includes("model") && (text.includes("does not exist") || text.includes("access"))) return "model_access";
  if (text.includes("rate_limit")) return "rate_limit";

  return error?.code || error?.type || "openai_error";
}

function normalizeMessages(messages?: TinaMvpMessage[]) {
  return (messages || []).filter(
    (message): message is TinaMvpMessage =>
      Boolean(message) &&
      (message.role === "founder" || message.role === "tina") &&
      typeof message.content === "string" &&
      Boolean(message.content.trim())
  );
}

function toOpenAIInputMessage(message: TinaMvpMessage): OpenAIInputMessage {
  return {
    role: message.role === "founder" ? "user" : "assistant",
    content: message.content.trim()
  };
}

function getOpenAIText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const response = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };

  if (typeof response.output_text === "string") return response.output_text.trim();

  return (
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  );
}
