import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinVault",
  description: "AI Financial Operating System for SMB finance teams"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
