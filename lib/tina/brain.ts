import type { CalibrationMemory, CandidateScore, TinaResponseBlock } from "@/lib/tina/types";
import { renderTinaResponseBlocks } from "@/lib/tina/response-renderer";

const candidateNames = {
  product: "Maya R.",
  frontier: "Ethan K.",
  infra: "Nina S."
};

export function generateTinaResponseBlocks(memory: CalibrationMemory): TinaResponseBlock[] {
  const now = new Date().toISOString();
  const mustHaveLabels = memory.mustHaves.map((item) => item.label);
  const hasFintechMustHave = memory.mustHaves.some((item) => item.id === "fintech");
  const hasDistributedSystems = memory.mustHaves.some((item) => item.id === "distributed-systems");
  const hasStartupOwnership = memory.mustHaves.some((item) => item.id === "startup-ownership");
  const changedByFeedback = memory.updatedByFeedbackEvents.length > 0;
  const updatedBecause = changedByFeedback
    ? "Updated based on hiring manager feedback"
    : "Initial Tina Brain read";

  return [
    {
      id: "role-direction",
      type: "role_direction",
      title: "Role read",
      content: hasFintechMustHave
        ? "This looks like a founding AI engineer for a fintech-flavored product. Tina Brain initially treats fintech experience as important because trust, reliability, and regulated workflows may shape the product."
        : "This is less about fintech pedigree now. The role is moving toward a builder who can handle distributed systems, startup ownership, and customer-facing AI product work.",
      confidence: changedByFeedback ? 0.82 : 0.68,
      dependsOn: ["roleRequirements", "hmFeedback"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: mustHaveLabels
    },
    {
      id: "candidate-scoring",
      type: "candidate_scoring",
      title: "Candidate scoring",
      content: formatCandidateScores(scoreCandidates(memory)),
      confidence: 0.74,
      dependsOn: ["candidateProfile", "hmFeedback", "roleRequirements"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: [...mustHaveLabels, ...memory.rejectedPatterns]
    },
    {
      id: "search-logic",
      type: "search_logic",
      title: "Search logic",
      content: hasDistributedSystems || hasStartupOwnership
        ? "Search should move away from fintech-first filters. Prioritize distributed systems, startup ownership, AI product shipping, and evidence of low-structure execution. Fintech can stay useful context, but it should not block strong adjacent builders."
        : "Search should start with fintech infrastructure, AI workflow startups, and product engineers who have worked around trust-heavy systems. Keep frontier lab pedigree as a signal, not a requirement.",
      confidence: changedByFeedback ? 0.86 : 0.7,
      dependsOn: ["sourcingCriteria", "marketData", "hmFeedback"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: memory.preferredCompanies
    },
    {
      id: "living-jd",
      type: "living_jd",
      title: "Living JD",
      content: hasDistributedSystems || hasStartupOwnership
        ? "We are hiring a founding AI engineer to build customer-facing AI systems with strong distributed systems judgment and real startup ownership. The person should be able to ship quickly, make practical architecture decisions, and work without much structure."
        : "We are hiring a founding AI engineer to build customer-facing AI product in a fintech context. The person should bring AI product judgment, customer empathy, and enough fintech fluency to avoid naive product decisions.",
      confidence: 0.78,
      dependsOn: ["roleRequirements", "hmFeedback"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: mustHaveLabels
    },
    {
      id: "recommendation-summary",
      type: "recommendation",
      title: "Recommendation summary",
      content: hasDistributedSystems || hasStartupOwnership
        ? "I would reset the first pass around systems-heavy startup builders, not fintech specialists. The tradeoff is you may lose some domain shorthand, but you gain a stronger chance of hiring someone who can actually build the hard parts."
        : "I would test fintech-experienced AI product builders first, then compare one adjacent systems builder lane. The risk is over-weighting domain familiarity before we know whether it predicts execution here.",
      confidence: 0.8,
      dependsOn: ["roleRequirements", "sourcingCriteria", "hmFeedback"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: mustHaveLabels
    },
    {
      id: "risk-flags",
      type: "risk_flags",
      title: "Risk flags",
      content: hasFintechMustHave
        ? "Risk: fintech may be a proxy for judgment, not a real requirement. If that is true, the search will be narrower than it needs to be."
        : "Risk: removing fintech is fine, but do not replace it with vague ownership language. Interview for concrete examples: hard systems tradeoffs, ambiguous customer asks, and times they owned the messy middle.",
      confidence: 0.76,
      dependsOn: ["roleRequirements", "hmFeedback", "interviewFeedback"],
      lastUpdatedAt: now,
      updatedBecause,
      sourceSignals: memory.rejectedPatterns.length ? memory.rejectedPatterns : ["Fintech requirement still untested"]
    }
  ];
}

export function generateRenderedTinaResponse(memory: CalibrationMemory) {
  const rawBlocks = generateTinaResponseBlocks(memory);
  return {
    rawBlocks,
    renderedBlocks: renderTinaResponseBlocks(rawBlocks)
  };
}

export function scoreCandidates(memory: CalibrationMemory): CandidateScore[] {
  const hasFintechMustHave = memory.mustHaves.some((item) => item.id === "fintech");
  const hasDistributedSystems = memory.mustHaves.some((item) => item.id === "distributed-systems");
  const hasStartupOwnership = memory.mustHaves.some((item) => item.id === "startup-ownership");

  return [
    {
      candidateId: "startup-ai-product-engineer",
      candidateName: candidateNames.product,
      score: hasStartupOwnership ? 91 : 84,
      reasons: ["AI product shipping", "customer-facing judgment", hasStartupOwnership ? "startup ownership now weighted higher" : "fintech context is plausible"],
      risks: hasDistributedSystems ? ["systems depth still needs proof"] : ["may need stronger architecture partner"],
      changedBy: hasStartupOwnership ? "HM feedback raised startup ownership" : undefined
    },
    {
      candidateId: "ml-infrastructure-engineer",
      candidateName: candidateNames.infra,
      score: hasDistributedSystems ? 89 : 76,
      reasons: ["distributed systems", "production reliability", "model-serving judgment"],
      risks: ["customer-facing product judgment needs validation"],
      changedBy: hasDistributedSystems ? "HM feedback raised distributed systems" : undefined
    },
    {
      candidateId: "frontier-ai-lab-engineer",
      candidateName: candidateNames.frontier,
      score: hasFintechMustHave ? 72 : 66,
      reasons: ["model intuition", "eval exposure"],
      risks: ["may be too research-heavy", "startup ownership not proven"],
      changedBy: hasFintechMustHave ? undefined : "HM feedback moved away from pedigree/domain filters"
    }
  ];
}

function formatCandidateScores(scores: CandidateScore[]) {
  return scores
    .map((score) => `${score.candidateName}: ${score.score}% match. ${score.reasons.join(", ")}. Risk: ${score.risks.join(", ")}.`)
    .join("\n");
}
