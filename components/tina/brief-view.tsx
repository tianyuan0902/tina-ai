"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, FileText, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createKickoffBrief,
  createSeedState
} from "@/lib/tina-brain/calibration-engine";
import type { KickoffBrief } from "@/lib/types";

export function BriefView() {
  const [brief, setBrief] = useState<KickoffBrief>(() => createKickoffBrief(createSeedState()));

  useEffect(() => {
    const stored = window.localStorage.getItem("tina_latest_brief");
    if (stored) setBrief(JSON.parse(stored) as KickoffBrief);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button asChild variant="ghost">
          <Link href="/kickoff">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/kickoff">
            <Sparkles className="h-4 w-4" />
            Keep calibrating
          </Link>
        </Button>
      </div>

      <section className="rounded-lg border border-[#ddd2c3] bg-[#fffdf8] p-6 shadow-[0_24px_80px_rgba(62,52,42,0.07)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b8176]">
          Kickoff intelligence brief
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#2e2a25]">
          {brief.currentHiringDirection}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#5e564e]">{brief.marketReality}</p>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <BriefSection icon={Compass} title="Current hiring direction">
          <p>{brief.currentHiringDirection}</p>
        </BriefSection>

        <BriefSection icon={FileText} title="What we know">
          <List items={brief.whatWeKnow} />
        </BriefSection>

        <BriefSection icon={FileText} title="Open assumptions">
          <List items={brief.openAssumptions} />
        </BriefSection>

        <BriefSection icon={Compass} title="Tradeoffs to monitor">
          <List items={brief.tradeoffsToMonitor} />
        </BriefSection>

        <BriefSection icon={Search} title="Preferred candidate archetypes">
          <List items={brief.preferredCandidateArchetypes} />
        </BriefSection>

        <BriefSection icon={FileText} title="Sample candidate feedback summary">
          <List items={brief.sampleCandidateFeedbackSummary} />
        </BriefSection>

        <BriefSection icon={Compass} title="Market reality">
          <p>{brief.marketReality}</p>
        </BriefSection>

        <BriefSection icon={Search} title="Recommended sourcing direction">
          <p>{brief.recommendedSourcingDirection}</p>
        </BriefSection>
      </div>

      <section className="mt-5 rounded-lg border border-[#ddd2c3] bg-[#fffdf8] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#2e2a25]">
          <FileText className="h-4 w-4 text-[#7b845f]" />
          Living JD draft
        </div>
        <p className="mt-3 text-sm leading-7 text-[#5e564e]">{brief.livingJdDraft}</p>
      </section>
    </main>
  );
}

function BriefSection({
  icon: Icon,
  title,
  children
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#ddd2c3] bg-[#fffdf8] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#2e2a25]">
        <Icon className="h-4 w-4 text-[#7b845f]" />
        {title}
      </div>
      <div className="mt-3 text-sm leading-6 text-[#5e564e]">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
