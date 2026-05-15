import type {
  CandidateFeedback,
  CandidateProfile,
  KickoffBrief,
  MarketShift,
  TinaMessage,
  TinaState,
  WorkspaceState
} from "@/lib/types";
import { MOCK_CANDIDATE_PROFILES } from "@/lib/mock-candidates";
import { CANDIDATE_ARCHETYPES, getArchetypeNames } from "@/lib/tina-brain/candidate-archetypes";
import { FOUNDER_COACHING_RESPONSES } from "@/lib/tina-brain/founder-coaching-responses";
import {
  DEFAULT_MARKET_SNAPSHOT,
  MARKET_LANGUAGE,
  getMarketReality,
  getMarketSnapshotFromText,
  getRecommendedSourcingDirection,
  getTradeoffsForWorkspace,
  maybeCreateMarketShift
} from "@/lib/tina-brain/market-tradeoffs";
import { conversationalTinaReply } from "@/lib/tina-brain/response-style";

export const seedHiringNeed =
  "We need a founding AI engineer who can move fast, work with customers, and ideally has OpenAI or Anthropic experience.";

export function createSeedState(initialNeed = seedHiringNeed): TinaState {
  const workspace = createWorkspaceFromText(initialNeed);
  const profiles = generateDynamicProfiles(workspace, initialNeed, []);

  return {
    messages: [
      {
        id: "seed-tina",
        role: "tina",
        content: "Hi, I'm Tina. What are we hiring for, and what does the business need this person to change?"
      }
    ],
    workspace,
    marketShifts: [],
    profiles,
    feedback: []
  };
}

export function applyFounderMessage(state: TinaState, text: string): TinaState {
  const previousSnapshot = state.workspace.marketSnapshot;
  const nextWorkspace = updateWorkspaceWithText(state.workspace, text);
  const shift = maybeCreateMarketShift(previousSnapshot, nextWorkspace.marketSnapshot, text);
  const conversationText = [...state.messages.map((message) => message.content), text].join("\n");
  const nextProfiles = generateDynamicProfiles(nextWorkspace, conversationText, state.feedback);
  const tinaReply = getFounderReply({
    text,
    previousMessages: state.messages,
    workspace: nextWorkspace,
    shift
  });

  return {
    ...state,
    messages: [
      ...state.messages,
      { id: `founder-${Date.now()}`, role: "founder", content: text },
      { id: `tina-${Date.now()}`, role: "tina", content: tinaReply }
    ],
    workspace: nextWorkspace,
    marketShifts: shift ? [shift, ...state.marketShifts].slice(0, 3) : state.marketShifts,
    profiles: nextProfiles
  };
}

export function applyCandidateFeedback(
  state: TinaState,
  profileId: string,
  direction: "up" | "down",
  reason: string
): TinaState {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return state;

  const feedback: CandidateFeedback = {
    profileId,
    archetype: profile.archetype,
    direction,
    reason
  };

  const nextWorkspace = updateWorkspaceWithFeedback(state.workspace, feedback);
  const nextFeedback = [...state.feedback, feedback];
  const nextProfiles = generateDynamicProfiles(
    nextWorkspace,
    state.messages.map((message) => message.content).join("\n"),
    nextFeedback
  );
  const reply = getFeedbackReply(feedback);

  return {
    ...state,
    feedback: nextFeedback,
    workspace: nextWorkspace,
    profiles: nextProfiles,
    messages: [
      ...state.messages,
      {
        id: `feedback-${Date.now()}`,
        role: "founder",
        content: `${direction === "up" ? "Thumbs up" : "Thumbs down"}: ${profile.archetype} - ${reason}`
      },
      {
        id: `feedback-tina-${Date.now()}`,
        role: "tina",
        content: reply
      }
    ]
  };
}

export function createKickoffBrief(state: TinaState): KickoffBrief {
  return {
    currentHiringDirection: state.workspace.currentHiringDirection,
    whatWeKnow: state.workspace.whatWeKnow,
    openAssumptions: state.workspace.openAssumptions,
    tradeoffsToMonitor: state.workspace.tradeoffsToMonitor,
    preferredCandidateArchetypes: state.workspace.candidateArchetypes.filter(
      (name) => state.workspace.archetypeWeights[name] !== "Down"
    ),
    sampleCandidateFeedbackSummary: state.feedback.length
      ? state.feedback.map(
          (item) => `${item.direction === "up" ? "Positive" : "Negative"} on ${item.archetype}: ${item.reason}`
        )
      : ["No candidate archetype feedback recorded yet."],
    marketReality: state.workspace.marketReality,
    recommendedSourcingDirection: state.workspace.recommendedSourcingDirection,
    livingJdDraft: state.workspace.livingJdDraft
  };
}

function createWorkspaceFromText(text: string): WorkspaceState {
  const snapshot = calibrateMarketSnapshot(getMarketSnapshotFromText(text), text);
  const hasFrontierRequirement = hasHardFrontierRequirement(text);
  const weights = getDynamicArchetypeWeights(text);

  const workspace: WorkspaceState = {
    currentHiringDirection: inferRoleDirection(text, "Hiring direction is still early. Tina is listening for the business problem, role scope, and proof signals."),
    marketReality: getMarketReality(snapshot, hasFrontierRequirement),
    candidateArchetypes: rankArchetypes(weights),
    archetypeWeights: weights,
    openAssumptions: getOpenAssumptionsForText(text, hasFrontierRequirement),
    tradeoffsToMonitor: getTradeoffsForWorkspace(snapshot, hasFrontierRequirement),
    suggestedNextMove: getSuggestedNextMoveForText(text, hasFrontierRequirement),
    marketSnapshot: snapshot,
    whatWeKnow: mergeUnique(
      ["The role is pre-search and still being shaped through conversation."],
      extractSignals(text)
    ),
    recommendedSourcingDirection: "Start broad, then let founder feedback tighten the candidate lane.",
    livingJdDraft: getLivingJdDraft(text, hasFrontierRequirement)
  };

  return {
    ...workspace,
    recommendedSourcingDirection: getRecommendedSourcingDirection(workspace)
  };
}

