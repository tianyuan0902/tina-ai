import { ArrowRight } from "lucide-react";

import type { MarketShift } from "@/lib/types";

export function MarketShiftCard({ shift }: { shift: MarketShift }) {
  return (
    <div className="rounded-lg border border-[#ddd2c3] bg-[#fffdf8] p-4 shadow-[0_14px_35px_rgba(62,52,42,0.06)]">
      <p className="text-sm font-semibold text-[#2e2a25]">{shift.title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {shift.changes.map((change) => (
          <div key={change.label} className="rounded-md border border-[#e5dccf] bg-[#f8f4ec] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7166]">
              {change.label}
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-[#403a34]">
              <span>{change.before}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#8c7f70]" />
              <strong>{change.after}</strong>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#5e564e]">{shift.suggestedMove}</p>
    </div>
  );
}
