import type React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Beaker,
  Building2,
  FlaskConical,
  Lightbulb,
  Pencil,
  UserRound,
  UsersRound
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkspaceState } from "@/lib/types";
import { cn } from "@/lib/utils";

const archetypeMeta: Record<string, { note: string; tag: string; icon: React.ElementType }> = {
  "Startup AI Product Engineer": {
    note: "High velocity, product and AI breadth, customer proximity.",
    tag: "Best fit",
    icon: UserRound
  },
  "ML Infrastructure Engineer": {
    note: "Strong systems and scalability, AI platform experience.",
    tag: "Good fit",
    icon: UsersRound
  },
  "Frontier AI Lab Engineer": {
    note: "Deep ML expertise, research background, limited availability.",
    tag: "Specialized",
    icon: Beaker
  },
  "Applied AI Generalist": {
    note: "Broad builder range across product, prompts, data, and backend.",
    tag: "Flexible",
    icon: Lightbulb
  }
};

export function LiveWorkspace({ workspace }: { workspace: WorkspaceState }) {
  const topArchetypes = workspace.candidateArchetypes
    .filter((name) => workspace.archetypeWeights[name] !== "Down")
    .slice(0, 3);
  const direction = getDirectionDisplay(workspace.currentHiringDirection);
  const movement = getWorkspaceMovement(workspace);

  return (
    <aside className="h-fit rounded-[18px] border border-[#e5ded3] bg-[#fffdf8]/95 shadow-[0_24px_80px_rgba(49,42,34,0.08)] xl:sticky xl:top-6">
      <div className="flex items-center justify-between border-b border-[#eee7dc] px-7 py-5">
        <h2 className="text-base font-semibold text-[#191714]">Hiring workspace</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#edf3e7] px-3 py-1 text-xs font-semibold text-[#4f6842]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#557344]" />
          Live
        </span>
      </div>

      <div className="space-y-7 px-7 py-6">
        <section>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#191714]">Current direction</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-normal text-[#191714]">
                {direction.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#4f4943]">
                {direction.summary}
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl bg-[#fffdf8]">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </section>

        <PanelDivider />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#191714]">Market movement</p>
            <button type="button" className="text-sm text-[#191714]">
              View details
            </button>
          </div>
          <div className="mb-3 rounded-xl bg-[#f4eee4] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b8176]">
              Benchmark comp range
            </p>
            <p className="mt-1 text-sm font-semibold text-[#191714]">
              {workspace.marketSnapshot.marketCompRange}
            </p>
              <p className="mt-1 text-xs leading-5 text-[#6c645c]">
              Level.fyi-style public benchmark range; adjust with seniority, pedigree, stage, and equity mix.
            </p>
          </div>
          <div className="grid gap-2">
            {movement.map((item, index) => (
              <MovementItem key={item.label} item={item} index={index} />
            ))}
          </div>
        </section>

        <PanelDivider />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#191714]">
              Candidate archetypes <span className="font-normal text-[#80786f]">(top 3)</span>
            </p>
            <button type="button" className="text-sm text-[#191714]">
              View all
            </button>
          </div>
          <div className="grid gap-3">
            {topArchetypes.map((name) => (
              <ArchetypeRow key={name} name={name} weight={workspace.archetypeWeights[name]} />
            ))}
          </div>
        </section>

        <PanelDivider />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#191714]">Open assumptions</p>
            <button type="button" className="text-sm text-[#191714]">
              Manage
            </button>
          </div>
          <ul className="grid list-disc gap-1.5 pl-4 text-sm leading-6 text-[#3f3933]">
            {workspace.openAssumptions.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-[#f4eee4] p-5">
          <div className="flex gap-3">
            <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-[#a15d26]" />
            <div>
              <p className="text-sm font-semibold text-[#191714]">Next step suggestion</p>
              <p className="mt-2 text-sm leading-6 text-[#3f3933]">
                {workspace.suggestedNextMove}
              </p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function MovementItem({
  item,
  index
}: {
  item: {
    label: string;
    detail: string;
    direction: string;
    icon: React.ElementType;
  };
  index: number;
}) {
  const Icon = item.icon;
  const tones = [
    "bg-[#edf3e7] text-[#557344]",
    "bg-[#edf3e7] text-[#557344]",
    "bg-[#fbefe1] text-[#b45d20]"
  ];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#eadfd0] bg-[#fffdf8] px-3 py-3 shadow-[0_12px_24px_rgba(49,42,34,0.04)]">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[index])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#191714]">{item.label}</p>
        <p className="mt-1 text-xs text-[#4f4943]">{item.detail}</p>
      </div>
      {item.direction === "down" ? (
        <ArrowDownRight className="h-4 w-4 text-[#c34823]" />
      ) : (
        <ArrowUpRight className="h-4 w-4 text-[#2e7a39]" />
      )}
    </div>
  );
}

function getDirectionDisplay(direction: string) {
  if (/product leader|head of product|product operating/i.test(direction)) {
    return {
      title: "First Product Leader",
      summary: direction
    };
  }

  if (/designer|design/i.test(direction)) {
    return {
      title: "Senior Product Designer",
      summary: direction
    };
  }

  if (/sales|go-to-market|revenue/i.test(direction)) {
    return {
      title: "Early GTM Hire",
      summary: direction
    };
  }

  if (/systems depth|distributed|infrastructure|backend/i.test(direction)) {
    return {
      title: "Systems-Heavy AI Builder",
      summary: direction
    };
  }

  if (/founding ai|ai engineer|model/i.test(direction)) {
    return {
      title: "Founding AI Engineer",
      summary: direction
    };
  }

  return {
    title: "Hiring Direction",
    summary: direction
  };
}

function getWorkspaceMovement(workspace: WorkspaceState) {
  const top = workspace.candidateArchetypes[0] ?? "Applied AI Generalist";
  const hasFrontier = workspace.archetypeWeights["Frontier AI Lab Engineer"] === "Up";
  const hasInfra = workspace.archetypeWeights["ML Infrastructure Engineer"] === "Up";

  return [
    {
      label: hasFrontier ? "Frontier pedigree is active" : "Pedigree stays optional",
      detail: hasFrontier
        ? "Talent pool: Moderate -> Narrow"
        : "Talent pool: Narrow -> More workable",
      direction: hasFrontier ? "down" : "up",
      icon: hasFrontier ? FlaskConical : Building2
    },
    {
      label: hasInfra ? "Systems depth weighted higher" : "Product builder lane is open",
      detail: hasInfra
        ? `Market range: ${workspace.marketSnapshot.marketCompRange}`
        : `Talent pool: ${workspace.marketSnapshot.talentPool}`,
      direction: "up",
      icon: hasInfra ? UsersRound : UserRound
    },
    {
      label: `Top lane: ${top}`,
      detail: `Timeline: ${workspace.marketSnapshot.timeline}`,
      direction: workspace.marketSnapshot.timeline === "75-120 days" ? "down" : "up",
      icon: Lightbulb
    }
  ];
}

function ArchetypeRow({ name, weight }: { name: string; weight: string }) {
  const meta = archetypeMeta[name] ?? archetypeMeta["Applied AI Generalist"];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-4 border-b border-[#eee7dc] pb-3 last:border-0 last:pb-0">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf3e7] text-[#557344]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#191714]">{name}</p>
        <p className="mt-1 text-xs leading-5 text-[#5d554d]">{meta.note}</p>
      </div>
      <span
        className={cn(
          "rounded-lg px-2.5 py-1 text-xs",
          weight === "Up" && "bg-[#edf3e7] text-[#3f5f34]",
          weight === "Watch" && "bg-[#f5eee4] text-[#815f3d]",
          weight === "Down" && "bg-[#f0e3dc] text-[#884d3a]"
        )}
      >
        {meta.tag}
      </span>
    </div>
  );
}

function PanelDivider() {
  return <div className="h-px bg-[#eee7dc]" />;
}
