import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Printswipe — Skip the print queue",
  description: "Schedule print jobs at on-campus print shops. Pay online, walk in, collect.",
  manifest: "/manifest.json",
  applicationName: "Printswipe",
  appleWebApp: {
    capable: true,
    title: "Printswipe",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: [
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-paper">
      <body className="bg-paper text-ink grain min-h-[100dvh]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
