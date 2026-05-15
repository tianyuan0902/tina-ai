import type React from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4efe6] text-[#2e2a25]">{children}</div>;
}
