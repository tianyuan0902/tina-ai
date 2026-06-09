import { NextResponse } from "next/server";

import { appendConversationLog, isConversationLoggingConfigured, type TinaConversationLogPayload } from "@/lib/supabase/tina-conversation-logs";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 80;

export async function POST(request: Request) {
  if (!isConversationLoggingConfigured()) {
    return NextResponse.json({ enabled: false, saved: false });
  }

  try {
    const payload = (await request.json()) as Partial<TinaConversationLogPayload>;

    if (!Array.isArray(payload.messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }

    const cleanPayload: TinaConversationLogPayload = {
      anonymousSessionId: sanitizeId(payload.anonymousSessionId, "anon-session"),
      threadId: sanitizeId(payload.threadId, "thread"),
      messages: redactSecrets(payload.messages.slice(-MAX_MESSAGES)),
      currentRead: redactSecrets(payload.currentRead),
      workingThesis: redactSecrets(payload.workingThesis),
      canonicalSearchState: redactSecrets(payload.canonicalSearchState),
      signalMap: redactSecrets(payload.signalMap),
      artifacts: Array.isArray(payload.artifacts) ? redactSecrets(payload.artifacts) : [],
      marketReality: redactSecrets(payload.marketReality),
      sourcingStrategy: redactSecrets(payload.sourcingStrategy),
      clickedActions: Array.isArray(payload.clickedActions) ? redactSecrets(payload.clickedActions.slice(-30)) : [],
      metadata: sanitizeMetadata(payload.metadata),
      consentVersion: typeof payload.consentVersion === "string" ? payload.consentVersion.slice(0, 80) : "public-demo-v1"
    };

    await appendConversationLog(cleanPayload);
    return NextResponse.json({ enabled: true, saved: true });
  } catch (error) {
    console.error("[Tina MVP] Conversation log save failed:", error);
    return NextResponse.json({ enabled: true, saved: false, error: "conversation_log_failed" }, { status: 500 });
  }
}

function sanitizeId(value: unknown, prefix: string) {
  const clean = typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120) : "";
  return clean || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return redactSecrets(value) as Record<string, unknown>;
}

function redactSecrets<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\bsk-[a-zA-Z0-9_-]{16,}\b/g, "[redacted-secret]")
      .replace(/\bsk-proj-[a-zA-Z0-9_-]{16,}\b/g, "[redacted-secret]")
      .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^'"\s,}]+/gi, "[redacted-secret]") as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }

  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (/api[_-]?key|secret|token|password|authorization|cookie/i.test(key)) {
        clean[key] = "[redacted-secret]";
      } else {
        clean[key] = redactSecrets(nestedValue);
      }
    }
    return clean as T;
  }

  return value;
}
