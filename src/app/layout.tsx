import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handyman Quote Generator",
  description: "Professional quoting tool for handymen and contractors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
