"use client";

import { ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";

import type { ProfileLead } from "@/lib/tina/profile-lead-types";

type ProfileLeadCardProps = {
  lead: ProfileLead;
  isSaved?: boolean;
  onSave?: (lead: ProfileLead) => void;
  onReject?: (lead: ProfileLead) => void;
};

export function ProfileLeadCard({ lead, isSaved, onSave, onReject }: ProfileLeadCardProps) {
  const saved = isSaved || lead.saved;

  return (
    <article className="rounded-lg border border-[#E2D7CB] bg-[#FFFCF7]/80 p-3 shadow-[0_10px_26px_rgba(23,23,23,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#EEF1E8] px-2 py-0.5 text-[11px] text-[#5F6D4E]">{sourceLabel(lead.source)}</span>
            <span className="rounded-full bg-[#F1ECE4] px-2 py-0.5 text-[11px] text-[#625A52]">{lead.confidence}</span>
          </div>
          <h4 className="text-sm font-semibold text-[#171717]">{lead.title}</h4>
          {lead.tags.length ? <p className="mt-1 text-xs leading-5 text-[#6F675E]">{lead.tags.join(" / ")}</p> : null}
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#5A524A]">{lead.snippet}</p>
      <p className="mt-2 text-xs leading-5 text-[#262626]">{lead.fitReason}</p>
      {lead.calibration ? (
        <div className="mt-3 grid gap-2 rounded-md border border-[#E7DDD1] bg-[#F8F4ED]/70 p-2.5 text-xs leading-5 text-[#5A524A]">
          <ProfileField label="Scope" value={lead.calibration.scope} />
          <ProfileField label="Location" value={lead.calibration.location} />
          <ProfileField label="Experience" value={lead.calibration.yearsExperience} />
          <ProfileField label="Must haves" value={lead.calibration.mustHaves.join(", ")} />
          <ProfileField label="Nice to have" value={lead.calibration.niceToHaves.join(", ")} />
          <ProfileField label="Comp range" value={lead.calibration.compRange} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={lead.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#D8CEC2] bg-white px-2.5 py-1.5 text-xs text-[#262626] transition hover:bg-[#F1ECE4]"
        >
          Open profile
          <ExternalLink className="h-3 w-3" />
        </a>
        {onSave ? (
          <button
            type="button"
            onClick={() => onSave(lead)}
            className="rounded-md border border-[#D8CEC2] bg-[#1E1E1E] px-2.5 py-1.5 text-xs text-white transition hover:bg-[#262626] disabled:opacity-50"
            disabled={saved}
          >
            <ThumbsUp className="h-3 w-3" />
            {saved ? "Saved" : "Yes"}
          </button>
        ) : null}
        {onReject ? (
          <button
            type="button"
            onClick={() => onReject(lead)}
            className="rounded-md border border-[#D8CEC2] bg-[#F8F4ED] px-2.5 py-1.5 text-xs text-[#625A52] transition hover:bg-[#F1ECE4]"
          >
            <ThumbsDown className="h-3 w-3" />
            No
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-[#262626]">{label}:</span> {value}
    </div>
  );
}

function sourceLabel(source: ProfileLead["source"]) {
  const labels = {
    linkedin: "LinkedIn",
    github: "GitHub",
    personal_site: "Personal site",
    other: "Public web"
  };

  return labels[source];
}
