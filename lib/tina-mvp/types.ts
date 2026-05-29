import type { ProfileLead, SourcingBatchMetadata } from "@/lib/tina/profile-lead-types";
import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { SourcingReadiness } from "@/lib/tina/sourcing-readiness";
import type { CurrentRead } from "@/lib/tina-mvp/current-read";
import type { WorkingThesis } from "@/lib/tina-mvp/working-thesis";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";

export type TinaMvpRole = "founder" | "tina";

export type TinaMvpMessage = {
  id: string;
  role: TinaMvpRole;
  content: string;
  profileLeads?: ProfileLead[];
  sourcingBatch?: SourcingBatchMetadata;
  sourcingReadiness?: SourcingReadiness;
  signalMap?: SignalMap;
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
  canonicalSearchState?: CanonicalSearchState;
  workingThesis?: WorkingThesis;
  currentRead?: CurrentRead;
  signalMap?: SignalMap;
  profileLeads?: ProfileLead[];
  marketIntel?: unknown;
  source: "openai" | "local_scope_guard" | "local_profile_feedback" | "local_conversation_move" | "local_fallback" | "public_search" | "sourcing_readiness";
  responseId?: string;
  debugCode?: string;
};
