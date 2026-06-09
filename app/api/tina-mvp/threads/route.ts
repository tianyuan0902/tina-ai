import { NextResponse } from "next/server";

import { isSupabaseConfigured, saveStoredThreads } from "@/lib/supabase/tina-threads";
import type { TinaStoredThread } from "@/lib/supabase/tina-threads";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: isSupabaseConfigured(), threads: [] });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, saved: false });
  }

  try {
    const { sessionId, threads } = (await request.json()) as { sessionId?: string; threads?: TinaStoredThread[] };
    if (!Array.isArray(threads)) {
      return NextResponse.json({ error: "threads must be an array" }, { status: 400 });
    }

    await saveStoredThreads(threads, sanitizeSessionId(sessionId));
    return NextResponse.json({ enabled: true, saved: true });
  } catch (error) {
    console.error("[Tina MVP] Supabase thread save failed:", error);
    return NextResponse.json({ enabled: true, saved: false, error: "supabase_save_failed" }, { status: 500 });
  }
}

function sanitizeSessionId(sessionId?: string) {
  const clean = (sessionId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return clean || `anon-server-${Date.now()}`;
}
