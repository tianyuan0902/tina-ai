import type { ProfileLead } from "@/lib/tina/profile-lead-types";

export type TinaMvpRole = "founder" | "tina";

export type TinaMvpMessage = {
  id: string;
  role: TinaMvpRole;
  content: string;
  profileLeads?: ProfileLead[];
};

export type TinaCandidateArchetype = {
  id: string;
  name: string;
  bestFor: string;
  signals: string[];
  tradeoffs: string[];
};

export type TinaReasoningResult = {
  reply: string;
  archetypes: TinaCandidateArchetype[];
};

export type TinaChatApiResponse = {
  message: TinaMvpMessage;
  source: "openai" | "local_scope_guard" | "local_profile_feedback" | "local_fallback" | "public_search";
  responseId?: string;
  debugCode?: string;
};
