export type BrainSourceLaneStatus = "active" | "planned" | "inactive";

export type BrainState = {
  roleThesis: string;
  readinessScore: number;
  batchQualityScore: number;
  noveltyScore: number;
  confidenceScore: number;
  searchShape: {
    ownership: number;
    ambiguityTolerance: number;
    productJudgment: number;
    executionSpeed: number;
    technicalDepth: number;
  };
  seekSignals: string[];
  avoidSignals: string[];
  likelyTitles: string[];
  sourceLanes: {
    publicWeb: BrainSourceLaneStatus;
    linkedinLike: BrainSourceLaneStatus;
    github: BrainSourceLaneStatus;
    startupAlumni: BrainSourceLaneStatus;
    blogsTalks: BrainSourceLaneStatus;
  };
  missingSignals: string[];
  calibrationQuestions: string[];
  sourcingReadiness: "not_ready" | "calibration_batch" | "ready";
  tinaRead: string;
};
