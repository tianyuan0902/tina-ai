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
};

export function reasonAboutHiringConversation(messages: TinaMvpMessage[], latestFounderMessage: string): TinaReasoningResult {
  const transcript = [...messages.map((message) => message.content), latestFounderMessage].join("\n");
  const intent = inferHiringIntent(transcript);

  return {
    reply: "",
    archetypes: shouldInferArchetypes(latestFounderMessage) ? createDynamicArchetypes(intent) : []
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

  return {
    stage: dislikesCorporate || founderMinded || wantsSpeed ? "early, messy startup environment" : "startup environment with some unresolved role shape",
    executionStyle: wantsSpeed ? "high-velocity builder" : "steady operator who can create momentum without much structure",
    orientation: isResearch ? "research-leaning" : isProduct ? "product-facing" : isInfra ? "systems-heavy" : "pragmatic builder",
    ambiguityTolerance: dislikesCorporate || founderMinded ? "high ambiguity tolerance" : "comfortable with incomplete context",
    ownershipExpectation: founderMinded || wantsSpeed ? "owns outcomes without waiting for clean specs" : "can take a loosely defined problem and make it usable",
    shippingVelocity: wantsSpeed ? "fast shipping cadence" : "balanced shipping pace",
    technicalDepth: isSmartContract
      ? "contract/security judgment"
      : isInfra
        ? "systems depth"
        : wantsDepth
          ? "strong technical depth"
          : "enough technical judgment to avoid shallow execution",
    domain: isSmartContract ? "smart contract" : isAI ? "AI" : isInfra ? "infrastructure" : isProduct ? "product" : "startup"
  };
}

function shouldInferArchetypes(text: string) {
  return /\b(hire|hiring|candidate|profile|person|someone|engineer|operator|lead|builder|founder-minded|founder minded|startup energy|smart contract|solidity|ai|product|infra|gtm|sales)\b/i.test(
    text
  );
}

function createDynamicArchetypes(intent: HiringIntent): TinaCandidateArchetype[] {
  return [
    {
      id: "ownership-heavy-builder",
      name: `${capitalize(intent.domain)} ownership builder`,
      bestFor: `When you need someone who can operate in a ${intent.stage} and turn unclear work into shipped progress.`,
      signals: [
        intent.ownershipExpectation,
        `${intent.ambiguityTolerance} in real examples`,
        `Has worked with a ${intent.shippingVelocity} without losing judgment`
      ],
      tradeoffs: [
        "May not be the deepest specialist in every subdomain",
        "Needs a founder who can give direction without over-specifying the work"
      ]
    },
    {
      id: "depth-with-judgment",
      name: `${capitalize(intent.technicalDepth)} partner`,
      bestFor: `When the expensive mistake is hiring someone who moves quickly but misses the hard technical edge.`,
      signals: [
        `Can explain ${intent.technicalDepth} through practical tradeoffs`,
        "Has made judgment calls where quality and speed were both real",
        `Pairs ${intent.orientation} thinking with startup urgency`
      ],
      tradeoffs: [
        "May move more deliberately than a pure product builder",
        "Can become too narrow if the role also needs broad early-stage ownership"
      ]
    },
    {
      id: "product-minded-operator",
      name: "Product-minded technical operator",
      bestFor: "When the role needs technical credibility but the real leverage comes from customer, product, or founder context.",
      signals: [
        "Translates technical decisions into user or business consequences",
        "Learns from messy customer or founder feedback",
        `Shows ${intent.executionStyle} behavior without needing a mature org around them`
      ],
      tradeoffs: [
        `May need support on the deepest ${intent.technicalDepth} questions`,
        "Can look less impressive on paper than a pedigree-heavy specialist"
      ]
    }
  ];
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
