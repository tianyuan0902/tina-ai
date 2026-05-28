import { NextResponse } from "next/server";

import { retrieveBrainContext } from "@/lib/brain/retrieveBrainContext";
import { formatCompanyContext, isCompanyContextMessage, retrieveCompanyContext } from "@/lib/tina/company-context";
import { getRequestedProfileCount, searchPublicProfileLeads } from "@/lib/tina/public-search";
import { evaluateSourcingReadiness } from "@/lib/tina/sourcing-readiness";
import { TINA_SYSTEM_PROMPT } from "@/lib/tina-mvp/system-prompt";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export const dynamic = "force-dynamic";

const USER_FACING_ERROR = "Tina lost context for a second. Try again.";
const FALLBACK_MODEL = "gpt-4.1-mini";

type OpenAIInputMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const { messages, sourcingRefinementSummary } = (await request.json()) as {
    messages?: TinaMvpMessage[];
    sourcingRefinementSummary?: string;
  };
  const cleanMessages = normalizeMessages(messages);
  const latestUserMessage = [...cleanMessages].reverse().find((message) => message.role === "founder");
  const refinementSummary = typeof sourcingRefinementSummary === "string" ? sourcingRefinementSummary.trim() : "";

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

  const promisedSourcingMessage = getPromisedSourcingMessage(cleanMessages);
  const shouldRunPromisedSourcing = isSourcingConfirmationRequest(cleanMessages);

  if (isPublicProfileSearchRequest(latestUserMessage.content) || shouldRunPromisedSourcing) {
    const searchTriggerMessage = shouldRunPromisedSourcing ? promisedSourcingMessage || "this hiring lane" : latestUserMessage.content;
    const isRefinementSearch = isSourcingRefinementRequest(latestUserMessage.content) && Boolean(refinementSummary);
    const readiness = evaluateSourcingReadiness(cleanMessages);
    const allowLowConfidenceSearch = shouldRunPromisedSourcing || /\b(source anyway|search anyway|pull anyway|continue|go ahead|show me anyway)\b/i.test(latestUserMessage.content);

    if (readiness.readinessStatus === "needs_calibration" || (readiness.readinessStatus === "low_confidence_search" && !allowLowConfidenceSearch)) {
      return NextResponse.json({
        message: {
          id: `tina-sourcing-readiness-${Date.now()}`,
          role: "tina",
          content: buildSourcingReadinessResponse(readiness),
          sourcingReadiness: readiness
        },
        source: "sourcing_readiness"
      });
    }

    const refinement = isRefinementSearch ? buildSourcingRefinementDebug(refinementSummary, cleanMessages) : undefined;
    const hiringContext = [
      cleanMessages.map((message) => message.content).join("\n"),
      readiness.searchThesis ? `Search thesis:\n${readiness.searchThesis}` : "",
      refinementSummary ? `Talent Pool feedback summary for sourcing refinement:\n${refinementSummary}` : "",
      refinement ? `Updated sourcing thesis:\n${refinement.updatedSearchThesis}` : ""
    ].filter(Boolean).join("\n\n");
    const requestedCount = getRequestedProfileCount(latestUserMessage.content);
    const promisedCount = getRequestedProfileCount(searchTriggerMessage);
    const finalRequestedCount = shouldRunPromisedSourcing ? promisedCount : requestedCount;
    const excludedUrls = collectShownProfileUrls(cleanMessages);
    const profileLeads = await searchPublicProfileLeads(hiringContext, finalRequestedCount, {
      excludedUrls,
      refinement
    });

    return NextResponse.json({
      message: {
        id: `tina-public-search-${Date.now()}`,
        role: "tina",
        content: buildProfileSearchResponse(shouldRunPromisedSourcing ? "this hiring lane" : latestUserMessage.content, profileLeads.length, isRefinementSearch, finalRequestedCount),
        profileLeads,
        sourcingReadiness: readiness
      },
      source: "public_search"
    });
  }

  const brainContext = retrieveBrainContext(latestUserMessage.content);
  const companyContext = await retrieveCompanyContext(latestUserMessage.content);
  const formattedCompanyContext = formatCompanyContext(companyContext);
  const liveJdRequest = isLiveJdRequest(latestUserMessage.content);
  const instructions = [
    TINA_SYSTEM_PROMPT,
    "If the founder gives company or product context, treat it as hiring calibration input. Infer what kinds of candidates may fit the company, product surface, customer environment, and operating stage. Do not ask why the company context matters.",
    "For normal chat, keep the answer compact, complete, and human. Sound like you are thinking with the founder in real time. Use contractions. Avoid stiff phrases like 'there are three key dimensions' or 'the optimal approach'. Tina is an AI talent partner: sourcing is the visible output, talent judgment is the engine. Move toward actionable candidates quickly. Ask only the questions needed to improve sourcing quality. If the founder is vague, say what is missing and why it would make candidate quality noisy. Do not over-calibrate before showing candidates. Preserve market intel and calibration as supporting intelligence.",
    liveJdRequest
      ? "The founder is asking for a JD or role description. Generate a complete draft with compact sections. Do not stop mid-bullet or end with an unfinished sentence."
      : "",
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
    model: process.env.TINA_OPENAI_MODEL || FALLBACK_MODEL,
    instructions,
    input: openaiMessages,
    max_output_tokens: liveJdRequest ? 1100 : 420,
    temperature: 0.72
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
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, "missing_api_key"),
      source: "local_fallback",
      debugCode: "missing_api_key"
    });
  }

  const { response, data, networkError } = await callOpenAI(openaiPayload);

  if (networkError || !response) {
    console.error("[Tina MVP] OpenAI network request failed:", networkError);
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, "network_error"),
      source: "local_fallback",
      debugCode: "network_error"
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tina MVP] OpenAI response status:", response.status);
  }

  if (!response.ok) {
    console.error("[Tina MVP] OpenAI request failed:", data);
    const debugCode = getOpenAIDebugCode(data);
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, debugCode),
      source: "local_fallback",
      debugCode
    });
  }

  const text = getOpenAIText(data);

  if (!text) {
    console.error("[Tina MVP] OpenAI response had no text:", data);
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, "empty_response"),
      source: "local_fallback",
      debugCode: "empty_response"
    });
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

