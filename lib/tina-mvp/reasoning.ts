import { TINA_SYSTEM_PROMPT } from "@/lib/tina-mvp/system-prompt";
import type { TinaCandidateArchetype, TinaMvpMessage, TinaReasoningResult } from "@/lib/tina-mvp/types";

type HiringRead = {
  lane: "ai-product" | "ai-infra" | "product-lead" | "gtm" | "smart-contract" | "general";
  businessNeed: string;
  mustHave: string;
  tradeoff: string;
  nextQuestion: string;
};

export function reasonAboutHiringConversation(messages: TinaMvpMessage[], latestFounderMessage: string): TinaReasoningResult {
  void TINA_SYSTEM_PROMPT;

  const transcript = [...messages.map((message) => message.content), latestFounderMessage].join("\n");
  const read = createHiringRead(transcript);
  const archetypes = createCandidateArchetypes(read);
  const founderTurns = messages.filter((message) => message.role === "founder").length + 1;

  return {
    reply: createTinaReply(read, founderTurns),
    archetypes
  };
}

export function createOpeningMessage(): TinaMvpMessage {
  return {
    id: "tina-opening",
    role: "tina",
    content: "Tell me what hire you are trying to make and what feels unresolved. I will help you turn the messy version into a sharper recruiting lane."
  };
}

function createHiringRead(text: string): HiringRead {
  const normalized = text.toLowerCase();

  if (/\b(smartcontract|smart contract|solidity|web3|blockchain|protocol|on-chain|onchain)\b/.test(normalized)) {
    return {
      lane: "smart-contract",
      businessNeed: "secure protocol execution where mistakes are public, expensive, and hard to unwind",
      mustHave: "evidence of shipped contract work, adversarial thinking, and sound judgment around audits and upgrade paths",
      tradeoff: "a narrow market where crypto-native context and security depth rarely come in the same package",
      nextQuestion: "Is this hire mainly for protocol engineering, security review, or product-facing web3 application work?"
    };
  }

  if (/\b(infra|infrastructure|distributed|systems|backend|scale|reliability|platform)\b/.test(normalized)) {
    return {
      lane: "ai-infra",
      businessNeed: "technical leverage and reliability under ambiguous product pressure",
      mustHave: "evidence they can own hard systems decisions without waiting for perfect specs",
      tradeoff: "a smaller talent pool and more compensation pressure",
      nextQuestion: "How close does this person need to be to customers in the first six months?"
    };
  }

  if (/\b(ai|llm|model|eval|agent|workflow|prototype)\b/.test(normalized)) {
    return {
      lane: "ai-product",
      businessNeed: "shipping useful AI product behavior faster than the team can today",
      mustHave: "proof of turning ambiguity into shipped product, not just model fluency",
      tradeoff: "less pure research depth in exchange for speed and product judgment",
      nextQuestion: "What should this hire ship or clarify in the first 90 days?"
    };
  }

  if (/\b(product|pm|roadmap|strategy|discovery|users|customer)\b/.test(normalized)) {
    return {
      lane: "product-lead",
      businessNeed: "better product judgment where customer learning and execution meet",
      mustHave: "evidence of crisp prioritization when the company has too many possible directions",
      tradeoff: "a builder may move faster, while a classic PM may create more clarity",
      nextQuestion: "Do you need this person to personally build, or mainly make the team sharper?"
    };
  }

  if (/\b(sales|gtm|revenue|pipeline|founder-led|customers|buyer)\b/.test(normalized)) {
    return {
      lane: "gtm",
      businessNeed: "turning founder-led learning into repeatable market motion",
      mustHave: "evidence they can sell while the story is still changing",
      tradeoff: "startup ambiguity may matter more than brand-name GTM polish",
      nextQuestion: "Is the first job learning the market, closing revenue, or building the repeatable motion?"
    };
  }

  return {
    lane: "general",
    businessNeed: "removing the biggest constraint on the company right now",
    mustHave: "clear evidence of ownership in a messy environment",
    tradeoff: "narrowing too early may hide stronger adjacent candidates",
    nextQuestion: "What business problem is this hire solving first: speed, quality, customer learning, or leadership?"
  };
}

function createTinaReply(read: HiringRead, founderTurns: number) {
  const opener = founderTurns <= 1 ? "Got it." : "That sharpens the lane.";

  return [
    `${opener} This sounds like a search for ${read.businessNeed}.`,
    `The must-have signal is ${read.mustHave}. Watch for ${read.tradeoff}.`,
    read.nextQuestion
  ].join("\n\n");
}

