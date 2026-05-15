import type { MarketShift, MarketSnapshot, WorkspaceState } from "@/lib/types";

export const DEFAULT_MARKET_SNAPSHOT: MarketSnapshot = {
  talentPool: "Moderate",
  compPressure: "Competitive",
  marketCompRange: "$220k-$320k cash + equity",
  timeline: "45-60 days"
};

export const MARKET_LANGUAGE = {
  frontierRequirement:
    "Requiring OpenAI or Anthropic experience narrows the market and raises the bar on comp and relationship access.",
  frontierSuggestion:
    "Keep frontier lab pedigree as a strong signal, not a hard requirement.",
  productBuilderSuggestion:
    "Bias the next pass toward product-minded builders with enough AI fluency to move fast.",
  flexiblePedigree:
    "Treat AI pedigree as evidence to inspect, not a shortcut for fit."
};

export function getMarketSnapshotFromText(text: string, previous = DEFAULT_MARKET_SNAPSHOT): MarketSnapshot {
  const lower = text.toLowerCase();
  if (/must|require|required|only/.test(lower) && /openai|anthropic|deepmind|frontier lab/.test(lower)) {
    return {
      talentPool: "Narrow",
      compPressure: "High",
      marketCompRange: "$300k-$500k+ cash + equity",
      timeline: "75-120 days"
    };
  }

  if (/research-heavy|frontier|openai|anthropic|deepmind/.test(lower)) {
    return {
      talentPool: previous.talentPool === "Broad" ? "Moderate" : "Narrow",
      compPressure: "High",
      marketCompRange: "$280k-$450k+ cash + equity",
      timeline: "60-90 days"
    };
  }

  if (/remote|flexible|adjacent|nice-to-have|signal/.test(lower)) {
    return {
      talentPool: "Moderate",
      compPressure: "Competitive",
      marketCompRange: "$210k-$310k cash + equity",
      timeline: "45-60 days"
    };
  }

  if (/product|customer|ship|move fast|builder|generalist/.test(lower)) {
    return {
      talentPool: "Moderate",
      compPressure: "Competitive",
      marketCompRange: "$220k-$330k cash + equity",
      timeline: "45-60 days"
    };
  }

  return previous;
}

export function getMarketReality(snapshot: MarketSnapshot, hasFrontierRequirement: boolean) {
  if (hasFrontierRequirement) return MARKET_LANGUAGE.frontierRequirement;
  if (snapshot.talentPool === "Narrow") {
    return "The market is workable, but the strongest lane will depend on which requirement stays flexible.";
  }
  return "This is a calibratable market if Tina compares a few candidate lanes before locking requirements.";
}

export function maybeCreateMarketShift(
  before: MarketSnapshot,
  after: MarketSnapshot,
  text: string
): MarketShift | undefined {
  const lower = text.toLowerCase();
  const changed =
    before.talentPool !== after.talentPool ||
    before.compPressure !== after.compPressure ||
    before.marketCompRange !== after.marketCompRange ||
    before.timeline !== after.timeline;

  if (!changed) return undefined;

  return {
    id: `shift-${Date.now()}`,
    title: /openai|anthropic|frontier/.test(lower) ? "Frontier lab requirement added" : "Hiring direction shifted",
    changes: [
      { label: "Talent pool", before: before.talentPool, after: after.talentPool },
      { label: "Market comp", before: before.marketCompRange, after: after.marketCompRange },
      { label: "Timeline", before: before.timeline, after: after.timeline }
    ],
    suggestedMove: /openai|anthropic|frontier/.test(lower)
      ? MARKET_LANGUAGE.frontierSuggestion
      : "Keep the change visible and compare it against candidate archetype reactions."
  };
}

export function getTradeoffsForWorkspace(snapshot: MarketSnapshot, hasFrontierRequirement: boolean) {
  const tradeoffs = [
    "Product speed vs. frontier AI depth",
    "Customer-facing range vs. infrastructure depth",
    "Pedigree signal vs. adaptable startup behavior"
  ];

  if (hasFrontierRequirement) {
    tradeoffs.unshift("Hard frontier lab requirement vs. reachable market");
  }

  if (snapshot.compPressure === "High" || snapshot.compPressure === "Very high") {
    tradeoffs.push("Comp pressure vs. stage and equity story");
  }

  return tradeoffs;
}

export function getRecommendedSourcingDirection(workspace: WorkspaceState) {
  const preferred = workspace.candidateArchetypes.find(
    (name) => workspace.archetypeWeights[name] === "Up"
  );

  if (preferred) {
    return `Start with ${preferred} and compare one adjacent lane before narrowing.`;
  }

  if (workspace.marketSnapshot.talentPool === "Narrow") {
    return "Start with two adjacent AI builder lanes and keep frontier pedigree flexible until signal is stronger.";
  }

  return "Start with AI product builders and applied generalists, then test whether infra depth is truly required.";
}