function updateWorkspaceWithText(workspace: WorkspaceState, text: string): WorkspaceState {
  const snapshot = calibrateMarketSnapshot(getMarketSnapshotFromText(text, workspace.marketSnapshot), text);
  const hasFrontierRequirement = hasHardFrontierRequirement(text);
  const wantsProductBuilders = /product|customer|ship|move fast|builder|not research|too research/i.test(text);
  const wantsSystemsBuilders = /infra|infrastructure|distributed|systems|backend|scale|reliability/i.test(text);
  const direction = inferRoleDirection(text, workspace.currentHiringDirection);
  const newSignals = extractSignals(text);
  const weights = { ...workspace.archetypeWeights, ...getDynamicArchetypeWeights(text, workspace.archetypeWeights) };

  if (hasFrontierRequirement) {
    weights["Frontier AI Lab Engineer"] = "Up";
    weights["Backend Infra Engineer with AI exposure"] = "Watch";
  }

  if (wantsSystemsBuilders) {
    weights["ML Infrastructure Engineer"] = "Up";
    weights["Backend Infra Engineer with AI exposure"] = "Up";
    weights["Startup AI Product Engineer"] = weights["Startup AI Product Engineer"] === "Down" ? "Down" : "Watch";
    weights["Applied AI Generalist"] = "Watch";
  }

  if (wantsProductBuilders) {
    weights["Startup AI Product Engineer"] = "Up";
    weights["Applied AI Generalist"] = "Up";
    weights["Frontier AI Lab Engineer"] = /too research|not research|research-heavy/i.test(text) ? "Down" : weights["Frontier AI Lab Engineer"];
  }

  const next: WorkspaceState = {
    ...workspace,
    currentHiringDirection: direction,
    marketSnapshot: snapshot,
    marketReality: getMarketReality(snapshot, hasFrontierRequirement),
    archetypeWeights: weights,
    candidateArchetypes: rankArchetypes(weights),
    openAssumptions: mergeUnique(workspace.openAssumptions, getOpenAssumptionsForText(text, hasFrontierRequirement)),
    tradeoffsToMonitor: getTradeoffsForWorkspace(snapshot, hasFrontierRequirement),
    suggestedNextMove: getSuggestedNextMoveForText(text, hasFrontierRequirement),
    whatWeKnow: mergeUnique(workspace.whatWeKnow, newSignals),
    livingJdDraft: getLivingJdDraft(text, hasFrontierRequirement, workspace.livingJdDraft)
  };

  return {
    ...next,
    recommendedSourcingDirection: getRecommendedSourcingDirection(next)
  };
}

function updateWorkspaceWithFeedback(workspace: WorkspaceState, feedback: CandidateFeedback): WorkspaceState {
  const weights = { ...workspace.archetypeWeights };
  weights[feedback.archetype] = feedback.direction === "up" ? "Up" : "Down";

  if (/too research|research-heavy|less research|product-minded|builder/i.test(feedback.reason)) {
    weights["Startup AI Product Engineer"] = "Up";
    weights["Applied AI Generalist"] = "Up";
    weights["Frontier AI Lab Engineer"] = "Down";
  }

  const next: WorkspaceState = {
    ...workspace,
    archetypeWeights: weights,
    candidateArchetypes: rankArchetypes(weights),
    marketReality: /too research|research-heavy/i.test(feedback.reason)
      ? "The market direction is shifting toward product-minded builders with practical AI judgment."
      : workspace.marketReality,
    openAssumptions: mergeUnique(workspace.openAssumptions, [
      "Candidate feedback is now shaping archetype weighting.",
      /too research|research-heavy/i.test(feedback.reason)
        ? "The founder is de-emphasizing research-heavy profiles."
        : "The team still needs to decide which tradeoff matters most."
    ]),
    suggestedNextMove: /too research|research-heavy/i.test(feedback.reason)
      ? "Compare Startup AI Product Engineer and Applied AI Generalist profiles next."
      : "Keep reacting to archetypes until one lane earns stronger pull."
  };

  return {
    ...next,
    recommendedSourcingDirection: getRecommendedSourcingDirection(next)
  };
}