function buildProfileSearchResponse(message: string, count: number, isRefinementSearch = false, requestedCount = count) {
  if (count === 0) {
    return "I did not find a novel public profile worth showing from that pass. Better to tighten the lane than recycle weak repeats.";
  }

  const qualityNote = count < requestedCount
    ? ` I found ${count} worth reviewing instead of forcing ${requestedCount}. Better a small useful batch than a decorative spreadsheet.`
    : "";

  if (isRefinementSearch) {
    return [
      `I pulled ${count} new public ${count === 1 ? "profile" : "profiles"} based on your Talent Pool feedback.`,
      `Use Yes/No as signal, not final judgment.${qualityNote}`
    ].join(" ");
  }

  const scope = inferRequestedScope(message);

  return [
    `I pulled ${count} public calibration ${count === 1 ? "profile" : "profiles"} for ${scope}.`,
    `Use Yes/No as signal, not final judgment. After three yeses, Tina has enough pattern to look for similar people.${qualityNote}`
  ].join(" ");
}

function buildSourcingReadinessResponse(readiness: ReturnType<typeof evaluateSourcingReadiness>) {
  const missing = readiness.missingSignals.slice(0, 2).join(" and ");
  const questions = readiness.followUpQuestions.slice(0, 2).map((question) => `- ${question}`).join("\n");

  if (readiness.readinessStatus === "low_confidence_search") {
    return [
      `I can source a calibration batch, but it’ll likely be noisy because I’m missing ${missing || "one or two search signals"}. That usually means weaker candidates and more title-matches.`,
      questions || "- What signal would make someone worth reviewing?"
    ].filter(Boolean).join("\n\n");
  }

  return [
    `I’d hold off on sourcing for one beat. Right now this is still title-shaped, not signal-shaped, so the Talent Pool would mostly be noise.`,
    questions || "- What would make someone a clear yes in the first 30 days?"
  ].join("\n\n");
}

function collectShownProfileUrls(messages: TinaMvpMessage[]) {
  return messages.flatMap((message) => message.profileLeads || []).map((lead) => lead.url).filter(Boolean);
}

