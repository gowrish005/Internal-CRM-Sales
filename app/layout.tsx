import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAPSO CRM",
  description: "Internal CRM & Founders Calendar Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
