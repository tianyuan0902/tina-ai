export type ResponseDependency =
  | "roleRequirements"
  | "candidateProfile"
  | "marketData"
  | "hmFeedback"
  | "interviewFeedback"
  | "sourcingCriteria";

export type TinaResponseBlock = {
  id: string;
  type:
    | "role_direction"
    | "candidate_scoring"
    | "calibration_snapshot"
    | "living_jd"
    | "search_logic"
    | "recommendation"
    | "risk_flags";
  title: string;
  content: string;
  confidence: number;
  dependsOn: ResponseDependency[];
  lastUpdatedAt: string;
  updatedBecause?: string;
  sourceSignals: string[];
};

export type FeedbackEvent = {
  id: string;
  roleId: string;
  candidateId?: string;
  source: "hiring_manager" | "interviewer" | "recruiter" | "system";
  signal: "agree" | "disagree" | "refine" | "correct";
  message: string;
  weight: number;
  createdAt: string;
};

export type CalibrationMemory = {
  roleId: string;
  mustHaves: RolePriority[];
  niceToHaves: RolePriority[];
  dealBreakers: string[];
  preferredCompanies: string[];
  rejectedPatterns: string[];
  seniorityCalibration: string;
  updatedByFeedbackEvents: string[];
};

export type CandidateScore = {
  candidateId: string;
  candidateName: string;
  score: number;
  changedBy?: string;
  reasons: string[];
  risks: string[];
};

export type RolePriority = {
  id: string;
  label: string;
  weight: number;
  source: "initial_brain" | "feedback" | "market";
};

export type UpdateImpact = {
  blockId: string;
  blockTitle: string;
  dependency: ResponseDependency;
  changedFields: string[];
  explanation: string;
};

export type RenderedTinaResponseBlock = TinaResponseBlock & {
  rawContent: string;
  styledContent: string;
};

export type TinaDynamicResponse = {
  rawBlocks: TinaResponseBlock[];
  renderedBlocks: RenderedTinaResponseBlock[];
};
