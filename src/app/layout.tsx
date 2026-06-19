import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuoteBuilder — Handyman Quote Generator",
  description: "Professional quoting tool for handymen and contractors",
  themeColor: "#0E6E7E",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
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
