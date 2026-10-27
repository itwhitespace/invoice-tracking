import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings-context";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Program tracking",
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
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
