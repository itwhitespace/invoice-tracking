import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings-context";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Invoice Tracking Program",
  description: "AI-Powered PDF Data Extraction, Split-Screen Review, and Supabase Integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased selection:bg-slate-200">
        <SettingsProvider>
          <AppShell>{children}</AppShell>
        </SettingsProvider>
      </body>
    </html>
  );
}
