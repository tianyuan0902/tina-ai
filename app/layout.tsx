import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

import { AppShell } from "@/components/tina/app-shell";

export const metadata: Metadata = {
  title: "Tina",
  description: "Hiring intelligence before the search begins"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
