import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type TinaStoredThread = {
  id: string;
  title: string;
  time: string;
  messages: TinaMvpMessage[];
  latestSynthesis?: string;
  sessionId?: string;
};

type TinaThreadRow = {
  id: string;
  title: string;
  time_label: string;
  messages: TinaMvpMessage[];
  latest_synthesis: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const WORKSPACE_ID = process.env.TINA_WORKSPACE_ID || "local";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function getStoredThreads() {
  if (!isSupabaseConfigured()) return [];

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/tina_threads?workspace_id=eq.${encodeURIComponent(WORKSPACE_ID)}&select=id,title,time_label,messages,latest_synthesis&order=updated_at.desc`,
    {
      headers: supabaseHeaders(),
      cache: "no-store"
    }
  );

  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);

  const rows = (await response.json()) as TinaThreadRow[];
  return rows.map(fromRow);
}

export async function saveStoredThreads(threads: TinaStoredThread[], sessionId?: string) {
  if (!isSupabaseConfigured()) return;

  const rows = threads.map((thread) => toRow(thread, sessionId));
  if (!rows.length) return;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/tina_threads?on_conflict=id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) throw new Error(`Supabase save failed: ${response.status}`);
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };
}

function fromRow(row: TinaThreadRow): TinaStoredThread {
  return {
    id: row.id,
    title: row.title,
    time: row.time_label,
    messages: row.messages || [],
    latestSynthesis: row.latest_synthesis || undefined
  };
}

function toRow(thread: TinaStoredThread, sessionId?: string) {
  const anonymousSessionId = thread.sessionId || sessionId || "anon-unknown";
  const storedId = thread.id.startsWith(`${anonymousSessionId}:`) ? thread.id : `${anonymousSessionId}:${thread.id}`;

  return {
    id: storedId,
    workspace_id: WORKSPACE_ID,
    title: thread.title,
    time_label: thread.time,
    messages: thread.messages,
    latest_synthesis: JSON.stringify({
      anonymousSessionId,
      summary: thread.latestSynthesis || null
    }),
    updated_at: new Date().toISOString()
  };
}
