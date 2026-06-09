import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { CurrentRead } from "@/lib/tina-mvp/current-read";
import type { HiringArtifact } from "@/lib/tina-mvp/hiring-artifacts";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";
import type { WorkingThesis } from "@/lib/tina-mvp/working-thesis";

export type TinaConversationLogPayload = {
  anonymousSessionId?: string;
  threadId?: string;
  messages: TinaMvpMessage[];
  currentRead?: CurrentRead;
  workingThesis?: WorkingThesis;
  canonicalSearchState?: CanonicalSearchState;
  signalMap?: SignalMap;
  artifacts?: HiringArtifact[];
  marketReality?: unknown;
  sourcingStrategy?: unknown;
  clickedActions?: unknown[];
  metadata?: Record<string, unknown>;
  consentVersion?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export function isConversationLoggingConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function appendConversationLog(payload: TinaConversationLogPayload) {
  if (!isConversationLoggingConfigured()) return { enabled: false, saved: false };

  const row = {
    anonymous_session_id: payload.anonymousSessionId,
    thread_id: payload.threadId,
    messages: payload.messages,
    current_read: payload.currentRead || null,
    working_thesis: payload.workingThesis || null,
    canonical_search_state: payload.canonicalSearchState || null,
    signal_map: payload.signalMap || null,
    artifacts: payload.artifacts || [],
    market_reality: payload.marketReality || null,
    sourcing_strategy: payload.sourcingStrategy || null,
    clicked_actions: payload.clickedActions || [],
    metadata: payload.metadata || {},
    consent_version: payload.consentVersion || "public-demo-v1"
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/tina_conversation_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(row),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Supabase conversation log failed: ${response.status} ${errorText}`.trim());
  }

  return { enabled: true, saved: true };
}
