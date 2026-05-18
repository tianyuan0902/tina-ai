import type { TinaCandidateArchetype, TinaMvpMessage, TinaReasoningResult } from "@/lib/tina-mvp/types";

type HiringIntent = {
  stage: string;
  executionStyle: string;
  orientation: string;
  ambiguityTolerance: string;
  ownershipExpectation: string;
  shippingVelocity: string;
  technicalDepth: string;
  domain: string;
  confidence: number;
  wantsSpeed: boolean;
  wantsDepth: boolean;
  dislikesCorporate: boolean;
  founderMinded: boolean;
  isProductFacing: boolean;
  isResearchLeaning: boolean;
  isOperator: boolean;
  highSlope: boolean;
};

export function reasonAboutHiringConversation(messages: TinaMvpMessage[], latestFounderMessage: string): TinaReasoningResult {
  const transcript = [...messages.map((message) => message.content), latestFounderMessage].join("\n");
  const latestIntent = inferHiringIntent(latestFounderMessage);
  const conversationIntent = inferHiringIntent(transcript);
  const intent = mergeIntent(latestIntent, conversationIntent);

  return {
    reply: "",
    archetypes: intent.confidence >= 2 ? createDynamicArchetypes(intent) : []
  };
}

export function createOpeningMessage(): TinaMvpMessage {
  return {
    id: "tina-opening",
    role: "tina",
    content: "Tell me what hire you are trying to make and what feels unresolved. I will help you turn the messy version into a sharper recruiting lane."
  };
}

function inferHiringIntent(text: string): HiringIntent {
  const normalized = text.toLowerCase();
  const isSmartContract = /\b(smartcontract|smart contract|solidity|web3|blockchain|protocol|on-chain|onchain|defi)\b/.test(normalized);
  const isAI = /\b(ai|llm|model|eval|agent|workflow|prototype)\b/.test(normalized);
  const isInfra = /\b(infra|infrastructure|distributed|systems|backend|scale|reliability|platform)\b/.test(normalized);
  const isProduct = /\b(product|customer|users|workflow|ship|shipping|pm)\b/.test(normalized);
  const isResearch = /\b(research|paper|scientist|frontier|model depth)\b/.test(normalized);
  const wantsSpeed = /\b(fast|quick|ship|shipping|velocity|move|startup energy|urgent)\b/.test(normalized);
  const wantsDepth = /\b(deep|depth|senior|security|systems|protocol|infra|hard|technical)\b/.test(normalized);
  const dislikesCorporate = /\b(corporate|faang|big company|process|bureaucratic|slow)\b/.test(normalized);
  const founderMinded = /\b(founder-minded|founder minded|ownership|owner|high agency|startup)\b/.test(normalized);
  const isOperator = /\b(operator|operations|ops|chaos|process|cross-functional|execution)\b/.test(normalized);
  const highSlope = /\b(sharp|hungry|high slope|high-slope|young|early career|early-career|smart)\b/.test(normalized);
  const nativeAI = /\b(native ai|ai native|model-native|model native)\b/.test(normalized);
  const confidence = [
    isSmartContract,
    isAI,
    isInfra,
    isProduct,
    isResearch,
    wantsSpeed,
    wantsDepth,
    dislikesCorporate,
    founderMinded,
    highSlope,
    nativeAI,
    /\b(hire|hiring|candidate|profile|person|someone|engineer|operator|lead|builder|pm|product manager)\b/.test(normalized)
  ].filter(Boolean).length;

  return {
    stage: dislikesCorporate || founderMinded || wantsSpeed ? "early, messy startup environment" : "startup environment with some unresolved role shape",
    executionStyle: wantsSpeed ? "high-velocity builder" : "steady operator who can create momentum without much structure",
    orientation: isResearch ? "research-leaning" : isProduct ? "product-facing" : isInfra ? "systems-heavy" : "pragmatic builder",
    ambiguityTolerance: dislikesCorporate || founderMinded ? "high ambiguity tolerance" : "comfortable with incomplete context",
    ownershipExpectation: founderMinded || wantsSpeed ? "owns outcomes without waiting for clean specs" : "can take a loosely defined problem and make it usable",
    shippingVelocity: wantsSpeed ? "fast shipping cadence" : "balanced shipping pace",
    technicalDepth: isSmartContract
      ? "contract/security judgment"
      : isAI
        ? wantsDepth || isResearch
          ? "native AI engineering judgment"
          : "practical AI product engineering judgment"
      : isInfra
        ? "systems depth"
        : wantsDepth
          ? "strong technical depth"
          : "enough technical judgment to avoid shallow execution",
    domain: isSmartContract ? "smart contract" : isAI ? "AI" : isInfra ? "infrastructure" : isProduct ? "product" : "startup",
    confidence,
    wantsSpeed,
    wantsDepth,
    dislikesCorporate,
    founderMinded,
    isProductFacing: isProduct,
    isResearchLeaning: isResearch,
    isOperator,
    highSlope
  };
}

function mergeIntent(latestIntent: HiringIntent, conversationIntent: HiringIntent): HiringIntent {
  if (latestIntent.confidence >= 2) {
    return {
      ...latestIntent,
      stage: latestIntent.stage || conversationIntent.stage,
      ambiguityTolerance: latestIntent.ambiguityTolerance || conversationIntent.ambiguityTolerance,
      confidence: latestIntent.confidence
    };
  }

  return conversationIntent;
}

