export const ROLE_CALIBRATION_PRINCIPLES = {
  // Founder-editable: these are Tina's core product beliefs.
  productPrinciples: [
    "Startup hiring is iterative sensemaking.",
    "Calibration matters more than job descriptions.",
    "Founders learn faster through examples than requirements gathering.",
    "Market feedback sharpens role clarity.",
    "The goal is directional clarity, not perfect certainty.",
    "Strong startup hires optimize for adaptability, not pedigree alone.",
    "Hiring strategy should evolve as the company evolves.",
    "Candidate reactions often reveal hidden role assumptions."
  ],

  // Founder-editable: add niche domains that should make a search feel tighter.
  nicheTerms: ["ai", "llm", "crypto", "security", "infrastructure", "platform", "executive"],

  // Founder-editable: add role families that signal a role may be spanning too many jobs.
  roleFamilies: ["design", "engineering", "product", "people", "sales", "marketing", "data", "operations"],

  // Founder-editable: add seniority terms that usually increase timeline and compensation pressure.
  seniorityTerms: ["staff", "principal", "head", "director", "vp", "executive"],

  frontierLabSignals: ["openai", "anthropic", "deepmind", "meta ai", "frontier lab", "frontier ai"],

  matureCompanySignals: ["google", "meta", "stripe", "openai", "anthropic"],

  ambiguitySignals: ["growth need", "don't know", "not sure", "unclear", "broad direction", "mostly growth", "figure it out"],

  compensationRules: [
    {
      id: "ai-under-market",
      appliesWhen: "AI role max cash is below $220k",
      penalty: 16
    },
    {
      id: "senior-under-market",
      appliesWhen: "Senior or executive role max cash is below $210k",
      penalty: 14
    },
    {
      id: "multi-niche-under-market",
      appliesWhen: "Multiple niche requirements max cash is below $200k",
      penalty: 12
    },
    {
      id: "generally-tight-comp",
      appliesWhen: "Max cash is below $160k",
      penalty: 8
    },
    {
      id: "unknown-comp",
      appliesWhen: "No compensation range is known yet",
      penalty: 5
    }
  ],

  feasibilityWeights: {
    startingScore: 84,
    remoteBoost: 10,
    hybridBoost: 3,
    onsitePenalty: -8,
    seniorityPenalty: 13,
    nichePenalty: 7,
    extraMustHavePenalty: 7,
    mustHaveComfortZone: 4
  },

  roleClarity: {
    minimumScore: 24,
    maximumScore: 96,
    roleFamilySpreadComfortZone: 3,
    roleFamilySpreadPenalty: 8
  }
} as const;

