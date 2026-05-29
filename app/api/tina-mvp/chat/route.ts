import { NextResponse } from "next/server";

import { buildCanonicalSearchState, formatCanonicalSearchStateForPrompt, type CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import { retrieveBrainContext } from "@/lib/brain/retrieveBrainContext";
import { formatCompanyContext, isCompanyContextMessage, retrieveCompanyContext } from "@/lib/tina/company-context";
import { getRequestedProfileCount, searchPublicProfileBatch } from "@/lib/tina/public-search";
import { evaluateSourcingReadiness } from "@/lib/tina/sourcing-readiness";
import { TINA_SYSTEM_PROMPT } from "@/lib/tina-mvp/system-prompt";
import type { ProfileLead, SourcingBatchMetadata } from "@/lib/tina/profile-lead-types";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export const dynamic = "force-dynamic";

const USER_FACING_ERROR = "Tina lost context for a second. Try again.";
const FALLBACK_MODEL = "gpt-4.1-mini";

type OpenAIInputMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const { messages, sourcingRefinementSummary, canonicalSearchState: requestCanonicalSearchState } = (await request.json()) as {
    messages?: TinaMvpMessage[];
    sourcingRefinementSummary?: string;
    canonicalSearchState?: CanonicalSearchState;
  };
  const cleanMessages = normalizeMessages(messages);
  const latestUserMessage = [...cleanMessages].reverse().find((message) => message.role === "founder");
  const refinementSummary = typeof sourcingRefinementSummary === "string" ? sourcingRefinementSummary.trim() : "";
  const computedCanonicalSearchState = buildCanonicalSearchState({
    messages: cleanMessages,
    profileLeads: cleanMessages.flatMap((message) => message.profileLeads || [])
  });
  const canonicalSearchState = shouldUseRequestCanonicalState(latestUserMessage?.content || "", computedCanonicalSearchState, requestCanonicalSearchState)
    ? requestCanonicalSearchState!
    : computedCanonicalSearchState;
  const canonicalSearchStateText = formatCanonicalSearchStateForPrompt(canonicalSearchState);

  if (!cleanMessages.length || !latestUserMessage) {
    return NextResponse.json({ error: "No founder message was provided." }, { status: 400 });
  }

  const promisedSourcingMessage = getPromisedSourcingMessage(cleanMessages);
  const shouldRunPromisedSourcing = isSourcingConfirmationRequest(cleanMessages);
  const shouldRunAdjacentLane = isAdjacentLaneConfirmationRequest(cleanMessages);
  const shouldContinueSourcing = isSourcingContinuationRequest(cleanMessages);
  const shouldRunProfileSearch = isPublicProfileSearchRequest(latestUserMessage.content) || shouldRunPromisedSourcing || shouldRunAdjacentLane || shouldContinueSourcing;

  if (!shouldRunProfileSearch && isClearlyOffTopic(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-scope-${Date.now()}`,
        role: "tina",
        content: "That’s outside Tina’s lane. Bring me back to the hire, the team, or the talent question and I’ll be useful."
      },
      canonicalSearchState,
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
      canonicalSearchState,
      source: "local_profile_feedback"
    });
  }

  if (!shouldRunProfileSearch && isFounderUncertain(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-uncertain-${Date.now()}`,
        role: "tina",
        content: buildFounderUncertainResponse(canonicalSearchState)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  if (!shouldRunProfileSearch && isHardSearchSignal(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-hard-search-${Date.now()}`,
        role: "tina",
        content: buildHardSearchResponse(canonicalSearchState)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  if (!shouldRunProfileSearch && isOverbroadFounderAnswer(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-overbroad-answer-${Date.now()}`,
        role: "tina",
        content: buildOverbroadAnswerResponse(canonicalSearchState)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  if (!shouldRunProfileSearch && isAlignmentSignal(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-alignment-signal-${Date.now()}`,
        role: "tina",
        content: buildAlignmentSignalResponse(canonicalSearchState)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  if (!shouldRunProfileSearch && isPartialCoverageSignal(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-partial-coverage-${Date.now()}`,
        role: "tina",
        content: buildPartialCoverageResponse(canonicalSearchState)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  if (!shouldRunProfileSearch && isAgreementOnlySignal(latestUserMessage.content)) {
    return NextResponse.json({
      message: {
        id: `tina-agreement-${Date.now()}`,
        role: "tina",
        content: buildAgreementProgressionResponse(canonicalSearchState, cleanMessages)
      },
      canonicalSearchState,
      source: "local_conversation_move"
    });
  }

  const initialReadiness = evaluateSourcingReadiness(cleanMessages);

  if (isBareCalibrationRequest(latestUserMessage.content) && initialReadiness.readinessStatus === "needs_calibration") {
    return NextResponse.json({
      message: {
        id: `tina-sourcing-readiness-${Date.now()}`,
        role: "tina",
        content: buildSourcingReadinessResponse(initialReadiness, latestUserMessage.content, canonicalSearchState),
        sourcingReadiness: initialReadiness
      },
      canonicalSearchState,
      source: "sourcing_readiness"
    });
  }

  if (shouldRunProfileSearch) {
    const searchTriggerMessage = shouldRunPromisedSourcing || shouldRunAdjacentLane || shouldContinueSourcing ? promisedSourcingMessage || getPreviousTinaMessage(cleanMessages) || "this hiring lane" : latestUserMessage.content;
    const isRefinementSearch = isSourcingRefinementRequest(latestUserMessage.content) && Boolean(refinementSummary);
    const readiness = initialReadiness;
    const explicitSourceRequest = isPublicProfileSearchRequest(latestUserMessage.content) || shouldRunPromisedSourcing || shouldRunAdjacentLane || shouldContinueSourcing;

    if (explicitSourceRequest && needsLocationAlignmentBeforeSourcing(canonicalSearchState, latestUserMessage.content)) {
      return NextResponse.json({
        message: {
          id: `tina-location-before-sourcing-${Date.now()}`,
          role: "tina",
          content: buildLocationAlignmentResponse(canonicalSearchState),
          sourcingReadiness: readiness
        },
        canonicalSearchState,
        source: "sourcing_readiness"
      });
    }

    const allowCalibrationBatch = explicitSourceRequest && canRunCalibrationBatch(canonicalSearchState);
    const allowLowConfidenceSearch = allowCalibrationBatch || shouldRunPromisedSourcing || shouldRunAdjacentLane || shouldContinueSourcing || /\b(source anyway|search anyway|pull anyway|continue|go ahead|show me anyway)\b/i.test(latestUserMessage.content);

    if ((readiness.readinessStatus === "needs_calibration" && !allowCalibrationBatch) || (readiness.readinessStatus === "low_confidence_search" && !allowLowConfidenceSearch)) {
      return NextResponse.json({
        message: {
          id: `tina-sourcing-readiness-${Date.now()}`,
          role: "tina",
          content: buildSourcingReadinessResponse(readiness, latestUserMessage.content, canonicalSearchState),
          sourcingReadiness: readiness
        },
        canonicalSearchState,
        source: "sourcing_readiness"
      });
    }

    const refinement = isRefinementSearch
      ? buildSourcingRefinementDebug(refinementSummary, cleanMessages)
      : shouldRunAdjacentLane
        ? buildAdjacentLaneRefinement(cleanMessages)
        : undefined;
    const hiringContext = [
      `Canonical search state:\n${canonicalSearchStateText}`,
      cleanMessages.map((message) => message.content).join("\n"),
      readiness.searchThesis ? `Search thesis:\n${readiness.searchThesis}` : "",
      refinementSummary ? `Talent Pool feedback summary for sourcing refinement:\n${refinementSummary}` : "",
      refinement ? `Updated sourcing thesis:\n${refinement.updatedSearchThesis}` : ""
    ].filter(Boolean).join("\n\n");
    const requestedCount = getRequestedProfileCount(latestUserMessage.content);
    const promisedCount = getRequestedProfileCount(searchTriggerMessage);
    const recentRequestedCount = getRecentExplicitProfileRequestCount(cleanMessages);
    const finalRequestedCount = shouldRunPromisedSourcing || shouldContinueSourcing
      ? recentRequestedCount || promisedCount
      : requestedCount;
    const excludedUrls = collectShownProfileUrls(cleanMessages);
    const sourcingBatch = await searchPublicProfileBatch(hiringContext, finalRequestedCount, {
      excludedUrls,
      refinement
    });
    const { profileLeads, metadata } = sourcingBatch;

    const responseCanonicalSearchState = buildCanonicalSearchStateWithProfiles(canonicalSearchState, cleanMessages, profileLeads);

    return NextResponse.json({
      message: {
        id: `tina-public-search-${Date.now()}`,
        role: "tina",
        content: buildProfileSearchResponse(shouldRunPromisedSourcing ? "this hiring lane" : latestUserMessage.content, metadata, isRefinementSearch),
        profileLeads,
        sourcingBatch: metadata,
        sourcingReadiness: readiness
      },
      canonicalSearchState: responseCanonicalSearchState,
      profileLeads,
      source: "public_search"
    });
  }

  const brainContext = retrieveBrainContext(latestUserMessage.content);
  const companyContext = await retrieveCompanyContext(latestUserMessage.content);
  const formattedCompanyContext = formatCompanyContext(companyContext);
  const liveJdRequest = isLiveJdRequest(latestUserMessage.content);
  const adaptiveModeInstruction = buildAdaptiveModeInstruction(latestUserMessage.content, cleanMessages);
  const instructions = [
    TINA_SYSTEM_PROMPT,
    "If the founder gives company or product context, treat it as hiring calibration input. Infer what kinds of candidates may fit the company, product surface, customer environment, and operating stage. Do not ask why the company context matters.",
    "For normal chat, keep the answer compact, complete, and human. Sound like you are thinking with the founder in real time. Use contractions. Avoid stiff phrases like 'there are three key dimensions' or 'the optimal approach'. Tina is a Hiring Decision Engine: first diagnose the business problem, organizational context, and whether hiring is actually the right intervention. Your goal is to help the founder think; the task is secondary. Every response needs at least one observation the founder is unlikely to have articulated themselves. Do not merely summarize. On every follow-up, interpret the founder's latest answer before moving the workflow forward: what did it reveal, what ambiguity remains, what tradeoff was exposed, and what assumption surfaced? Once a meaningful signal has been extracted, do not keep rephrasing it; update the working hypothesis and produce a new observation. If the founder names a role but has not asked for candidates yet, do not jump to sourcing or intake fields. Ask one earned diagnostic question such as what changed, what is breaking, who owns the work now, or what fails if nobody is hired. If the founder gives enough signal for useful guidance, make the recommendation instead of asking more questions. If the founder explicitly asks for candidates, profiles, people, top schools, top companies, SF, fintech, AI infra, PM, or Product Eng, treat it as sourcing work, but do not blindly fill the req when the founder has just exposed a major unresolved tradeoff. Agreement is not permission to switch into scorecards or candidate evaluation process. Use 'I have enough for a first pass,' 'I’ll make a working assumption,' and 'I’ll filter hard' only when the tradeoff is clear enough. Do not say 'How is this relevant?', 'I’m missing role outcome', 'must-have signals are required', 'please provide', 'source lanes', 'calibration status', or 'canonical state'. Avoid 'Sounds like you need', 'The practical implication is', 'This implies', and 'scorecard'. Do not ask location, level, compensation, company lanes, or must-have skills unless the answer materially changes the recommendation. Do not say you are pulling, sharing, or preparing a candidate list later unless actual profile leads are included in this response.",
    adaptiveModeInstruction,
    "The structured search state is the current internal truth. If it conflicts with older messages, trust that state and the founder's latest correction. Do not mention the state object. Do not describe a different role family, location, seniority, or market lane.",
    canonicalSearchStateText,
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
      canonicalSearchState,
      source: "local_fallback",
      debugCode: "missing_api_key"
    });
  }

  const { response, data, networkError } = await callOpenAI(openaiPayload);

  if (networkError || !response) {
    console.error("[Tina MVP] OpenAI network request failed:", networkError);
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, "network_error"),
      canonicalSearchState,
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
      canonicalSearchState,
      source: "local_fallback",
      debugCode
    });
  }

  const text = getOpenAIText(data);

  if (!text) {
    console.error("[Tina MVP] OpenAI response had no text:", data);
    return NextResponse.json({
      message: buildLocalFallbackMessage(cleanMessages, "empty_response"),
      canonicalSearchState,
      source: "local_fallback",
      debugCode: "empty_response"
    });
  }

  const advisorText = enforceAdvisorTone(text, canonicalSearchState);

  if (isAssistantPromisingProfileList(advisorText)) {
    const readiness = evaluateSourcingReadiness(cleanMessages);

    if (readiness.readinessStatus !== "needs_calibration") {
      const requestedCount = getRequestedProfileCount(`${latestUserMessage.content}\n${advisorText}`);
      const hiringContext = [
        `Canonical search state:\n${canonicalSearchStateText}`,
        cleanMessages.map((message) => message.content).join("\n"),
        `Tina said she was pulling a shortlist; convert that promise into actual public profile sourcing.`,
        readiness.searchThesis ? `Search thesis:\n${readiness.searchThesis}` : "",
        `Draft response that triggered sourcing:\n${advisorText}`
      ].filter(Boolean).join("\n\n");
      const sourcingBatch = await searchPublicProfileBatch(hiringContext, requestedCount, {
        excludedUrls: collectShownProfileUrls(cleanMessages)
      });
      const { profileLeads, metadata } = sourcingBatch;

      const responseCanonicalSearchState = buildCanonicalSearchStateWithProfiles(canonicalSearchState, cleanMessages, profileLeads);

      return NextResponse.json({
        message: {
          id: `tina-public-search-${Date.now()}`,
          role: "tina",
          content: buildProfileSearchResponse("this hiring lane", metadata, false),
          profileLeads,
          sourcingBatch: metadata,
          sourcingReadiness: readiness
        },
        canonicalSearchState: responseCanonicalSearchState,
        profileLeads,
        source: "public_search"
      });
    }

    return NextResponse.json({
      message: {
        id: `tina-sourcing-readiness-${Date.now()}`,
        role: "tina",
        content: buildSourcingReadinessResponse(readiness, latestUserMessage.content, canonicalSearchState),
        sourcingReadiness: readiness
      },
      canonicalSearchState,
      source: "sourcing_readiness"
    });
  }

  console.log("[Tina MVP] OpenAI response id:", data.id);

  return NextResponse.json({
    message: {
      id: data.id || `tina-${Date.now()}`,
      role: "tina",
      content: advisorText
    },
    canonicalSearchState,
    source: "openai",
    responseId: data.id
  });
}

function isAssistantPromisingProfileList(message: string) {
  const text = message.toLowerCase();
  const promiseLanguage =
    /\b(i['’]?m pulling|i am pulling|i['’]?ll pull|i will pull|i['’]?ll get you|i will get you|i['’]?ll share|i will share|give me a moment)\b/.test(text);
  const listLanguage = /\b(shortlist|candidate list|profile list|list of|profiles?|candidates?|people|leads?|batch)\b/.test(text);
  const onlyOffering = /\b(want me to|would you like me to|should i)\b.*\b(pull|source|find|build|create)\b/.test(text) &&
    !/\b(i['’]?m pulling|i am pulling)\b/.test(text);

  return promiseLanguage && listLanguage && !onlyOffering;
}

function buildAdaptiveModeInstruction(latestUserMessage: string, messages: TinaMvpMessage[]) {
  const mode = inferAdaptiveMode(latestUserMessage, messages);
  const modeGuidance: Record<string, string> = {
    discovery: "Adaptive mode: Discovery. The founder is unsure or the root cause is unclear. Make one observation, explain why the premise needs diagnosis, and ask one sharp question about what is actually breaking. Do not source yet.",
    calibration: "Adaptive mode: Calibration. The role direction is plausible but tradeoffs are not defined. Interpret the founder's latest answer before advancing: what does it reveal, what ambiguity remains, what tradeoff was exposed, and what assumption surfaced? Use Observation → Risk → One Sharp Question if you ask anything. Do not ask intake-field questions. If the founder gave role, domain/company, and geography, do not restart diagnosis; calibrate the search lane and move toward sourcing.",
    execution: "Adaptive mode: Execution. The problem, role, and success criteria are clear enough. Stop diagnosing, make the recommendation, and move toward candidate strategy or sourcing.",
    market_reality: "Adaptive mode: Market Reality. The issue is feasibility, pool size, compensation, timing, or an unusually difficult profile. Discuss market reality and tradeoffs. Do not over-diagnose the role.",
    sourcing: "Adaptive mode: Sourcing. The founder explicitly asked for candidates, profiles, people, or a list. Execute sourcing if possible. Do not restart discovery.",
    subjective_quality: "Adaptive mode: Calibration. The founder used subjective quality language like best, elite, top-tier, 10x, or world-class. Translate that into observable behavior before treating it as a requirement."
  };

  return modeGuidance[mode];
}

function inferAdaptiveMode(latestUserMessage: string, messages: TinaMvpMessage[]) {
  const text = latestUserMessage.toLowerCase();
  if (isOverbroadFounderAnswer(latestUserMessage)) return "calibration";
  if (isPublicProfileSearchRequest(latestUserMessage) || /\b(show|pull|source|find|get|build)\b.*\b(profiles?|candidates?|people|leads?|list)\b/i.test(latestUserMessage)) return "sourcing";
  if (/\b(best|world[-\s]?class|elite|top[-\s]?tier|10x|rockstar)\b/i.test(latestUserMessage)) return "subjective_quality";
  if (/\b(market|feasible|realistic|comp|compensation|salary|equity|timeline|time to fill|pool|supply|hard to find|rare|one of the best)\b/i.test(latestUserMessage)) return "market_reality";
  if (hasRoleSignal(text) && (hasDomainOrCompanySignal(text) || hasGeographySignal(text))) return "calibration";
  if (/\b(i think|maybe|not sure|unsure|overwhelmed|don['’]?t know|who to hire|need a pm\b|need a head of product\b)\b/i.test(latestUserMessage)) return "discovery";
  if (/\b(own|owns|nobody owns|conversion dropped|activation|reliability|bottleneck|build infrastructure|reduce founder|clear success|because)\b/i.test(latestUserMessage)) return "execution";

  const founderMessages = messages.filter((message) => message.role === "founder").length;
  return founderMessages >= 3 ? "calibration" : "discovery";
}

function hasRoleSignal(text: string) {
  return /\b(engineer|developer|pm|product manager|designer|operator|gtm|sales|recruiter|plant manager|manager|head of|lead|chief of staff)\b/.test(text);
}

function hasDomainOrCompanySignal(text: string) {
  return /\b(company|called|fintech|web3|crypto|protocol|smart contract|smartcontract|solidity|healthcare|ai|ml|marketplace|devtools|saas|security|payments?)\b/.test(text);
}

function hasGeographySignal(text: string) {
  return /\b(us|u\.s\.|usa|united states|remote|sf|san francisco|bay area|new york|nyc|chicago|peoria|austin|seattle|london)\b/.test(text);
}

function shouldUseRequestCanonicalState(
  latestUserMessage: string,
  computed: CanonicalSearchState,
  provided?: CanonicalSearchState
) {
  if (!provided) return false;
  if (!isPublicProfileSearchRequest(latestUserMessage) && !/^\s*(yes|sure|go ahead|ok|okay|do it)\s*[.!?]*\s*$/i.test(latestUserMessage)) return false;
  if (computed.roleFamily !== "other" && computed.roleTitle !== "Role forming") return false;
  return provided.roleFamily !== "other" && provided.roleTitle !== "Role forming";
}

function canRunCalibrationBatch(state: CanonicalSearchState) {
  return state.roleFamily !== "other" &&
    state.roleTitle !== "Role forming" &&
    (
      state.location !== "Location forming" ||
      state.mustHaveSignals.length > 0 ||
      state.sourceCompanyLanes.length > 0
    );
}

function needsLocationAlignmentBeforeSourcing(state: CanonicalSearchState, message: string) {
  if (state.location && state.location !== "Location forming") return false;
  if (/\b(location flexible|no location constraint|anywhere|global|remote ok|remote is fine|distributed)\b/i.test(message)) return false;
  return state.roleFamily !== "other" && state.roleTitle !== "Role forming";
}

function buildLocationAlignmentResponse(state: CanonicalSearchState) {
  const role = readableRole(state);
  const seniority = suggestSeniorityForSearch(state);
  const comp = suggestCompForSearch(state, seniority);

  return [
    `I would not pull profiles yet — geography will change this search more than another sentence of role nuance.`,
    `My working read is ${seniority} for ${role}: senior enough to own judgment and tradeoffs, not necessarily a full executive hire. I’d use ${comp} as a directional comp band until the market tells us otherwise.`,
    `What location should I anchor first: SF/Bay Area, NYC, remote US, or somewhere else? Once we align that, I’ll add location, seniority, and comp to the search criteria before pulling candidates.`
  ].join("\n\n");
}

function suggestSeniorityForSearch(state: CanonicalSearchState) {
  if (state.seniority && state.seniority !== "Seniority forming") return state.seniority;
  if (state.roleFamily === "product") return "Senior / Lead PM";
  if (state.roleFamily === "engineering") return "Senior IC / Lead";
  if (state.roleFamily === "manufacturing operations") return "Senior Manager / Director";
  if (state.roleFamily === "gtm") return "Senior IC / early lead";
  return "senior operator";
}

function suggestCompForSearch(state: CanonicalSearchState, seniority: string) {
  if (state.compensation && state.compensation !== "Comp forming") return state.compensation;
  if (state.roleFamily === "product" && /lead|senior/i.test(seniority)) return "$180k-$260k base plus equity";
  if (state.roleFamily === "engineering" && /senior|lead|staff|principal/i.test(seniority)) return "$200k-$300k+ base plus equity";
  if (state.roleFamily === "manufacturing operations") return "market-local cash comp plus relocation support if needed";
  if (state.roleFamily === "gtm") return "market base/OTE plus meaningful upside";
  return "market senior-level comp";
}

function isBareCalibrationRequest(message: string) {
  const text = message.toLowerCase().trim();
  if (isPublicProfileSearchRequest(message) || isSourcingRefinementRequest(message)) return false;
  if (text.length > 90) return false;
  return /\b(find|need|hire|looking for)\b.*\b(pm|product manager|engineer|designer|operator|sales|gtm|recruiter|finance|legal|manager)\b/.test(text);
}

function buildCanonicalSearchStateWithProfiles(
  currentState: CanonicalSearchState,
  messages: TinaMvpMessage[],
  profileLeads: ProfileLead[]
): CanonicalSearchState {
  const rebuilt = buildCanonicalSearchState({ messages, profileLeads });
  const currentHasRole = currentState.roleFamily !== "other" && currentState.roleTitle !== "Role forming";
  const rebuiltLostRole = rebuilt.roleFamily === "other" || rebuilt.roleTitle === "Role forming";
  const candidateProfiles = rebuilt.candidateProfiles.length ? rebuilt.candidateProfiles : profileLeads;

  if (!currentHasRole || !rebuiltLostRole) {
    return {
      ...rebuilt,
      candidateProfiles,
      evidenceLevel: candidateProfiles.length ? rebuilt.evidenceLevel === "none" ? "public_unverified" : rebuilt.evidenceLevel : rebuilt.evidenceLevel,
      calibrationStatus: candidateProfiles.length ? "ready_to_source" : rebuilt.calibrationStatus
    };
  }

  return {
    ...currentState,
    candidateProfiles,
    evidenceLevel: candidateProfiles.length ? "public_unverified" : rebuilt.evidenceLevel,
    talentPoolSize: candidateProfiles.length ? rebuilt.talentPoolSize : currentState.talentPoolSize,
    timeToFill: rebuilt.timeToFill,
    calibrationStatus: candidateProfiles.length ? "ready_to_source" : currentState.calibrationStatus,
    lastUpdatedReason: currentState.lastUpdatedReason
  };
}

function enforceAdvisorTone(text: string, state: CanonicalSearchState) {
  const permissionPattern = /(?:\n\s*)?(?:Next move:\s*)?(?:Want me to|Should I|Would you like me to|Do you want me to)\s+[^?]*\?/gi;
  let cleaned = text.replace(permissionPattern, `\n\n${buildAdvisorNextMove(state)}`).trim();
  cleaned = cleaned.replace(/\bNot surprising\b/gi, "It is a hard search");
  cleaned = cleaned.replace(/\bNext move:\s*/gi, "");
  cleaned = cleaned.replace(/\bThe practical implication is\b/gi, "The sharper read is");
  cleaned = cleaned.replace(/\bThis implies\b/gi, "The hidden assumption is");
  cleaned = cleaned.replace(/\bSounds like you need\b/gi, "The risk is assuming you need");
  cleaned = cleaned.replace(/\bI['’]?d kick off with a focused scorecard[\s\S]*$/i, buildFounderPsychologyObservation(state));
  cleaned = cleaned.replace(/\bfocused scorecard\b/gi, "working thesis");

  if (hasUsefulFirstPassState(state) && isExecutionBiasedAnswer(cleaned)) {
    cleaned = cleaned.replace(
      /\n\n(?:What(?:'|’)?s|What is|Which|Should I|Want me to|Would you like me to|Do you want me to)[\s\S]*$/i,
      `\n\n${buildAdvisorNextMove(state)}`
    );
  }

  return cleaned.replace(/\n{3,}/g, "\n\n");
}

function isExecutionBiasedAnswer(text: string) {
  return /\b(i have enough|i’ll run|i'll run|i’d run|i'd run|i’ll filter|i'll filter|first pass|pull profiles|source profiles|candidate batch)\b/i.test(text);
}

function hasUsefulFirstPassState(state: CanonicalSearchState) {
  return state.roleFamily !== "other" &&
    state.roleTitle !== "Role forming" &&
    (
      state.location !== "Location forming" ||
      state.mustHaveSignals.length > 0 ||
      state.sourceCompanyLanes.length > 0 ||
      state.niceToHaveSignals.length > 0
    );
}

function buildAdvisorNextMove(state: CanonicalSearchState) {
  const location = state.location && state.location !== "Location forming" ? state.location : "the strongest available market";
  const title = state.roleTitle.toLowerCase();

  if (state.roleFamily === "engineering" && /\b(smart contract|solidity|web3|protocol)\b/.test(title)) {
    return `I’d keep the first pass anchored on shipped smart-contract or protocol work, then widen from exact Solidity titles to security-minded backend engineers if the batch is thin.`;
  }

  if (state.roleFamily === "engineering" && /\b(ai|infrastructure|platform|software|engineer)\b/.test(title)) {
    return `I’d run the first pass in ${location} around the closest proof-bearing engineering lane, then widen title before geography if the batch is thin.`;
  }

  if (state.roleFamily === "product") {
    return `I’d start with product leaders who have created clarity from messy customer signal, then compare them against operator-shaped PMs if the first lane is too polished.`;
  }

  if (state.roleFamily === "manufacturing operations") {
    return `I’d keep the first pass close to people who have run the actual floor in the target market, then widen title before loosening regulated-environment proof.`;
  }

  if (state.roleFamily === "gtm") {
    return `I’d start with people who have sold the earliest version of a product themselves, then widen industry before loosening ownership proof.`;
  }

  return `I’d start with the closest proof-bearing lane, then loosen one surface constraint at a time instead of broadening everything at once.`;
}

function buildProfileSearchResponse(message: string, metadata: SourcingBatchMetadata, isRefinementSearch = false) {
  const { requestedCount, validCount, filteredCount, filteredReasons } = metadata;
  const mostlyFiltered = filteredCount > validCount;
  const filteredReason = filteredReasons.join(", ") || "they looked like role/function mismatches";
  const sourceNote = buildSearchSourceNote(metadata);

  if (metadata.searchStatus === "failed") {
    return [
      "I tried to run the public profile search, but Tavily did not return usable results.",
      "That is a search plumbing problem, not a talent-market read.",
      "I’d check the Tavily key/server logs first, then rerun the same lane."
    ].join(" ");
  }

  if (validCount === 0) {
    const expanded = metadata.audit?.queriesRun.length ? " I tried the exact lane, then expanded to adjacent titles and broader company/domain lanes." : "";
    const reason = filteredCount ? ` I filtered out ${filteredCount} false positives because ${filteredReason}.` : "";
    return [
      `I ran a first pass, but I don’t want to put weak profiles in front of you.${sourceNote}${expanded}${reason}`,
      buildSecondBestLaneRecommendation(message),
      `I’d widen geography or loosen title next while keeping the real proof strict.`
    ].join(" ");
  }

  const qualityNote = validCount < requestedCount
    ? ` I found ${validCount} worth reviewing out of the requested ${requestedCount}; I’m not padding this with weak matches.`
    : "";
  const filteredNote = filteredCount
    ? ` I filtered out the rest because ${filteredReason}.`
    : "";
  const validationLead = mostlyFiltered
    ? `Yeah — I ran a first pass and kept only the ${validCount} ${validCount === 1 ? "profile" : "profiles"} with real signal.`
    : "";

  if (isRefinementSearch) {
    return [
      validationLead || `Yeah — I ran another pass from your Talent Pool feedback and found ${validCount} new ${validCount === 1 ? "profile" : "profiles"} worth reviewing.`,
      `I added ${validCount === 1 ? "it" : "them"} to Talent Pool.${sourceNote}${qualityNote}${filteredNote} Tell me what feels closer or off and I’ll adjust the search from there.`
    ].join(" ");
  }

  return [
    validationLead || `Yeah — I ran a first pass and found ${validCount} ${validCount === 1 ? "profile" : "profiles"} worth reviewing.`,
    `I added ${validCount === 1 ? "it" : "them"} to Talent Pool.${sourceNote}${qualityNote}${filteredNote} Use these for calibration first; tell me what feels on or off and I’ll iterate from there.`
  ].join(" ");
}

function buildSearchSourceNote(metadata: SourcingBatchMetadata) {
  if (metadata.searchProvider === "mock") return " This is using fallback mock search because Tavily is not configured on the server.";
  if (metadata.searchStatus === "partial_failure") return " Tavily returned partial results; some query lanes failed.";
  return "";
}

function buildSecondBestLaneRecommendation(message: string) {
  const text = message.toLowerCase();

  if (/\b(plant|manufacturing|factory|healthcare|medical device|pharma|peoria)\b/.test(text)) {
    return "For this search, I’d stop treating “Plant Manager in Peoria healthcare” as the only acceptable doorway. The better next option is someone who has run regulated healthcare, medical-device, pharma, or food-manufacturing operations within driving range, even if their title is Operations Director, Manufacturing Manager, or Quality Operations Lead. That keeps the hard part intact: FDA/ISO discipline, labor leadership, and rapid scale-up pressure.";
  }

  if (/\b(engineer|technical|software|ai|ml)\b/.test(text)) {
    return "The better next option is not a looser engineer search; it’s a proof-based search. I’d look for builders with shipped product evidence first, then adjacent technical founders or product engineers whose titles are messy but whose work shows they actually built under real constraints.";
  }

  if (/\b(product|pm|designer)\b/.test(text)) {
    return "The better next option is to search for the operating pattern, not the cleanest title. I’d compare explicit product owners against operators or designers who repeatedly turned messy customer context into decisions, then use that contrast to calibrate what kind of judgment you actually need.";
  }

  return "The better next option is to preserve the real operating proof and loosen only one surface constraint. Usually that means adjacent titles with the same work, nearby markets with more supply, or one level up/down on seniority.";
}

function buildSourcingReadinessResponse(
  readiness: ReturnType<typeof evaluateSourcingReadiness>,
  latestUserMessage: string,
  state: CanonicalSearchState
) {
  const focalPoint = identifyAmbiguousFocalPoint(latestUserMessage, state);

  if (readiness.readinessStatus === "low_confidence_search") {
    return [
      `I have enough for a first pass. I’ll make a working assumption, filter hard, and return fewer candidates if the evidence is weak.`,
      readiness.usefulButNotBlocking?.length ? `We can tighten the softer parts after we see what the market gives us.` : ""
    ].filter(Boolean).join("\n\n");
  }

  return [
    focalPoint.observation,
    focalPoint.risk,
    focalPoint.question
  ].join("\n\n");
}

function identifyAmbiguousFocalPoint(message: string, state: CanonicalSearchState) {
  const text = message.toLowerCase();
  const role = readableRole(state);

  if (/\bbest\b/.test(text)) {
    return {
      observation: `The word “best” is doing too much work here.`,
      risk: `Best PM for a founder-led zero-to-one product, best PM for scaling a known motion, and best PM for cleaning up execution are three different people.`,
      question: `Best at what: customer discovery, product taste, execution discipline, or making the founder less central?`
    };
  }

  if (/\b(world[-\s]?class|elite|top[-\s]?tier|10x|rockstar)\b/.test(text)) {
    const match = message.match(/\b(world[-\s]?class|elite|top[-\s]?tier|10x|rockstar)\b/i)?.[0] || "top-tier";
    return {
      observation: `The phrase “${match}” is the fuzzy part.`,
      risk: `If we leave that subjective, we’ll optimize for pedigree or charisma instead of the behavior that actually changes the team.`,
      question: `What would make someone feel ${match}: speed of judgment, quality of taste, depth of craft, or ability to carry ambiguity?`
    };
  }

  if (/\bpm|product manager|head of product|product lead\b/.test(text)) {
    return {
      observation: `“${role}” is still a broad label.`,
      risk: `A PM who finds customer signal, a PM who drives execution, and a PM who makes the founder less central will search very differently.`,
      question: `Which ambiguity matters most right now: customer signal, priorities, execution, or founder bottleneck?`
    };
  }

  if (/\bengineer|developer|technical|software|platform|infrastructure\b/.test(text)) {
    return {
      observation: `“${role}” could mean several different building lanes.`,
      risk: `Title-matching too early can pull people who look technical but have not done the specific kind of building you need.`,
      question: `Which proof matters most: shipped product, infrastructure depth, technical ownership, or domain experience?`
    };
  }

  if (/\bmanager|operator|operations|gtm|sales|designer|recruiter\b/.test(text)) {
    return {
      observation: `The title is less ambiguous than the job it needs to do.`,
      risk: `If we do not name the operating problem, we may find someone impressive who solves the wrong kind of mess.`,
      question: `What is the messy part this person needs to take off your plate first?`
    };
  }

  return {
    observation: `The ambiguous part is the job behind the title.`,
    risk: `If we search from the label alone, we’ll get plausible profiles without knowing what they need to change in the company.`,
    question: `What is the thing this person needs to make easier first?`
  };
}

function isFounderUncertain(message: string) {
  return /\b(i don['’]?t know yet|not sure yet|unsure|haven['’]?t figured it out|still figuring it out|no idea yet)\b/i.test(message);
}

function isHardSearchSignal(message: string) {
  return /\b(hard to find|hard finding|been hard|difficult to find|struggling to find|can['’]?t find|haven['’]?t found|search has been hard|sourcing.*hard)\b/i.test(message);
}

function isOverbroadFounderAnswer(message: string) {
  return /^\s*(all of it|everything|both|all three|all four|all|yes all|probably all of it)\s*[.!?]*\s*$/i.test(message);
}

function isAlignmentSignal(message: string) {
  return /\b(alignment|prioritization|prioritisation|priorities)\b/i.test(message) &&
    !/\b(profile|profiles|candidate|candidates|people|source|pull|find)\b/i.test(message);
}

function buildAlignmentSignalResponse(state: CanonicalSearchState) {
  const role = readableRole(state);
  const productLine = state.roleFamily === "product" || /\bpm|product/i.test(state.roleTitle)
    ? `That points to a PM who can turn messy disagreement into a decision, not just keep everyone informed.`
    : `That points to someone who can create decision clarity, not just coordinate the room.`;

  return [
    `Alignment is usually what founders call the problem when nobody owns the final decision.`,
    `${productLine} For a ${role}, I’d be careful not to over-index on “strong communicator” — that can become meeting fluency without real authority.`,
    `Where does prioritization actually break today: too many inputs, unclear owner, weak product judgment, or people disagreeing and escalating back to you?`
  ].join("\n\n");
}

function isPartialCoverageSignal(message: string) {
  return /\b(i have|we have|there is|there's|got)\b.*\b(person|someone|pm|engineer|operator|lead)\b.*\b(not enough|isn['’]?t enough|not working|still stuck|still on me|not moving|not solving)\b/i.test(message) ||
    /\bnot enough\b/i.test(message) && /\b(person|someone|coverage|help|pm|engineer)\b/i.test(message);
}

function isAgreementOnlySignal(message: string) {
  return /^\s*(sounds great|sounds good|makes sense|that makes sense|great|ok|okay|yes|yeah|yep|got it|agree|agreed)\s*[.!?]*\s*$/i.test(message);
}

function buildAgreementProgressionResponse(state: CanonicalSearchState, messages: TinaMvpMessage[]) {
  const conversationText = messages.map((message) => message.content).join(" ").toLowerCase();

  if (state.roleFamily === "product" || /\bpm|product/i.test(state.roleTitle)) {
    if (/\bautonom|run themselves|independent|decision|judgment|mostly me|founder\b/.test(conversationText)) {
      return [
        `One thing I’d keep in mind: founders often say they want autonomy, then struggle to give it away once they find the person.`,
        `That is usually harder than the hiring itself. The search is not just for a PM with judgment; it is for someone you will actually let make product calls before they have earned perfect trust.`,
        `The next useful question is not candidate evaluation yet. It is where you are most likely to pull decisions back: priorities, customer interpretation, engineering tradeoffs, or final product taste.`
      ].join("\n\n");
    }

    return [
      `The thesis is moving from “hire a PM” to “reduce founder decision load without adding process.”`,
      `That is a different search. A polished roadmap person may look safe and still leave you as the real product brain.`,
      `The next thing I’d pressure-test is where the PM needs to take real authority first: priorities, customer signal, or shipping tradeoffs.`
    ].join("\n\n");
  }

  return [
    `The useful part is that the hiring problem is starting to separate from the job title.`,
    `That usually means the next risk is hiring for competence when the company actually needs leverage: someone who changes where decisions live.`,
    `Before turning this into process, I’d pressure-test which decision you most want to stop carrying yourself.`
  ].join("\n\n");
}

function buildFounderPsychologyObservation(state: CanonicalSearchState) {
  if (state.roleFamily === "product" || /\bpm|product/i.test(state.roleTitle)) {
    return [
      `One thing I’d keep in mind: founders often say they want autonomy, then struggle to give it away once they find the person.`,
      `That is usually harder than the hiring itself. The search is partly for PM judgment, but partly for the founder’s willingness to let that judgment stand before trust feels fully proven.`
    ].join("\n\n");
  }

  return `One thing I’d keep in mind: the hire only creates leverage if the founder is willing to move decisions out of their own hands. That is usually harder than spotting a competent candidate.`;
}

function buildPartialCoverageResponse(state: CanonicalSearchState) {
  const role = readableRole(state);

  if (state.roleFamily === "product" || /\bpm|product/i.test(state.roleTitle)) {
    return [
      `Having a person but still feeling the gap usually means the missing thing is authority, judgment, or leverage — not raw PM bandwidth.`,
      `The risk is hiring another ${role} who reports information back to you instead of taking work off your plate. I’d want to know whether the current person is blocked by skill, mandate, or the founder still being the real decision-maker.`,
      `What can they not own end-to-end today: choosing priorities, saying no, driving engineering, or making product calls without you?`
    ].join("\n\n");
  }

  return [
    `Having someone in the seat but still feeling the gap usually means the role is missing leverage, not effort.`,
    `The risk is adding another similar profile and accidentally increasing coordination load while the real bottleneck stays with you.`,
    `What is the current person unable to take off your plate: decisions, execution, team pressure, or customer/context judgment?`
  ].join("\n\n");
}

function buildOverbroadAnswerResponse(state: CanonicalSearchState) {
  if (state.roleFamily === "product" || /\bpm|product/i.test(state.roleTitle)) {
    return [
      `That answer is useful, but not because it resolves the search.`,
      `It tells me this PM role is carrying too many jobs: customer discovery, product taste, execution discipline, and probably some founder leverage. The tradeoff is real — one person can be strong across two or three of those, but if we screen for all of them equally, we’ll either end up with a very expensive Head of Product profile or a polished generalist who is not actually great at the hard part.`,
      `I’d force the first cut: do you need this person to find the right thing, decide the right thing, or get the right thing shipped?`
    ].join("\n\n");
  }

  if (state.roleFamily === "engineering") {
    return [
      `That answer is a signal: the role is probably carrying more surface area than one hire can cleanly own.`,
      `The tradeoff is depth versus coverage. If we screen for every technical strength at once, we’ll get impressive profiles but not necessarily the person who solves the bottleneck.`,
      `What matters most first: architecture depth, shipping speed, technical leadership, or domain proof?`
    ].join("\n\n");
  }

  return [
    `That tells me the role is still doing too much work in your head.`,
    `The risk is not that the requirement is wrong; it’s that we search for a universal candidate and lose the actual problem this person needs to solve.`,
    `What would you rather protect first: speed, judgment, craft depth, or taking work off the founder?`
  ].join("\n\n");
}

function buildFounderUncertainResponse(state: CanonicalSearchState) {
  const role = readableRole(state);
  const location = state.location !== "Location forming" ? ` in ${state.location}` : "";
  const proof = state.mustHaveSignals[0] || state.niceToHaveSignals[0] || "evidence they have done the hard part before";

  return [
    `That’s okay — we don’t need the perfect spec yet.`,
    `I’d start with a few working assumptions for ${role}${location}: strong ownership, ${proof}, and enough startup pace to operate without a lot of hand-holding.`,
    `The two things I’d clarify first: what this person must make easier in the first 60 days, and what kind of background you already know is probably wrong.`
  ].join("\n\n");
}

function buildHardSearchResponse(state: CanonicalSearchState) {
  const role = readableRole(state);
  const location = state.location !== "Location forming" ? ` in ${state.location}` : "";

  return [
    `It is a hard search — ${role}${location} is exactly the kind of lane where title match can look useful and still miss the real proof.`,
    `Tell me what you’ve found so far: are you seeing too few people, the wrong seniority, weak evidence, comp mismatch, or people just not responding?`,
    `Also, how long has the search been running? That tells me whether we should tighten the bar, widen the market, or change the pitch.`
  ].join("\n\n");
}

function readableRole(state: CanonicalSearchState) {
  if (state.roleTitle && state.roleTitle !== "Role forming") return state.roleTitle;
  if (state.roleFamily !== "other") return `${state.roleFamily} hire`;
  return "this hire";
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

function isAdjacentLaneConfirmationRequest(messages: TinaMvpMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "founder");
  if (!latest || !/\b(sure|ok|okay|go ahead|sounds good|yes|yep|try that|do that|that works|show me|run it)\b/i.test(latest.content)) {
    return false;
  }

  const previous = getPreviousTinaMessage(messages).toLowerCase();
  if (/\bi found public results\b|\brole-fit validation\b|\bfiltered out \d+ false/i.test(previous)) return false;
  return /\b(better next option|adjacent title|nearby markets|surface constraint|driving range|exact title and widen geography|operations director|manufacturing manager|quality operations)\b/.test(previous);
}

function isSourcingContinuationRequest(messages: TinaMvpMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "founder");
  if (!latest || !/^\s*(yes|yep|yeah|sure|ok|okay|please do|go ahead|sounds good|do it)\s*[.!?]*\s*$/i.test(latest.content)) {
    return false;
  }

  const latestFounderIndex = messages.map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === "founder")?.index;
  const priorMessages = typeof latestFounderIndex === "number" ? messages.slice(0, latestFounderIndex) : messages;
  const recentFounderAskedForProfiles = priorMessages
    .filter((message) => message.role === "founder")
    .slice(-3)
    .some((message) => isPublicProfileSearchRequest(message.content));
  const previousTina = getPreviousTinaMessage(messages).toLowerCase();
  const permissionPrompt = /\b(want me to|should i|would you like me to|i can)\b.*\b(source|pull|find|share|show)\b/.test(previousTina) ||
    /\bexamples?|archetypes?|search strings?|boolean\b/.test(previousTina);

  return recentFounderAskedForProfiles && permissionPrompt;
}

function getRecentExplicitProfileRequestCount(messages: TinaMvpMessage[]) {
  const latestFounderIndex = messages.map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === "founder")?.index;
  const priorMessages = typeof latestFounderIndex === "number" ? messages.slice(0, latestFounderIndex) : messages;
  const explicitRequest = [...priorMessages]
    .reverse()
    .find((message) => message.role === "founder" && isPublicProfileSearchRequest(message.content));

  if (!explicitRequest) return undefined;
  const explicitNumber = explicitRequest.content.match(/\b([1-9]|10)\b(?:\s+\w+){0,4}\s+(profiles?|people|leads?|candidates?|targets?)\b/i);
  const explicitWord = explicitRequest.content.match(/\b(one|two|three|four|five)\b(?:\s+\w+){0,4}\s+(profiles?|people|leads?|candidates?|targets?)\b/i);
  const wordCounts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

  if (explicitNumber) return Number(explicitNumber[1]);
  if (explicitWord) return wordCounts[explicitWord[1].toLowerCase()];
  return undefined;
}

function buildAdjacentLaneRefinement(messages: TinaMvpMessage[]) {
  const context = messages.map((message) => message.content).join(" ").toLowerCase();

  if (/\b(plant|manufacturing|factory|healthcare|medical device|pharma|peoria)\b/.test(context)) {
    return {
      positivePatterns: [
        "regulated healthcare manufacturing operations",
        "FDA ISO quality operations",
        "plant leadership within driving range"
      ],
      negativePatterns: ["generic startup operator", "gtm", "finance", "software product"],
      updatedSearchThesis: "Preserve regulated manufacturing operating proof; relax exact Plant Manager title before widening geography.",
      updatedQueries: [
        'site:linkedin.com/in "operations director" "healthcare manufacturing" "Peoria"',
        'site:linkedin.com/in "manufacturing operations manager" "medical device" "Illinois"',
        'site:linkedin.com/in "plant manager" "regulated manufacturing" "Chicago"',
        'site:linkedin.com/in "quality operations" "FDA" "ISO" "manufacturing"',
        'site:linkedin.com/in "production manager" "medical device manufacturing" "Midwest"'
      ]
    };
  }

  return {
    positivePatterns: ["same operating proof", "adjacent title", "nearby market"],
    negativePatterns: ["wrong function", "generic title match"],
    updatedSearchThesis: "Preserve the real operating proof and relax one surface constraint.",
    updatedQueries: undefined
  };
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

function getPreviousTinaMessage(messages: TinaMvpMessage[]) {
  const latestFounderIndex = [...messages].map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === "founder")?.index;
  const priorMessages = typeof latestFounderIndex === "number" ? messages.slice(0, latestFounderIndex) : messages;
  return [...priorMessages].reverse().find((message) => message.role === "tina")?.content || "";
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
  if (isPublicProfileSearchRequest(message)) return false;

  const hiringSignal =
    /\b(hire|hiring|recruit|recruiting|candidate|candidates|talent|people|team|founder|startup|role|job|interview|sourcing|source|comp|compensation|salary|equity|offer|operator|engineer|eng|designer|pm|product manager|sales|gtm|exec|executive|manager|leadership|org|organization|culture|market map|calibration|profile|profiles|archetype|resume|background|company|customer|market|industry)\b/.test(text);

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
    /\b(give me|get me)\b.*\b(profiles?|people|candidates?|leads?|prospects?|targets?|linkedin|github)\b/.test(text) ||
    /\b(find|look for)\b.*\b(profiles?|linkedin profiles?|github profiles?|public profiles?|people to review|people like this|candidates?|outreach targets|prospects?|leads?)\b/.test(text) ||
    /\b(build|make|create)\b.*\b(list|candidate list|people list|profile list|talent pool)\b/.test(text) ||
    /\b(show me candidates|show candidates|give me candidates|get me candidates|who should we reach out to|who should i reach out to|source candidates|source people|find candidates|find people|find linkedin profiles|show linkedin profiles|public profile leads)\b/.test(text);

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
