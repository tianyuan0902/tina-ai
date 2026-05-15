export type TinaRole = "tina" | "founder";

export type TinaMessage = {
  id: string;
  role: TinaRole;
  content: string;
};

export type MarketSnapshot = {
  talentPool: "Broad" | "Moderate" | "Narrow" | "Very narrow";
  compPressure: "Manageable" | "Competitive" | "High" | "Very high";
  marketCompRange: string;
  timeline: "Fast" | "45-60 days" | "60-90 days" | "75-120 days";
};

export type MarketShift = {
  id: string;
  title: string;
  changes: {
    label: "Talent pool" | "Market comp" | "Timeline";
    before: string;
    after: string;
  }[];
  suggestedMove: string;
};

export type CandidateArchetype = {
  id: string;
  name: string;
  bestFor: string;
  strongestSignals: string[];
  likelyTradeoffs: string[];
  startupFit: string;
  marketPressure: string;
};

export type CandidateProfile = {
  id: string;
  candidateName: string;
  title: string;
  profileMatch: number;
  archetype: string;
  companyStyle: string;
  backgroundSummary: string;
  fitAssessment: string;
  strongestSignals: string[];
  skillsetHighlights: string[];
  likelyTradeoffs: string[];
  startupFit: string;
  marketPressure: string;
  whyTinaSurfacedIt: string;
};

export type FeedbackDirection = "up" | "down";

export type CandidateFeedback = {
  profileId: string;
  archetype: string;
  direction: FeedbackDirection;
  reason: string;
};

export type WorkspaceState = {
  currentHiringDirection: string;
  marketReality: string;
  candidateArchetypes: string[];
  archetypeWeights: Record<string, "Up" | "Watch" | "Down">;
  openAssumptions: string[];
  tradeoffsToMonitor: string[];
  suggestedNextMove: string;
  marketSnapshot: MarketSnapshot;
  whatWeKnow: string[];
  recommendedSourcingDirection: string;
  livingJdDraft: string;
};

export type TinaState = {
  messages: TinaMessage[];
  workspace: WorkspaceState;
  marketShifts: MarketShift[];
  profiles: CandidateProfile[];
  feedback: CandidateFeedback[];
};

export type KickoffBrief = {
  currentHiringDirection: string;
  whatWeKnow: string[];
  openAssumptions: string[];
  tradeoffsToMonitor: string[];
  preferredCandidateArchetypes: string[];
  sampleCandidateFeedbackSummary: string[];
  marketReality: string;
  recommendedSourcingDirection: string;
  livingJdDraft: string;
};

export type CalibrationMemory = {
  preferredArchetypes: string[];
  rejectedArchetypes: string[];
  preferredStrengths: string[];
  tradeoffPriorities: string[];
  marketFlexibility: string[];
  notes: string[];
};

export type HiringBrief = {
  id: string;
  roleTitle: string;
  whyNow: string;
  businessProblem: string;
  firstNinetyDays: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  targetCompanies: string[];
  candidateProfiles: string[];
  compensationRange: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "Onsite";
  seniority: string;
  acceptableTradeoffs: string[];
  failureModes: string[];
};

export type CandidateArchetypePreview = {
  name: string;
  bestFor: string;
  strengths: string[];
  weaknesses: string[];
  startupFit: string;
  compensationBand: string;
  likelyBackgrounds: string[];
  marketAvailability: "Broad" | "Moderate" | "Narrow" | "Very narrow";
  compPressure: "Moderate" | "Moderate-high" | "High" | "Very high";
};

export type CandidateProfilePreview = {
  id: string;
  archetype: string;
  snapshot: string;
  strongestStrengths: string[];
  likelyTradeoffs: string[];
  startupFit: string;
  marketPressure: string;
  whyTinaSurfacedThem: string;
};
