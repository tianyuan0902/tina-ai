"use client";

import type { ProfileLead } from "@/lib/tina/profile-lead-types";

import { ProfileLeadCard } from "./ProfileLeadCard";

type ProfileLeadsPanelProps = {
  leads: ProfileLead[];
  savedLeads: ProfileLead[];
  savedProjectTitle: string;
  onSave: (lead: ProfileLead) => void;
  onReject: (lead: ProfileLead) => void;
};

export function ProfileLeadsPanel({ leads, savedLeads, savedProjectTitle, onSave, onReject }: ProfileLeadsPanelProps) {
  const savedIds = new Set(savedLeads.map((lead) => lead.id));
  const uniqueLeads = dedupeLeads(leads);
  const uniqueSavedLeads = dedupeLeads(savedLeads);

  return (
    <div className="mt-6">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8178]">Public talent search</p>
        <h3 className="mt-1 text-base font-semibold">Calibration profiles</h3>
        <p className="mt-1 text-xs leading-5 text-[#6F675E]">Public profile leads to thumbs up/down. Three yeses gives Tina a clearer sourcing lane.</p>
      </div>

      <div className="grid gap-3">
        {uniqueLeads.length ? (
          uniqueLeads.map((lead, index) => (
            <ProfileLeadCard key={`${lead.id}-${index}`} lead={lead} isSaved={savedIds.has(lead.id)} onSave={onSave} onReject={onReject} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#D8CEC2] bg-[#F8F4ED]/70 p-4 text-sm leading-6 text-[#625A52]">
            Ask Tina to find public profiles, and potential outreach targets will appear here.
          </div>
        )}
      </div>
      {savedLeads.length ? (
        <div className="mt-3 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-3 text-xs leading-5 text-[#625A52]">
          {savedLeads.length >= 3
            ? "Calibration is strong enough to start finding similar public leads in this lane."
            : `${3 - savedLeads.length} more yes ${3 - savedLeads.length === 1 ? "profile" : "profiles"} and Tina can narrow the sourcing lane.`}
        </div>
      ) : null}

      {savedLeads.length ? (
        <div className="mt-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[#8A8178]">Saved project profiles</p>
          <h4 className="mb-3 text-sm font-semibold text-[#262626]">{savedProjectTitle}</h4>
          <div className="grid gap-3">
            {uniqueSavedLeads.map((lead, index) => (
              <ProfileLeadCard key={`saved-${lead.id}-${index}`} lead={lead} isSaved />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function dedupeLeads(leads: ProfileLead[]) {
  const seen = new Set<string>();

  return leads.filter((lead) => {
    const key = lead.url || lead.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