function createCandidateArchetypes(read: HiringRead): TinaCandidateArchetype[] {
  if (read.lane === "ai-infra") {
    return [
      archetype("ml-infra-owner", "ML Infra Owner", "Hard technical systems with real production pressure", ["Distributed systems depth", "Reliability judgment", "Owns ambiguous architecture"], ["May be less customer-facing", "Can overbuild before product shape is clear"]),
      archetype("startup-systems-builder", "Startup Systems Builder", "Early teams that need speed plus backend rigor", ["Ships quickly", "Strong debugging instincts", "Comfortable without clean specs"], ["Less frontier-model depth", "May need support on AI evaluation strategy"]),
      archetype("frontier-lab-engineer", "Frontier Lab Engineer", "Deep model intuition and technical credibility", ["Model fluency", "Strong research taste", "High technical bar"], ["Expensive market", "May expect more structure"])
    ];
  }

  if (read.lane === "ai-product") {
    return [
      archetype("ai-product-builder", "AI Product Builder", "Turning AI ambiguity into shipped customer workflows", ["Customer intuition", "Fast prototyping", "Practical eval sense"], ["May lack deep infra specialization", "Needs technical guardrails for scale"]),
      archetype("applied-ai-generalist", "Applied AI Generalist", "Small teams that need breadth before specialization", ["Learns quickly", "Connects product and engineering", "Comfortable with messy tools"], ["Can be stretched thin", "Depth varies by surface area"]),
      archetype("model-minded-engineer", "Model-Minded Engineer", "Products where model behavior is the core risk", ["Prompting/evals taste", "Understands failure modes", "Strong technical curiosity"], ["May need product pressure-testing", "Can overweight model quality over workflow value"])
    ];
  }

  if (read.lane === "product-lead") {
    return [
      archetype("builder-pm", "Builder PM", "A founder-stage product lane that still needs hands-on execution", ["Cuts scope cleanly", "Works close to users", "Ships with engineering"], ["May be less polished as a people manager", "May resist heavyweight process"]),
      archetype("product-strategist", "Product Strategist", "Clarifying direction where the company has too many bets", ["Strong framing", "Prioritization judgment", "Executive communication"], ["Can become too abstract", "Must prove operating pace"]),
      archetype("customer-discovery-lead", "Customer Discovery Lead", "Turning market noise into crisp product requirements", ["Deep user learning", "Pattern recognition", "Commercial empathy"], ["Needs engineering partner strength", "May not own delivery end-to-end"])
    ];
  }

  if (read.lane === "gtm") {
    return [
      archetype("founder-led-sales-translator", "Founder-Led Sales Translator", "Capturing what works in founder sales and making it repeatable", ["High learning velocity", "Strong buyer empathy", "Narrative discipline"], ["May need enablement support", "Less useful if market is already obvious"]),
      archetype("early-ae", "Early AE", "Creating pipeline and closing while positioning is still moving", ["Resilient prospecting", "Commercial urgency", "Can sell without perfect materials"], ["Can push for clarity before it exists", "Needs tight founder feedback loops"]),
      archetype("gtm-operator", "GTM Operator", "Building the first repeatable revenue motion", ["Process taste", "Experiment design", "Pipeline discipline"], ["May be too operational if discovery is the real problem", "Needs enough customer exposure"])
    ];
  }

  if (read.lane === "smart-contract") {
    return [
      archetype("protocol-security-engineer", "Protocol Security Engineer", "Contracts where exploit risk and economic design matter most", ["Adversarial thinking", "Audit collaboration", "Understands attack surfaces"], ["Very narrow market", "May be less product-facing"]),
      archetype("solidity-product-engineer", "Solidity Product Engineer", "Shipping user-facing web3 features without losing contract rigor", ["Ships product surfaces", "Practical Solidity depth", "Works across frontend/backend/contracts"], ["May need deeper security review", "Can be stretched across too many layers"]),
      archetype("protocol-generalist", "Protocol Generalist", "Early teams that need ownership across contracts, integrations, and tooling", ["High agency", "Crypto-native context", "Comfortable with ambiguity"], ["Depth varies by domain", "Needs clear review process around high-risk code"])
    ];
  }

  return [
    archetype("startup-generalist", "Startup Generalist", "Messy early roles where ownership matters more than exact title", ["High agency", "Learns in public", "Finds leverage without permission"], ["Depth may be uneven", "Scope must be kept honest"]),
    archetype("domain-specialist", "Domain Specialist", "When a specific technical or market risk dominates", ["Deep expertise", "Credibility", "Can raise the bar quickly"], ["Narrower market", "May be less flexible across problems"]),
    archetype("operator-builder", "Operator Builder", "Turning founder intent into repeatable execution", ["Creates motion", "Strong follow-through", "Pragmatic judgment"], ["May not be the long-term functional leader", "Needs clear success metrics"])
  ];
}

function archetype(
  id: string,
  name: string,
  bestFor: string,
  signals: string[],
  tradeoffs: string[]
): TinaCandidateArchetype {
  return { id, name, bestFor, signals, tradeoffs };
}
