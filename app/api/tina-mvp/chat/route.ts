import { NextResponse } from "next/server";

import { retrieveBrainContext } from "@/lib/brain/retrieveBrainContext";
import { formatCompanyContext, isCompanyContextMessage, retrieveCompanyContext } from "@/lib/tina/company-context";
import { getRequestedProfileCount, searchPublicProfileLeads } from "@/lib/tina/public-search";
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

  if (isClearlyOffTopic(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-scope-${Date.now()}`,
        role: "tina",
        content: "I’m going to keep this tied to hiring and talent. How is that relevant to the role, team, candidate, or founder question you’re working through?"
      },
      source: "local_scope_guard"
    });
  }

  if (isProfileSearchFeedback(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-profile-feedback-${Date.now()}`,
        role: "tina",
        content: "Got it. I’ll treat those as the wrong lane. What should I bias toward instead: PM, operator, GTM, designer, founder-adjacent generalist, or something more specific?"
      },
      source: "local_profile_feedback"
    });
  }

  if (isPublicProfileSearchRequest(latestUserMessage.content)) {
    const hiringContext = cleanMessages.map((message) => message.content).join("\n");
    const requestedCount = getRequestedProfileCount(latestUserMessage.content);
    const profileLeads = await searchPublicProfileLeads(hiringContext, requestedCount);

    return NextResponse.json({
      message: {
        id: `tina-public-search-${Date.now()}`,
        role: "tina",
        content: `I found ${profileLeads.length} public profile ${profileLeads.length === 1 ? "lead" : "leads"} to review. I’d treat ${profileLeads.length === 1 ? "this as a person" : "these as people"} to inspect, not qualified candidates yet.`,
        profileLeads
      },
      source: "public_search"
    });
  }

  const brainContext = retrieveBrainContext(latestUserMessage.content);
  const companyContext = await retrieveCompanyContext(latestUserMessage.content);
  const formattedCompanyContext = formatCompanyContext(companyContext);
  const instructions = [
    TINA_SYSTEM_PROMPT,
    "If the founder gives company or product context, treat it as hiring calibration input. Infer what kinds of candidates may fit the company, product surface, customer environment, and operating stage. Do not ask why the company context matters.",
    "For normal chat, keep the answer compact and complete. Do not write long numbered memos. If the user asks for a sourcing strategy, give 2-3 sharp moves and one next question. If the answer needs more detail, invite expansion instead of dumping everything.",
    "Relevant Tina Brain context follows. Use it as judgment, not as a script. Do not quote file names.",
    brainContext.context,
    formattedCompanyContext
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
    max_output_tokens: 360,
    temperature: 0.65
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tina MVP] latest user message:", latestUserMessage.content);
    console.log("[Tina MVP] company context:", JSON.stringify(companyContext, null, 2));
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

function isClearlyOffTopic(message: string) {
  const text = message.toLowerCase();
  if (isCompanyContextMessage(message)) return false;

  const hiringSignal =
    /\b(hire|hiring|recruit|recruiting|candidate|talent|people|team|founder|startup|role|job|interview|sourcing|comp|compensation|salary|equity|offer|operator|engineer|designer|pm|product manager|sales|gtm|exec|executive|manager|leadership|org|organization|culture|market map|calibration|profile|archetype|resume|background|company|customer|market|industry)\b/.test(text);

  if (hiringSignal) return false;

  return /\b(hotel|flight|restaurant|travel|vacation|trip|visa|weather|recipe|cook|game|movie|song|shopping|buy|book me|find me a|design me a game|build me a game|homework|math problem|workout|dating|medical|doctor|lawyer|legal|tax)\b/.test(text);
}

function isPublicProfileSearchRequest(message: string) {
  if (isProfileSearchFeedback(message)) return false;

  const text = message.toLowerCase();
  const asksForApproach =
    /\b(how should i|how do i|approach|strategy|plan|calibrate|where should i start|what should i do|advice)\b/.test(text);
  const asksForSearchHelpOnly =
    /\b(create|write|build|draft|make|generate|give me)\b.*\b(linkedin search|search string|boolean|query|queries|company list|list of companies|companies)\b/.test(text) ||
    /\b(so i can|myself|on my own)\b/.test(text);
  const explicitProfileSearch =
    /\b(show|send|source|sourcing|look up|pull)\b.*\b(profiles?|people|candidates?|leads?|prospects?|targets?|linkedin|github)\b/.test(text) ||
    /\b(find|look for)\b.*\b(profiles?|linkedin profiles?|github profiles?|public profiles?|people to review|outreach targets|prospects?|leads?)\b/.test(text) ||
    /\b(who should we reach out to|who should i reach out to|source candidates|source people|find linkedin profiles|show linkedin profiles|public profile leads)\b/.test(text);

  return explicitProfileSearch && !asksForApproach && !asksForSearchHelpOnly;
}

function isProfileSearchFeedback(message: string) {
  return /\b(wrong|not right|not the right|not relevant|irrelevant|bad profiles|bad leads|these are all|all engineers|too broad|too senior|too junior|delete|remove)\b/i.test(message) &&
    /\b(profiles?|leads?|people|candidates?|engineers?|operators?|designers?|pms?)\b/i.test(message);
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
