import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/components/layout/RoleContext";
import { AppShell } from "@/components/layout/AppShell";


export const metadata: Metadata = {
  title: "CIMS - Clinical Integrated Management System",
  description: "Enterprise hospital, EMR/EHR, pharmacy, laboratory, and billing management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PK">
      <body>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
