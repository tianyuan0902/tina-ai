import { NextResponse } from "next/server";

import { getStoredThreads, isSupabaseConfigured, saveStoredThreads } from "@/lib/supabase/tina-threads";
import type { TinaStoredThread } from "@/lib/supabase/tina-threads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, threads: [] });
  }

  try {
    const threads = await getStoredThreads();
    return NextResponse.json({ enabled: true, threads });
  } catch (error) {
    console.error("[Tina MVP] Supabase thread read failed:", error);
    return NextResponse.json({ enabled: true, threads: [], error: "supabase_read_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, saved: false });
  }

  try {
    const { threads } = (await request.json()) as { threads?: TinaStoredThread[] };
    if (!Array.isArray(threads)) {
      return NextResponse.json({ error: "threads must be an array" }, { status: 400 });
    }

    await saveStoredThreads(threads);
    return NextResponse.json({ enabled: true, saved: true });
  } catch (error) {
    console.error("[Tina MVP] Supabase thread save failed:", error);
    return NextResponse.json({ enabled: true, saved: false, error: "supabase_save_failed" }, { status: 500 });
  }
}