function getFounderReply({
  text,
  previousMessages,
  workspace,
  shift
}: {
  text: string;
  previousMessages: TinaMessage[];
  workspace: WorkspaceState;
  shift?: MarketShift;
}) {
  const context = getConversationContext(previousMessages);

  if (isGreetingOnly(text)) {
    return "Hi. Tell me the role, the business problem, and what this hire needs to change.";
  }

  if (/\bwhere\b.*\bfintech\b|\bwhy\b.*\bfintech\b|\bfintech\b.*\bcome from\b/i.test(text)) {
    return conversationalTinaReply([
      "Fair push. I inferred fintech from the mock company context, not from the hiring request itself.",
      "I won’t treat it as a requirement unless you explicitly say it matters."
    ]);
  }

  if (isLowSignalHiringNeed(text) && context.founderTurns === 0) {
    return conversationalTinaReply(getLowSignalReply(text));
  }

  if (context.founderTurns > 0 && isLikelyAnswerToPreviousQuestion(text, context)) {
    return conversationalTinaReply([
      `${acknowledgeAnswer(text)} ${updateUnderstanding(text, workspace)}.`,
      getNextStrategicQuestion(text, context)
    ]);
  }

  if (asksAboutSourcing(text)) {
    return conversationalTinaReply([
      `I would start with ${inferSourcingLane(text)}, then compare one adjacent lane so we do not overfit too early.`,
      `The key is to search for proof of ownership and shipped work, not just title keywords. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksAboutJD(text)) {
    return conversationalTinaReply([
      `I would write the JD around outcomes: ${inferBusinessNeed(text)}.`,
      `Keep requirements tight: ownership, learning speed, and the specific technical surface area. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksAboutInterview(text)) {
    return conversationalTinaReply([
      "I would interview for evidence, not polish.",
      `Ask for one messy problem they owned end-to-end, one technical tradeoff they got wrong, and one example of working with ambiguous stakeholder pressure. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksAboutComp(text)) {
    return conversationalTinaReply([
      "I would treat comp as a market constraint, not a strategy.",
      `If you require rare pedigree plus founder-stage ownership, expect the range to move up quickly. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksAboutTimeline(text)) {
    return conversationalTinaReply([
      "Timeline depends on how narrow the must-haves are.",
      `A broad product-builder lane can move faster. A hard frontier-lab or rare infrastructure lane will need more patience and cleaner selling points. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksAboutRequirements(text)) {
    return conversationalTinaReply([
      "I would split this into must-have evidence and bonus signals.",
      `${inferMustHaveAdvice(text)} ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (asksForProfileChoice(text)) {
    return conversationalTinaReply([
      `Based on what we know, I would anchor on ${inferBestArchetype(text)} first.`,
      `Then I would compare one contrasting profile to expose the tradeoff before the team locks the role too tightly. ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  if (hasVagueSignal(text)) {
    return conversationalTinaReply([
      "I would slow down on that signal for a second. Phrases like “smart,” “good energy,” or “not a fit” can be useful, but they are not evidence yet.",
      "What do you mean specifically? Analytical smart, technical depth, communication quality, pace, judgment, ownership? The better signal is what they actually said or did that made you trust or doubt them.",
      "Gut feel matters, but especially in hiring it can also hide bias or incomplete pattern recognition. I would turn the feeling into observable behaviors before changing the bar."
    ]);
  }

  if (hasLowerBarSignal(text)) {
    return conversationalTinaReply([
      "I would not lower the bar. I think the bigger issue is probably that the requirements are too narrow.",
      "There is a difference between lowering excellence and expanding the types of backgrounds we are willing to consider. Especially at startups, trajectory, ownership, and adaptability can matter more than exact domain overlap.",
      "I would separate true must-haves from nice-to-haves, then broaden adjacent backgrounds before accepting weaker talent."
    ]);
  }

  if (hasOverqualifiedSignal(text)) {
    return conversationalTinaReply([
      "That could be a real risk, but I would tie it to urgency and scope. Overqualified is only a problem if the role cannot stretch fast enough or the person needs more structure than the company can provide.",
      "If the business pain is urgent, I would consider hiring the strong person and expanding scope around them. If timing allows, keep searching for someone whose ambition and patience match the actual role.",
      "The question I would ask is: will this person create leverage before they get bored?"
    ]);
  }

  if (hasHardFrontierRequirement(text)) {
    return conversationalTinaReply([
      FOUNDER_COACHING_RESPONSES.frontierHardGate,
      "Why specifically those labs? If what worked before was systems thinking, model intuition, or technical credibility, we can search for those traits directly. The logo is a proxy, and proxies get expensive fast.",
      "The tradeoff is that big-lab candidates may be excellent, but some will expect more structure, optimize for scale too early, or move slower than a founder-stage team needs. I would keep the pedigree as a strong signal unless frontier depth is truly the business bottleneck."
    ]);
  }

  if (/too research|research-heavy|not research/i.test(text)) {
    return conversationalTinaReply([
      FOUNDER_COACHING_RESPONSES.productBuilderNotResearch,
      "The business context matters here. If the company needs customer learning, fast iteration, and early product shape, the best signal is not research depth. It is evidence that someone has turned ambiguity into shipped behavior.",
      "I would screen for ownership, learning velocity, and judgment under messy customer pressure. The missing signal to watch is whether the product-minded builder still has enough eval and systems rigor."
    ]);
  }

  if (shift) {
    return conversationalTinaReply([
      "That changes the market read, but I would treat it as calibration rather than a final spec.",
      `${shift.changes.map((change) => `${change.label}: ${change.before} -> ${change.after}`).join(". ")}.`,
      `The bigger question is what business risk we are trying to reduce. ${shift.suggestedMove}`
    ]);
  }

  if (hasUsefulContext(text)) {
    return conversationalTinaReply([
      `${summarizeFounderInput(text)} I would use that to narrow the role around ${inferRoleLane(text)}.`,
      `${inferTradeoff(text)} ${getNextStrategicQuestion(text, context)}`
    ]);
  }

  return conversationalTinaReply([
    `${acknowledgeAnswer(text)} I need one more layer before I would turn this into search criteria.`,
    getNextStrategicQuestion(text, context)
  ]);
}

function getFeedbackReply(feedback: CandidateFeedback) {
  if (feedback.direction === "down" && /too research|research-heavy/i.test(feedback.reason)) {
    return conversationalTinaReply([
      FOUNDER_COACHING_RESPONSES.productBuilderNotResearch,
      "I would de-weight the profile only if the research depth is not paired with shipping evidence. The interview focus should be simple: ask for a messy customer problem they turned into product behavior.",
      "That will tell us more than the resume does."
    ]);
  }

  if (feedback.direction === "up") {
    return conversationalTinaReply([
      FOUNDER_COACHING_RESPONSES.feedbackPositive,
      `I would use ${feedback.archetype} as the next anchor, but I would still verify trajectory, how they work, and proof of business impact.`,
      "A good profile is only good if it fits the environment they are entering."
    ]);
  }

  return conversationalTinaReply([
    FOUNDER_COACHING_RESPONSES.feedbackNegative,
    `The risk you flagged is “${feedback.reason}.” I would compare the next closest archetype before changing the role spec, because the underlying strength may still matter.`,
    "This is how we expand the criteria without lowering the bar."
  ]);
}

function hasHardFrontierRequirement(text: string) {
  return /must|require|required|only/i.test(text) && /openai|anthropic|deepmind|frontier lab/i.test(text);
}

type ConversationContext = {
  founderTurns: number;
  askedQuestionIds: Set<string>;
  lastTinaQuestion: string;
};

function getConversationContext(messages: TinaMessage[]): ConversationContext {
  const founderTurns = messages.filter((message) => message.role === "founder").length;
  const tinaText = messages
    .filter((message) => message.role === "tina")
    .map((message) => message.content)
    .join("\n");
  const lastTina = [...messages].reverse().find((message) => message.role === "tina")?.content ?? "";

  return {
    founderTurns,
    askedQuestionIds: detectAskedQuestionIds(tinaText),
    lastTinaQuestion: lastTina
  };
}

function detectAskedQuestionIds(text: string) {
  const asked = new Set<string>();

  if (/ship AI product fast|own the AI infra|long-term AI strategy|product strategist|execution lead|founder translator|craft leader|discovery partner|systems thinker|learning velocity|closing ability|repeatable sales motion|primarily a builder|specialist|strategy owner/i.test(text)) {
    asked.add("lane");
  }

  if (/business problem|business risk|solving first|change\?|reduce first/i.test(text)) {
    asked.add("business_need");
  }

  if (/90 days|first ninety|obviously successful|ship or clarify|change in the first 90/i.test(text)) {
    asked.add("success_90");
  }

  if (/customer-facing|customer facing|customer proximity|close should they be to customers|week to week/i.test(text)) {
    asked.add("customer_exposure");
  }

  if (/must prove|must-have|bonus signal|nice-to-have|hard requirement|true must-have|would not compromise|trade for stronger/i.test(text)) {
    asked.add("requirements");
  }

  if (/compare|archetype|profile|lane|candidate lane|pressure test/i.test(text)) {
    asked.add("archetype");
  }

  return asked;
}

function isLikelyAnswerToPreviousQuestion(text: string, context: ConversationContext) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return false;
  if (asksAboutSourcing(trimmed) || asksAboutJD(trimmed) || asksAboutInterview(trimmed)) return false;
  if (context.lastTinaQuestion.includes("?")) return true;

  return (
    trimmed.split(/\s+/).length <= 28 ||
    /\b(product|infra|infrastructure|strategy|customer|ship|ownership|speed|technical|depth|first|90|days|senior|startup|research|builder|lead|scale|roadmap)\b/i.test(trimmed)
  );
}

function acknowledgeAnswer(text: string) {
  if (/\binfra|infrastructure|distributed|systems|backend|scale|reliability\b/i.test(text)) {
    return "Got it — you are pulling the role toward technical depth.";
  }

  if (/\bcustomer|product|ship|workflow|users|speed|fast\b/i.test(text)) {
    return "Got it — you are pulling the role toward product velocity and customer learning.";
  }

  if (/\bstrategy|roadmap|long-term|direction|leadership\b/i.test(text)) {
    return "Got it — you are asking for more than execution.";
  }

  if (/\bnot|required|optional|nice\b/i.test(text)) {
    return "Got it — that changes what should be treated as a gate.";
  }

  return "Got it.";
}

function updateUnderstanding(text: string, workspace: WorkspaceState) {
  if (/\binfra|infrastructure|distributed|systems|backend|scale|reliability\b/i.test(text)) {
    return "I would now weight systems judgment higher than pure AI pedigree";
  }

  if (/\bcustomer|product|ship|workflow|users|speed|fast\b/i.test(text)) {
    return "I would now weight shipped product work and customer judgment higher";
  }

  if (/\bstrategy|roadmap|long-term|direction|leadership\b/i.test(text)) {
    return "I would now test whether this is a builder role or a technical product leadership role";
  }

  if (workspace.currentHiringDirection) {
    return `I am updating the direction to: ${workspace.currentHiringDirection}`;
  }

  return "I am updating the role shape instead of restarting the search";
}

function getNextStrategicQuestion(text: string, context: ConversationContext) {
  const candidates = getQuestionSequence(text);
  const next = candidates.find(
    (question) =>
      !context.askedQuestionIds.has(question.id) &&
      !sameQuestionFamily(question.text, context.lastTinaQuestion)
  );

  if (next) return next.text;

  return "What tradeoff are you most willing to make: narrower talent pool, higher comp, or more ramp time?";
}

function sameQuestionFamily(candidate: string, previous: string) {
  if (!previous) return false;

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = normalize(candidate);
  const b = normalize(previous);

  if (a === b) return true;
  if (a.includes("90 days") && b.includes("90 days")) return true;
  if (a.includes("customer") && b.includes("customer")) return true;
  if (a.includes("must") && b.includes("must")) return true;
  if (a.includes("compare") && b.includes("compare")) return true;
  if (a.includes("business problem") && b.includes("business problem")) return true;

  return false;
}

function getQuestionSequence(text: string) {
  const systemHeavy = /\binfra|infrastructure|distributed|systems|backend|scale|reliability\b/i.test(text);
  const productHeavy = /\bcustomer|product|ship|workflow|users|speed|fast\b/i.test(text);
  const strategyHeavy = /\bstrategy|roadmap|long-term|direction|leadership\b/i.test(text);

  if (systemHeavy) {
    return [
      { id: "customer_exposure", text: "How customer-facing does this person need to be in the first six months?" },
      { id: "success_90", text: "What would make them obviously successful after 90 days?" },
      { id: "requirements", text: "Which part is a true must-have: distributed systems depth, AI product judgment, or startup ownership?" },
      { id: "archetype", text: "Should we compare an ML infra lead against a product-minded AI engineer next?" }
    ];
  }

  if (strategyHeavy) {
    return [
      { id: "success_90", text: "What should this person change in the first 90 days: product direction, technical architecture, or team decision quality?" },
      { id: "customer_exposure", text: "How close should they be to customers versus internal technical strategy?" },
      { id: "requirements", text: "What evidence would prove they can lead through ambiguity without adding too much process?" },
      { id: "archetype", text: "Should we compare a builder-strategist against a more specialized AI lead?" }
    ];
  }

  if (productHeavy) {
    return [
      { id: "success_90", text: "What should they ship or clarify in the first 90 days?" },
      { id: "customer_exposure", text: "How much customer-facing work should be part of the role week to week?" },
      { id: "requirements", text: "How much technical depth can we trade for stronger product judgment?" },
      { id: "archetype", text: "Should we compare a startup AI product engineer against an applied AI generalist?" }
    ];
  }

  return [
    { id: "business_need", text: "What business problem is this hire solving first: speed, technical depth, customer learning, or team leadership?" },
    { id: "lane", text: "Is this primarily a builder, specialist, or strategy owner?" },
    { id: "success_90", text: "What would make this hire obviously successful after 90 days?" },
    { id: "requirements", text: "What is the one requirement you would not compromise on?" },
    { id: "archetype", text: "Which candidate lane should we pressure test first?" }
  ];
}

function isGreetingOnly(text: string) {
  return /^(hi|hello|hey|yo|hi tina|hello tina|hey tina)[\s!.?]*$/i.test(text.trim());
}

function asksAboutSourcing(text: string) {
  return /\b(source|sourcing|find|where should|where do we|search|pipeline|outreach)\b/i.test(text);
}

function asksAboutJD(text: string) {
  return /\b(jd|job description|role description|write|draft|posting|job post)\b/i.test(text);
}

function asksAboutInterview(text: string) {
  return /\b(interview|screen|evaluate|assessment|questions|scorecard|vet)\b/i.test(text);
}

function asksAboutComp(text: string) {
  return /\b(comp|compensation|salary|equity|offer|pay|range)\b/i.test(text);
}

function asksAboutTimeline(text: string) {
  return /\b(timeline|how long|time to hire|when can|fast|quickly)\b/i.test(text);
}

function asksAboutRequirements(text: string) {
  return /\b(must have|must-have|required|requirement|nice to have|nice-to-have|criteria|bar)\b/i.test(text);
}

function asksForProfileChoice(text: string) {
  return /\b(which|what kind|who should|profile|archetype|background|candidate type|best fit)\b/i.test(text);
}

function hasUsefulContext(text: string) {
  return /\b(customer|product|infra|infrastructure|distributed|systems|strategy|research|ship|ownership|startup|founding|head of|designer|sales|growth|enterprise|consumer|team|first|senior|principal|staff)\b/i.test(text);
}

function extractSignals(text: string) {
  const signals: string[] = [];

  if (/\bcustomer|user|buyer\b/i.test(text)) signals.push("Customer proximity matters for this role.");
  if (/\bship|shipping|move fast|fast\b/i.test(text)) signals.push("Speed and practical execution are explicit signals.");
  if (/\binfra|infrastructure|distributed|systems|backend|scale|reliability\b/i.test(text)) signals.push("Systems depth is becoming part of the role shape.");
  if (/\bstrategy|roadmap|own.*strategy|long-term\b/i.test(text)) signals.push("The role may include longer-term direction, not just implementation.");
  if (/\bresearch|frontier|openai|anthropic|deepmind\b/i.test(text)) signals.push("AI depth or frontier credibility is being considered as a signal.");
  if (/\bfirst|founding|zero-to-one|startup|ownership\b/i.test(text)) signals.push("Startup ownership and ambiguity tolerance matter.");

  return signals;
}

function inferRoleDirection(text: string, fallback: string) {
  const normalized = text.toLowerCase();

  if (/head of product|product leader|first product/i.test(text)) {
    return "First product leader who can turn founder intuition, customer learning, and company strategy into a usable product operating rhythm.";
  }

  if (/designer|design/i.test(text)) {
    return "Senior product designer who can shape ambiguous product problems, work close to founders, and raise the quality of customer-facing execution.";
  }

  if (/sales|gtm|revenue/i.test(text)) {
    return "Early go-to-market hire who can learn from customers, create repeatable motion, and handle ambiguity before the playbook is mature.";
  }

  if (/infra|infrastructure|distributed|systems|backend|scale|reliability/.test(normalized)) {
    return "Founding technical hire with systems depth, startup ownership, and enough product judgment to build under ambiguity.";
  }

  if (/ai|ml|llm|model|founding engineer/.test(normalized)) {
    return "Founding AI engineer with practical product judgment, enough model depth, and the ownership to turn ambiguous customer problems into shipped work.";
  }

  return fallback;
}

function inferRoleLane(text: string) {
  if (/\binfra|infrastructure|distributed|systems|backend|scale|reliability\b/i.test(text)) {
    return "systems-heavy startup builders";
  }

  if (/\bresearch|frontier|model|eval|openai|anthropic\b/i.test(text)) {
    return "applied AI builders with enough model depth, not pure research profiles by default";
  }

  if (/\bcustomer|product|ship|workflow|users\b/i.test(text)) {
    return "product-minded builders who can learn from customers and ship quickly";
  }

  if (/\bhead of product|product leader|roadmap|strategy\b/i.test(text)) {
    return "a product operator who can create clarity without adding too much process";
  }

  return "the highest-signal builder lane, then test one adjacent lane";
}

function inferSourcingLane(text: string) {
  if (/\binfra|distributed|systems|backend|reliability\b/i.test(text)) {
    return "senior backend and ML infrastructure engineers from high-ownership startup environments";
  }

  if (/\bproduct|customer|ship|workflow\b/i.test(text)) {
    return "AI product engineers and applied generalists who have shipped customer-facing workflows";
  }

  if (/\bopenai|anthropic|frontier|research\b/i.test(text)) {
    return "frontier-adjacent builders, but I would not make the logo the first filter";
  }

  return "adjacent startup builders with evidence of ownership, speed, and relevant technical judgment";
}

function inferBusinessNeed(text: string) {
  if (/\bcustomer|users|workflow\b/i.test(text)) return "turn ambiguous customer problems into shipped product";
  if (/\binfra|distributed|systems|backend|scale|reliability\b/i.test(text)) return "make the technical foundation reliable enough for the next stage";
  if (/\bstrategy|roadmap|head of product\b/i.test(text)) return "create sharper product direction and decision quality";
  if (/\bsales|revenue|gtm\b/i.test(text)) return "learn the market and create repeatable revenue motion";
  return "reduce the biggest execution risk in the next stage of the company";
}

function inferMustHaveAdvice(text: string) {
  if (/\bopenai|anthropic|google|meta|deepmind\b/i.test(text)) {
    return "Pedigree can stay a signal, but I would not let logos substitute for evidence of pace, ownership, and judgment.";
  }

  if (/\bfintech|healthcare|security|domain\b/i.test(text)) {
    return "Domain experience is useful only if it predicts better decisions in this environment. Otherwise it is a bonus signal.";
  }

  return "Must-haves should describe proof of work, not a resume shape.";
}

function inferBestArchetype(text: string) {
  if (/\binfra|distributed|systems|backend|scale|reliability\b/i.test(text)) return "the ML Infrastructure Engineer lane";
  if (/\bresearch|frontier|model|eval\b/i.test(text)) return "one Frontier AI Lab profile as a contrast, not the default";
  if (/\bcustomer|product|ship|startup|ownership|founding\b/i.test(text)) return "the Startup AI Product Engineer lane";
  return "the Applied AI Generalist lane";
}

function summarizeFounderInput(text: string) {
  if (/\bnot required|optional|nice to have\b/i.test(text)) {
    return "Got it. That sounds like a signal, not a gate.";
  }

  if (/\bmore\b.*\bthan\b|\binstead\b|\bmatters more\b/i.test(text)) {
    return "Got it. That changes the weighting.";
  }

  if (/\bshould we|do we need|is it important\b/i.test(text)) {
    return "I would be careful making that a hard requirement yet.";
  }

  return "Got it. That gives the role more shape.";
}

function inferTradeoff(text: string) {
  if (/\binfra|distributed|systems|backend|scale|reliability\b/i.test(text)) {
    return "The tradeoff is that stronger systems people may need testing for customer judgment and product taste.";
  }

  if (/\bcustomer|product|ship|workflow\b/i.test(text)) {
    return "The tradeoff is that faster product builders may need testing for enough technical depth.";
  }

  if (/\bresearch|frontier|openai|anthropic|model\b/i.test(text)) {
    return "The tradeoff is that deeper AI pedigree can narrow the market and may not predict startup execution.";
  }

  return "The tradeoff is clarity versus market access: tighter criteria help focus, but they can hide adjacent high-signal people.";
}

function isLowSignalHiringNeed(text: string) {
  const normalized = text.trim().toLowerCase();
  const isHiringNeed = /\b(need|hiring|hire|looking for)\b/.test(normalized);
  const hasRole = /\b(engineer|designer|product|sales|people|recruiter|founding ai)\b/.test(normalized);
  const hasContext = /\b(customer|founder|roadmap|infra|infrastructure|strategy|distributed|systems|revenue|growth|enterprise|consumer|ship|research|market|stage|team|ownership|openai|anthropic)\b/.test(normalized);

  return isHiringNeed && hasRole && !hasContext;
}

function getLowSignalReply(text: string) {
  if (/head of product|product leader|first product/i.test(text)) {
    return [
      "Got it. “First Head of Product” can mean product strategist, execution lead, or founder translator.",
      "Do you need this person to set direction, run discovery, or create operating cadence for the team?"
    ];
  }

  if (/designer|design/i.test(text)) {
    return [
      "Got it. A senior product designer can mean craft leader, discovery partner, or systems thinker.",
      "Is the biggest need product clarity, UI quality, or faster customer learning?"
    ];
  }

  if (/sales|gtm|revenue/i.test(text)) {
    return [
      "Got it. An early sales hire can mean founder-led selling support, pipeline builder, or first repeatable GTM owner.",
      "Do you need learning velocity, closing ability, or a repeatable sales motion first?"
    ];
  }

  return [
    "Got it. “Founding AI engineer” can mean a few very different hires.",
    "Are we looking for someone to ship AI product fast, own the AI infra, or shape the long-term AI strategy?"
  ];
}

function generateDynamicProfiles(
  workspace: WorkspaceState,
  conversationText: string,
  feedback: CandidateFeedback[]
): CandidateProfile[] {
  const signalText = `${conversationText}\n${workspace.whatWeKnow.join("\n")}\n${workspace.currentHiringDirection}`;
  const signal = getHiringSignal(signalText);

  return MOCK_CANDIDATE_PROFILES.map((profile) => {
    const score = getProfileScore(profile, signal, workspace, feedback);
    return shapeProfileForSignal(profile, score, signal, workspace);
  })
    .sort((a, b) => b.profileMatch - a.profileMatch)
    .slice(0, 6);
}

type HiringSignal = {
  product: number;
  customer: number;
  infra: number;
  frontier: number;
  strategy: number;
  startup: number;
  broad: number;
};

function getHiringSignal(text: string): HiringSignal {
  return {
    product: countMatches(text, /\b(product|ship|shipping|workflow|users|ux|demo|iteration|build fast|move fast)\b/gi),
    customer: countMatches(text, /\b(customer|buyer|user-facing|customer-facing|sales call|discovery)\b/gi),
    infra: countMatches(text, /\b(infra|infrastructure|distributed|systems|backend|scale|reliability|observability|model serving)\b/gi),
    frontier: countMatches(text, /\b(openai|anthropic|deepmind|frontier|research|evals?|model depth|lab)\b/gi),
    strategy: countMatches(text, /\b(strategy|roadmap|long-term|direction|leadership|head of product|operating cadence)\b/gi),
    startup: countMatches(text, /\b(startup|founding|ownership|zero-to-one|ambiguous|ambiguity|early|seed|series a|series b)\b/gi),
    broad: countMatches(text, /\b(generalist|broad|adaptable|range|wear many hats)\b/gi)
  };
}

function countMatches(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(pattern)).length;
}

function getProfileScore(
  profile: CandidateProfile,
  signal: HiringSignal,
  workspace: WorkspaceState,
  feedback: CandidateFeedback[]
) {
  let score = profile.profileMatch;

  if (profile.id === "startup-ai-product-engineer") {
    score += signal.product * 4 + signal.customer * 3 + signal.startup * 2 - signal.infra * 2;
  }

  if (profile.id === "frontier-ai-lab-engineer") {
    score += signal.frontier * 5 + signal.infra * 1 - signal.product * 2 - signal.customer * 2;
  }

  if (profile.id === "ml-infrastructure-engineer") {
    score += signal.infra * 5 + signal.frontier * 1 - signal.customer * 2;
  }

  if (profile.id === "applied-ai-generalist") {
    score += signal.broad * 4 + signal.product * 3 + signal.customer * 2 + signal.startup * 2;
  }

  if (profile.id === "backend-infra-ai-exposure") {
    score += signal.infra * 4 + signal.startup * 2 + signal.product - signal.frontier;
  }

  if (profile.id === "ai-solutions-founder-type") {
    score += signal.customer * 5 + signal.product * 3 + signal.startup * 2 - signal.infra;
  }

  if (workspace.archetypeWeights[profile.archetype] === "Up") score += 5;
  if (workspace.archetypeWeights[profile.archetype] === "Down") score -= 12;

  feedback.forEach((event) => {
    if (event.profileId === profile.id) score += event.direction === "up" ? 8 : -10;
    if (event.archetype === profile.archetype) score += event.direction === "up" ? 4 : -6;
    if (/too research|research-heavy|not product/i.test(event.reason) && profile.id === "frontier-ai-lab-engineer") {
      score -= 12;
    }
    if (/distributed|systems|infra|backend/i.test(event.reason) && /ml-infrastructure|backend-infra/.test(profile.id)) {
      score += 9;
    }
    if (/ownership|startup|ship|customer/i.test(event.reason) && /startup|generalist|solutions/.test(profile.id)) {
      score += 7;
    }
  });

  return Math.max(58, Math.min(96, Math.round(score)));
}

function shapeProfileForSignal(
  profile: CandidateProfile,
  score: number,
  signal: HiringSignal,
  workspace: WorkspaceState
): CandidateProfile {
  const systemHeavy = signal.infra > signal.product && signal.infra > signal.customer;
  const frontierHeavy = signal.frontier >= 3;
  const productHeavy = signal.product + signal.customer >= signal.infra;
  const companyStyle = `${profile.companyStyle} · public-market composite`;

  if (profile.id === "startup-ai-product-engineer" && productHeavy) {
    return {
      ...profile,
      profileMatch: score,
      companyStyle,
      fitAssessment: "Strong current anchor if the role needs shipped AI product, customer judgment, and early-stage ownership.",
      whyTinaSurfacedIt: "The conversation is pointing toward product velocity and proof of working through ambiguity."
    };
  }

  if (profile.id === "ml-infrastructure-engineer" && systemHeavy) {
    return {
      ...profile,
      profileMatch: score,
      companyStyle,
      fitAssessment: "Strong current anchor if reliability, distributed systems, and model-serving judgment matter more than product discovery.",
      whyTinaSurfacedIt: "The hiring manager is weighting systems depth and startup ownership more heavily."
    };
  }

  if (profile.id === "backend-infra-ai-exposure" && systemHeavy) {
    return {
      ...profile,
      profileMatch: score,
      companyStyle,
      fitAssessment: "Practical lane if the company needs a durable backend owner who can work around AI systems without over-indexing on lab pedigree.",
      whyTinaSurfacedIt: "This keeps the bar high while broadening beyond scarce frontier-lab profiles."
    };
  }

  if (profile.id === "frontier-ai-lab-engineer" && frontierHeavy) {
    return {
      ...profile,
      profileMatch: score,
      companyStyle,
      fitAssessment: "Useful contrast profile if frontier model depth is truly tied to the business risk.",
      likelyTradeoffs: ["narrower market", "higher cash expectations", "must test startup pace"],
      whyTinaSurfacedIt: "Frontier pedigree has come up as a possible signal, but Tina is keeping it visible as a tradeoff."
    };
  }

  if (profile.id === "applied-ai-generalist") {
    return {
      ...profile,
      profileMatch: score,
      companyStyle,
      fitAssessment: "Useful broad-lane profile while the team is still deciding whether the role is product, infra, or strategy-heavy.",
      whyTinaSurfacedIt: "This profile tests range, learning speed, and ownership before the spec becomes too narrow."
    };
  }

  return {
    ...profile,
    profileMatch: score,
    companyStyle,
    fitAssessment: `${profile.fitAssessment} Current direction: ${workspace.currentHiringDirection}`,
    whyTinaSurfacedIt: "Tina is keeping this profile in the set as an adjacent lane for comparison."
  };
}

function getDynamicArchetypeWeights(
  text: string,
  previous: WorkspaceState["archetypeWeights"] = {} as WorkspaceState["archetypeWeights"]
) {
  const weights = Object.fromEntries(
    getArchetypeNames().map((name) => [name, previous[name] ?? "Watch"])
  ) as WorkspaceState["archetypeWeights"];

  if (/\b(customer|product|ship|workflow|users|move fast|builder)\b/i.test(text)) {
    weights["Startup AI Product Engineer"] = "Up";
    weights["Applied AI Generalist"] = "Up";
  }

  if (/\b(infra|infrastructure|distributed|systems|backend|scale|reliability)\b/i.test(text)) {
    weights["ML Infrastructure Engineer"] = "Up";
    weights["Backend Infra Engineer with AI exposure"] = "Up";
  }

  if (/\b(openai|anthropic|deepmind|frontier|research|eval)\b/i.test(text)) {
    weights["Frontier AI Lab Engineer"] = /must|require|required|only/i.test(text) ? "Up" : "Watch";
  }

  if (/\b(too research|research-heavy|not research)\b/i.test(text)) {
    weights["Frontier AI Lab Engineer"] = "Down";
    weights["Startup AI Product Engineer"] = "Up";
    weights["Applied AI Generalist"] = "Up";
  }

  return weights;
}

function rankArchetypes(weights: WorkspaceState["archetypeWeights"]) {
  const rank = { Up: 0, Watch: 1, Down: 2 };
  return CANDIDATE_ARCHETYPES.map((item) => item.name).sort(
    (a, b) => rank[weights[a] ?? "Watch"] - rank[weights[b] ?? "Watch"]
  );
}

function calibrateMarketSnapshot(snapshot: WorkspaceState["marketSnapshot"], text: string) {
  const lower = text.toLowerCase();

  if (/\b(infra|infrastructure|distributed|systems|backend|scale|reliability|model serving)\b/.test(lower)) {
    return {
      ...snapshot,
      talentPool: snapshot.talentPool === "Very narrow" ? "Very narrow" : "Moderate",
      compPressure: "High",
      marketCompRange: "$300k-$500k cash + equity",
      timeline: snapshot.timeline === "75-120 days" ? "75-120 days" : "60-90 days"
    } as WorkspaceState["marketSnapshot"];
  }

  if (/\b(head of product|product leader|first product)\b/.test(lower)) {
    return {
      ...snapshot,
      talentPool: "Moderate",
      compPressure: "Competitive",
      marketCompRange: "$220k-$360k cash + equity",
      timeline: "60-90 days"
    } as WorkspaceState["marketSnapshot"];
  }

  if (/\b(designer|design)\b/.test(lower)) {
    return {
      ...snapshot,
      talentPool: "Moderate",
      compPressure: "Competitive",
      marketCompRange: "$180k-$290k cash + equity",
      timeline: "45-60 days"
    } as WorkspaceState["marketSnapshot"];
  }

  return snapshot;
}

function getOpenAssumptionsForText(text: string, hasFrontierRequirement: boolean) {
  const assumptions = [
    "Which business risk this hire reduces first.",
    "What proof would make the team trust this person in the first 90 days."
  ];

  if (hasFrontierRequirement) {
    assumptions.push("Whether frontier lab pedigree is a true requirement or an expensive proxy.");
  } else {
    assumptions.push("Whether pedigree is a signal or a gate.");
  }

  if (/\b(infra|distributed|systems|backend|reliability)\b/i.test(text)) {
    assumptions.push("How much customer judgment the systems-heavy profile still needs.");
  }

  if (/\b(product|customer|ship|workflow|users)\b/i.test(text)) {
    assumptions.push("How much technical depth can be traded for stronger product judgment.");
  }

  return assumptions;
}

function getSuggestedNextMoveForText(text: string, hasFrontierRequirement: boolean) {
  if (hasFrontierRequirement) return MARKET_LANGUAGE.frontierSuggestion;

  if (/\b(infra|distributed|systems|backend|reliability)\b/i.test(text)) {
    return "Compare ML infrastructure and backend-with-AI profiles before deciding how much product judgment is required.";
  }

  if (/\b(product|customer|ship|workflow|users)\b/i.test(text)) {
    return MARKET_LANGUAGE.productBuilderSuggestion;
  }

  return "Start broad with three profile lanes, then use feedback to tighten the search criteria.";
}

function getLivingJdDraft(text: string, hasFrontierRequirement: boolean, fallback?: string) {
  if (/\b(infra|distributed|systems|backend|reliability|model serving)\b/i.test(text)) {
    return "Tina is shaping this as a founding technical hire with distributed systems depth, startup ownership, and enough AI fluency to build reliable product foundations. The role should test evidence of owning messy systems end-to-end, not just impressive infrastructure titles.";
  }

  if (/\b(product|customer|ship|workflow|users|move fast)\b/i.test(text)) {
    return "Tina is shaping this as a product-minded AI builder who can turn ambiguous customer problems into working product. The role should prioritize shipped work, learning speed, and practical model judgment over pure research pedigree.";
  }

  if (hasFrontierRequirement) {
    return "Tina is shaping this as a founding AI engineer with strong startup execution and possible frontier lab pedigree. The role should test whether OpenAI or Anthropic experience is truly required, because that choice narrows the market quickly.";
  }

  return (
    fallback ??
    "Tina is still shaping the role. The draft should stay flexible until the team clarifies business need, proof signals, and acceptable tradeoffs."
  );
}

function hasVagueSignal(text: string) {
  return /\b(smart|good energy|not a fit|bad fit|executive presence|founder vibe|vibes?|culture fit|seems strong|seems weak)\b/i.test(text);
}

function hasLowerBarSignal(text: string) {
  return /\b(lower the bar|lower our bar|settle|compromise on quality|good enough|weaker candidate|weaken the bar)\b/i.test(text);
}

function hasOverqualifiedSignal(text: string) {
  return /\b(overqualified|too senior|outgrow|bored|too experienced|flight risk)\b/i.test(text);
}

function mergeUnique(current: string[], incoming: string[]) {
  return Array.from(new Set([...current, ...incoming].filter(Boolean))).slice(0, 6);
}
