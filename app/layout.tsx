import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { OverseerMount } from "./_components/overseer-mount";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeOS",
  description: "La tua dashboard personale: task, calendario, palestra.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeOS",
  },
};

export const viewport: Viewport = {
  // Entrambi i temi (run-05 prompt 2): la barra di stato segue il tema di
  // sistema; il ground scuro è l'ink Ember, quello chiaro la calce.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#15171C" },
    { media: "(prefers-color-scheme: light)", color: "#F4F3EF" },
  ],
  width: "device-width",
  initialScale: 1,
  // WCAG 1.4.4: never block pinch-zoom. We let users zoom up to 5×; this
  // also disables the iOS "double-tap to zoom" delay because initialScale
  // is set, but doesn't trap users at the default size.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text-primary">
        {children}
        <OverseerMount />
      </body>
    </html>
  );
}
