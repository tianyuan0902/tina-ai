import { CheckCircle2, TriangleAlert } from "lucide-react";

import type { TinaCandidateArchetype } from "@/lib/tina-mvp/types";

export function CandidateArchetypeCards({ archetypes }: { archetypes: TinaCandidateArchetype[] }) {
  if (!archetypes.length) return null;

  return (
    <aside className="grid gap-3 rounded-lg border border-[#d8ded2] bg-[#f7f8f3] p-4">
      <div>
        <p className="text-sm font-semibold text-[#18201b]">Candidate archetypes</p>
        <p className="mt-1 text-sm leading-6 text-[#627063]">Useful lanes to pressure test, not sourced candidates.</p>
      </div>

      {archetypes.map((archetype) => (
        <article key={archetype.id} className="rounded-lg border border-[#d8ded2] bg-white p-4">
          <h2 className="text-base font-semibold leading-6 text-[#18201b]">{archetype.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#465044]">{archetype.bestFor}</p>

          <div className="mt-4 grid gap-3">
            <SignalList icon="signal" title="Signals" items={archetype.signals} />
            <SignalList icon="tradeoff" title="Tradeoffs" items={archetype.tradeoffs} />
          </div>
        </article>
      ))}
    </aside>
  );
}

function SignalList({
  icon,
  title,
  items
}: {
  icon: "signal" | "tradeoff";
  title: string;
  items: string[];
}) {
  const Icon = icon === "signal" ? CheckCircle2 : TriangleAlert;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-[#6f7b6c]">{title}</p>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-[#465044]">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#3f6f52]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
