export type ProfileLead = {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: "linkedin" | "github" | "personal_site" | "other";
  query: string;
  fitReason: string;
  confidence: "low" | "medium" | "high";
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
