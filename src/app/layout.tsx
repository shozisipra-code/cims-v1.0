import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/components/layout/RoleContext";
import AppShell from "@/components/shared/AppShell";

export const metadata: Metadata = {
  title: "CIMS - Clinical Integrated Management System",
  description: "Advanced Hospital, EMR, Pharmacy, LIS, and Billing Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
