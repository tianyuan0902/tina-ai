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
};
