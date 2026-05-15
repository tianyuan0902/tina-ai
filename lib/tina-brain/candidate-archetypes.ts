import type { CandidateArchetype } from "@/lib/types";

export const CANDIDATE_ARCHETYPES: CandidateArchetype[] = [
  {
    id: "startup-ai-product-engineer",
    name: "Startup AI Product Engineer",
    bestFor: "Shipping ambiguous AI workflows with customer pressure in the room.",
    strongestSignals: ["LLM product work", "fast iteration", "customer-facing judgment"],
    likelyTradeoffs: ["Less depth on model internals", "may need support on eval rigor"],
    startupFit: "High when speed and product taste matter more than pedigree.",
    marketPressure: "Competitive, but more workable than frontier lab only."
  },
  {
    id: "frontier-ai-lab-engineer",
    name: "Frontier AI Lab Engineer",
    bestFor: "Deep model intuition, evals, safety, and credibility with technical buyers.",
    strongestSignals: ["frontier lab exposure", "research taste", "model evaluation"],
    likelyTradeoffs: ["narrower market", "higher comp pressure", "may be less product-minded"],
    startupFit: "Strong only if the startup can absorb research depth into shipping work.",
    marketPressure: "High and relationship-driven."
  },
  {
    id: "ml-infrastructure-engineer",
    name: "ML Infrastructure Engineer",
    bestFor: "Building reliable systems around models, data, evals, and production loops.",
    strongestSignals: ["model serving", "data infrastructure", "production reliability"],
    likelyTradeoffs: ["may be less customer-facing", "product ambiguity can be a stretch"],
    startupFit: "High if the bottleneck is platform quality or scale.",
    marketPressure: "Competitive, especially for people who have shipped."
  },
  {
    id: "applied-ai-generalist",
    name: "Applied AI Generalist",
    bestFor: "Early messy teams that need someone to connect product, prompts, data, and backend.",
    strongestSignals: ["broad execution", "prototype-to-production range", "practical AI judgment"],
    likelyTradeoffs: ["less specialist depth", "needs a clear bar for technical quality"],
    startupFit: "Very high for founder-stage ambiguity.",
    marketPressure: "Manageable if the bar is calibrated around outcomes."
  },
  {
    id: "backend-infra-ai-exposure",
    name: "Backend Infra Engineer with AI exposure",
    bestFor: "Teams that need strong systems ownership with enough AI fluency to move quickly.",
    strongestSignals: ["backend systems", "APIs and reliability", "adjacent AI product exposure"],
    likelyTradeoffs: ["weaker model intuition", "may need AI product coaching"],
    startupFit: "High if AI depth is useful but not the whole job.",
    marketPressure: "More workable than lab pedigree searches."
  }
];

export function getArchetypeNames() {
  return CANDIDATE_ARCHETYPES.map((archetype) => archetype.name);
}
