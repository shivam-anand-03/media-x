import "@workspace/ui/globals.css";
import type { Metadata, Viewport } from "next";

import { AppRootProviders } from "@/components/providers/app-root-providers";
import { appfonts } from "@/fonts";
import { cn } from "@/lib/utils";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "EssentoLabs | Fullstack Boilerplate Starter",
    template: "%s | EssentoLabs",
  },
  description:
    "A clean, modern, enterprise-grade fullstack monorepo starter built with Next.js 15, Express, MongoDB, Vector DB, Redux Toolkit, and Tailwind CSS.",
  keywords: [
    "fullstack starter",
    "next.js 15",
    "express",
    "mongodb",
    "vectordb",
    "turborepo",
    "typescript",
    "tailwind css",
    "redux toolkit",
  ],
  authors: [{ name: "EssentoLabs Team" }],
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "http://localhost:3000",
    title: "EssentoLabs | Fullstack Boilerplate Starter",
    description:
      "A modern, robust fullstack monorepo starter with Next.js 15, Express, MongoDB, Vector DB, Redux Toolkit, and Tailwind CSS.",
    siteName: "EssentoLabs",
  },
};

export default function AppRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background text-foreground font-sans antialiased",
          appfonts,
        )}
      >
        <AppRootProviders>
          <main>{children}</main>
        </AppRootProviders>
      </body>
    </html>
  );
}