function buildSourcingRefinementDebug(refinementSummary: string, messages: TinaMvpMessage[]) {
  const positivePatterns = extractRefinementSections(refinementSummary, "Positive signals");
  const negativePatterns = extractRefinementSections(refinementSummary, "Negative signals");
  const excludedUrls = collectShownProfileUrls(messages);
  const updatedSearchThesis = [
    positivePatterns.length ? `Bias toward ${compactPatternList(positivePatterns)}.` : "",
    negativePatterns.length ? `Avoid ${compactPatternList(negativePatterns)}.` : "",
    "Find novel public profiles only."
  ].filter(Boolean).join(" ");
  const queryHints = extractQueryHints([...positivePatterns, updatedSearchThesis]);
  const updatedQueries = queryHints.length
    ? queryHints.slice(0, 5).map((hint) => `site:linkedin.com/in "${hint}" "startup"`)
    : undefined;
  const debugObject = {
    positivePatterns,
    negativePatterns,
    excludedUrls,
    updatedSearchThesis,
    updatedQueries
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tina sourcing refinement]", JSON.stringify(debugObject, null, 2));
  }

  return debugObject;
}

function extractRefinementSections(summary: string, label: string) {
  const match = summary.match(new RegExp(`${label}:([\\s\\S]*?)(?:Positive signals:|Negative signals:|$)`, "i"));
  if (!match?.[1]) return [];

  return match[1]
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function compactPatternList(patterns: string[]) {
  return patterns
    .flatMap((pattern) => pattern.split(";"))
    .map((part) => part.replace(/\b(title|company|source|confidence|tags|fitReason|snippet|scope|mustHaves)=/gi, "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

function extractQueryHints(values: string[]) {
  const text = values.join(" ").toLowerCase();
  const hints = [
    /\b(ai product engineer|applied ai engineer|founding ai engineer)\b/i,
    /\b(founder office|chief of staff|startup operator|bizops)\b/i,
    /\b(founding product manager|product operator|product lead)\b/i,
    /\b(product-minded builder|startup builder|founding engineer)\b/i,
    /\b(customer-facing|workflow|evals|clarity|ownership)\b/i
  ];

  return hints.map((pattern) => text.match(pattern)?.[0]).filter((value): value is string => Boolean(value));
}

function isSourcingRefinementRequest(message: string) {
  return /\b(refine|another batch|talent pool feedback|based on my.*feedback|based on.*feedback)\b/i.test(message);
}

function isSourcingConfirmationRequest(messages: TinaMvpMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "founder");
  if (!latest || !/^\s*(yes|yep|yeah|sure|ok|okay|please do|go ahead|sounds good|do it)\s*[.!?]*\s*$/i.test(latest.content)) {
    return false;
  }

  const promised = getPromisedSourcingMessage(messages);

  return Boolean(promised);
}

function getPromisedSourcingMessage(messages: TinaMvpMessage[]) {
  const latestFounderIndex = [...messages].map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === "founder")?.index;
  const priorMessages = typeof latestFounderIndex === "number" ? messages.slice(0, latestFounderIndex) : messages;
  const previousTina = [...priorMessages].reverse().find((message) => message.role === "tina");
  const content = previousTina?.content || "";
  const promisedList =
    /\b(give me a moment|i['’]?ll share|i will share|i['’]?ll get you|i can pull|i['’]?ll pull|curated shortlist|shortlist|share the list|pull a batch|get a batch)\b/i.test(content) &&
    /\b(shortlist|profiles?|candidates?|people|engineers?|leads?|list|batch)\b/i.test(content);
  const calibrationQuestion = /\b(tighten those first|hold off|would be noisy|title-shaped|what would make|what role family|should we bias)\b/i.test(content);

  return promisedList && !calibrationQuestion ? content : "";
}

function inferRequestedScope(message: string) {
  const cleaned = message
    .replace(/\b(show|send|find|source|pull|give me|search for)\b/gi, "")
    .replace(/\b([1-9]|10|one|two|three|four|five)\b/gi, "")
    .replace(/\b(profiles?|people|candidates?|leads?|linkedin|public|about|around|for|me|like this)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();

  return cleaned || "this hiring lane";
}

function buildLocalFallbackMessage(messages: TinaMvpMessage[], debugCode: string): TinaMvpMessage {
  const founderMessages = messages.filter((message) => message.role === "founder");
  const latest = founderMessages[founderMessages.length - 1]?.content || "";
  const fullContext = founderMessages.map((message) => message.content).join(" ");

  return {
    id: `tina-local-${Date.now()}`,
    role: "tina",
    content: localHiringRead(fullContext || latest, debugCode)
  };
}

function localHiringRead(context: string, debugCode: string) {
  const text = context.toLowerCase();
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|design|ux)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|founder|bottleneck|chief of staff)\b/.test(text);
  const isPlant = /\b(plant|manufacturing|factory|operations manager|peoria|illinois)\b/.test(text);
  const isSenior = /\b(senior|staff|principal|lead|head|founding)\b/.test(text);
  const adapterNote = debugCode === "missing_api_key" || debugCode === "invalid_api_key"
    ? "The reasoning engine is not connected, so here’s the lightweight read for now."
    : "Tina’s deeper reasoning engine blinked, so here’s the lightweight read for now.";

  if (isAI && isProduct) {
    return [
      `${adapterNote} This sounds like an AI product builder search, not a pure ML research lane.`,
      "I’d screen for shipped AI workflows, product judgment under messy customer feedback, and enough systems taste to avoid demo magic.",
      isSenior
        ? "The market gets tight if you need seniority, AI depth, product instinct, and startup pace in one person. The market may have some opinions about that requirement set."
        : "A good next question: does this person need to own model quality, product discovery, or both?"
    ].join("\n\n");
  }

  if (isOperator) {
    return [
      `${adapterNote} This sounds like a founder-leverage hire more than a neat functional search.`,
      "I’d look for someone who closes loops with low explanation, can absorb messy context, and does not add process just to feel useful.",
      "What founder load should this person remove in the first 60 days?"
    ].join("\n\n");
  }

  if (isPlant) {
    return [
      `${adapterNote} This sounds like an operations leadership hire where environment fit matters a lot.`,
      "For a plant manager, I’d separate hands-on floor leadership from strategic scaling experience. Those can be very different people wearing the same title.",
      "Is this person mainly fixing daily execution, raising quality, or building a scalable operating system?"
    ].join("\n\n");
  }

  if (isProduct) {
    return [
      `${adapterNote} This looks like a product judgment search, not just a title search.`,
      "I’d test whether candidates reduce ambiguity or just organize it nicely. Early product hires can accidentally create a very elegant fog machine.",
      "What decision should this person make better than the team can today?"
    ].join("\n\n");
  }

  return [
    `${adapterNote} I’d start by turning this into one concrete outcome.`,
    "The useful screen is not the title yet; it’s what kind of ambiguity this person needs to remove and what tradeoff you can live with.",
    "What should be meaningfully better 90 days after this hire starts?"
  ].join("\n\n");
}

async function callOpenAI(openaiPayload: object) {
  try {
    const first = await fetchOpenAI(openaiPayload);
    const firstData = await first.json();

    if (first.ok) {
      return { response: first, data: firstData };
    }

    if (shouldTryFallbackModel(firstData, openaiPayload)) {
      console.warn("[Tina MVP] OpenAI model access failed, retrying with fallback model.");
      const fallback = await fetchOpenAI({ ...openaiPayload, model: FALLBACK_MODEL });
      return { response: fallback, data: await fallback.json() };
    }

    if (!shouldRetry(first.status)) {
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

function shouldTryFallbackModel(data: unknown, openaiPayload: object) {
  const requestedModel = (openaiPayload as { model?: string }).model;
  return requestedModel !== FALLBACK_MODEL && getOpenAIDebugCode(data) === "model_access";
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
  if (isSourcingRefinementRequest(message)) return true;

  const asksForApproach =
    /\b(how should i|how do i|approach|strategy|plan|calibrate|where should i start|what should i do|advice)\b/.test(text);
  const asksForSearchHelpOnly =
    /\b(create|write|build|draft|make|generate|give me)\b.*\b(linkedin search|search string|boolean|query|queries|company list|list of companies|companies)\b/.test(text) ||
    /\b(so i can|myself|on my own)\b/.test(text);
  const explicitProfileSearch =
    /\b(show|send|source|sourcing|look up|pull)\b.*\b(profiles?|people|candidates?|leads?|prospects?|targets?|linkedin|github)\b/.test(text) ||
    /\b(find|look for)\b.*\b(profiles?|linkedin profiles?|github profiles?|public profiles?|people to review|people like this|candidates?|outreach targets|prospects?|leads?)\b/.test(text) ||
    /\b(build|make|create)\b.*\b(list|candidate list|people list|profile list|talent pool)\b/.test(text) ||
    /\b(show me candidates|show candidates|who should we reach out to|who should i reach out to|source candidates|source people|find candidates|find people|find linkedin profiles|show linkedin profiles|public profile leads)\b/.test(text);

  return explicitProfileSearch && !asksForApproach && !asksForSearchHelpOnly;
}

function isLiveJdRequest(message: string) {
  return /\b(jd|job description|role description|draft the role|draft.*jd|create.*jd|write.*jd|generate.*jd|live jd|what you'll do|what you will do|responsibilities)\b/i.test(message);
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