function createDynamicArchetypes(intent: HiringIntent): TinaCandidateArchetype[] {
  const archetypes = [
    createOwnershipArchetype(intent),
    intent.isOperator ? createOperatorArchetype(intent) : createDepthArchetype(intent),
    createContextArchetype(intent)
  ];

  return archetypes.filter(Boolean).slice(0, intent.confidence >= 4 ? 3 : 2) as TinaCandidateArchetype[];
}

function createOperatorArchetype(intent: HiringIntent): TinaCandidateArchetype {
  return {
    id: "cross-functional-execution-builder",
    name: "Cross-functional execution builder",
    bestFor: "When you need someone who can absorb messy work across teams and create motion without making the company feel heavier.",
    signals: [
      "Has owned ambiguous work across product, founders, customers, or GTM",
      "Knows when process creates leverage and when it slows people down",
      `Shows ${intent.ambiguityTolerance} through specific examples`
    ],
    tradeoffs: [
      "May be less useful if the problem is actually a narrow functional gap",
      "Needs trust and context from the founder to operate well"
    ]
  };
}

function createOwnershipArchetype(intent: HiringIntent): TinaCandidateArchetype {
  const name = ownershipName(intent);

  return {
    id: slugify(name),
    name,
    bestFor: `When you need someone who can create momentum in a ${intent.stage}, especially before the role is perfectly defined.`,
    signals: [
      intent.ownershipExpectation,
      `${intent.ambiguityTolerance} in concrete prior work`,
      intent.highSlope
        ? "Shows unusually fast learning through shipped work, not just impressive language"
        : intent.wantsSpeed
          ? "Has shipped useful things quickly without waiting for a perfect plan"
          : "Can turn loose context into steady execution"
    ],
    tradeoffs: [
      "May need a clear founder-level north star, even if the day-to-day is messy",
      intent.wantsDepth ? "Worth checking that ownership does not come at the expense of technical rigor" : "May be less specialized than a narrow expert"
    ]
  };
}

function createDepthArchetype(intent: HiringIntent): TinaCandidateArchetype {
  const name = depthName(intent);

  return {
    id: slugify(name),
    name,
    bestFor: `When the hire needs real ${intent.technicalDepth}, but still has to operate close to startup reality.`,
    signals: [
      `Can explain ${intent.technicalDepth} through practical tradeoffs`,
      intent.wantsSpeed ? "Knows what can ship now and what needs more care" : "Has judgment about where quality actually matters",
      intent.isProductFacing ? "Connects technical choices to customer or product consequences" : `Pairs ${intent.orientation} thinking with ownership`
    ],
    tradeoffs: [
      intent.wantsSpeed ? "May move more deliberately on risky technical decisions" : "May need pressure to avoid over-polishing",
      "Can become too narrow if the role also needs broad founder-context judgment"
    ]
  };
}

function createContextArchetype(intent: HiringIntent): TinaCandidateArchetype {
  const name = contextName(intent);

  return [
    "product",
    "AI",
    "smart contract",
    "startup"
  ].includes(intent.domain) || intent.dislikesCorporate || intent.founderMinded
    ? {
        id: slugify(name),
        name,
        bestFor: "When the real leverage is not just skill fit, but how the person behaves around customers, founders, ambiguity, and imperfect information.",
        signals: [
          intent.isProductFacing ? "Turns customer noise into clearer product judgment" : "Reads founder context without needing everything translated into process",
          intent.dislikesCorporate ? "Has chosen messy, high-agency environments before" : "Has worked well without a mature operating system around them",
          `Shows ${intent.executionStyle} behavior in examples, not just language`
        ],
        tradeoffs: [
          intent.isResearchLeaning ? "May need help converting depth into shipping rhythm" : "Can look less polished than a more conventional profile",
          "Needs calibration on what ownership means in this specific company"
        ]
      }
    : createOwnershipArchetype({ ...intent, domain: "startup" });
}

function ownershipName(intent: HiringIntent) {
  if (intent.domain === "AI") return intent.isProductFacing ? "Native AI product engineer" : "Native AI builder with startup ownership";
  if (intent.domain === "smart contract") return "Crypto-native protocol generalist";
  if (intent.domain === "infrastructure") return "Startup backend owner";
  if (intent.domain === "product") return "Zero-to-one product clarifier";
  if (intent.dislikesCorporate || intent.founderMinded) return "High-ownership startup operator";

  return "Startup ownership builder";
}

function depthName(intent: HiringIntent) {
  if (intent.domain === "AI") return "AI systems builder with product engineering range";
  if (intent.domain === "smart contract") return "Protocol/security-minded contract engineer";
  if (intent.domain === "infrastructure") return "Pragmatic infrastructure builder";
  if (intent.domain === "product") return "Founder-context PM";

  return `${humanize(intent.technicalDepth)} partner`;
}

function contextName(intent: HiringIntent) {
  if (intent.domain === "AI") return intent.wantsSpeed ? "High-slope AI prototyper who can productionize" : "Customer-close AI product builder";
  if (intent.domain === "smart contract") return "Solidity product builder";
  if (intent.domain === "infrastructure") return "Systems-minded product engineer";
  if (intent.domain === "product") return "Customer-discovery product operator";
  if (intent.isOperator) return "Founder translator";
  if (intent.dislikesCorporate || intent.founderMinded) return "Founder translator";

  return "Cross-functional execution builder";
}

function humanize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
