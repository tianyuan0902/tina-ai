"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CandidateProfile, FeedbackDirection } from "@/lib/types";

export function CandidateProfileCard({
  profile,
  onFeedback
}: {
  profile: CandidateProfile;
  onFeedback: (profileId: string, direction: FeedbackDirection, reason: string) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [why, setWhy] = useState("");

  function sendDown(reason: string) {
    onFeedback(profile.id, "down", reason || "not the right calibration lane");
    setShowWhy(false);
    setWhy("");
  }

  return (
    <article className="rounded-lg border border-[#ddd2c3] bg-[#fffdf8] p-4 shadow-[0_14px_35px_rgba(62,52,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[#2e2a25]">{profile.candidateName}</p>
            <span className="rounded-full bg-[#edf3e7] px-2 py-1 text-xs font-semibold text-[#4f6842]">
              {profile.profileMatch}% match
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-[#5a5148]">{profile.title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#8b8176]">
            {profile.companyStyle}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <Read label="Background summary" value={profile.backgroundSummary} />
        <Read label="Fit assessment" value={profile.fitAssessment} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TagBlock label="Skillset highlights" items={profile.skillsetHighlights} />
        <TagBlock label="Tradeoffs" items={profile.likelyTradeoffs.slice(0, 2)} muted />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#eee7dc] pt-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Thumbs up ${profile.candidateName}`}
          onClick={() => onFeedback(profile.id, "up", "strong profile match")}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Thumbs down ${profile.candidateName}`}
          onClick={() => setShowWhy((current) => !current)}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      {showWhy ? (
        <div className="mt-3 rounded-lg border border-[#e5dccf] bg-[#fbfaf7] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b8176]">
            Optional feedback
          </p>
          <textarea
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            placeholder="Why is this not right?"
            className="mt-2 min-h-16 w-full resize-none rounded-md border border-[#ddd2c3] bg-[#fffdf8] px-3 py-2 text-sm outline-none focus:border-[#9c8f7c]"
          />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {["too research-heavy", "not customer-facing enough", "too infra-heavy"].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => sendDown(reason)}
                className="rounded-full border border-[#ddd2c3] px-3 py-1 text-xs text-[#5e564e] hover:bg-[#f4eee4]"
              >
                {reason}
              </button>
            ))}
            <Button size="sm" variant="outline" onClick={() => sendDown(why)}>
              Send
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b8176]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#4f4943]">{value}</p>
    </div>
  );
}

function TagBlock({ label, items, muted = false }: { label: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b8176]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={
              muted
                ? "rounded-full border border-[#e5dccf] bg-[#f8f4ec] px-2.5 py-1 text-xs text-[#6d645b]"
                : "rounded-full border border-[#d4c6b4] bg-white px-2.5 py-1 text-xs text-[#403a34]"
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
