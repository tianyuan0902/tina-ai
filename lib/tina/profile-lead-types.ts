export type ProfileLead = {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: "linkedin" | "github" | "personal_site" | "other";
  query: string;
  fitReason: string;
  confidence: "low" | "medium" | "high";
  validation?: {
    roleFunctionMatch: boolean;
    evidenceStrength: "strong" | "medium" | "weak";
    filteredReason?: string;
  };
  evidenceLevel?: "synthetic" | "unverified_lead" | "verified_public";
  tags: string[];
  saved: boolean;
  feedback?: "not_relevant";
  calibration?: {
    scope: string;
    roleTitle: string;
    location: string;
    yearsExperience: string;
    mustHaves: string[];
    niceToHaves: string[];
    compRange: string;
  };
};

export type SourcingBatchMetadata = {
  requestedCount: number;
  returnedCount: number;
  validCount: number;
  filteredCount: number;
  filteredReasons: string[];
  searchProvider: "tavily" | "mock";
  searchStatus: "live" | "fallback" | "partial_failure" | "failed";
  audit?: {
    queriesRun: string[];
    rawResultCount: number;
    candidateCount: number;
    validCount: number;
    rejectionReasons: string[];
    tavilyFailureCount?: number;
    tavilyErrorMessages?: string[];
  };
};
