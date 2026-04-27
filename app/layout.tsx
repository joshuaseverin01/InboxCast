import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InboxCast",
  description: "Your inbox, turned into a personal morning briefing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
