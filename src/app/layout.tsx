import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { Geist, Geist_Mono } from "next/font/google";
import { AgentProvider } from "@/lib/agent";
import { HomeProvider } from "@/lib/home";
import { LoggerProvider } from "@/lib/logging";
import { AnalyticsIdentifier } from "@/components/analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "apprAIser. Your collectibles curation expert",
  description: "AI-powered auction item search and valuation assistant",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <AnalyticsIdentifier />
          <HomeProvider>
            <AgentProvider>
              <LoggerProvider>{children}</LoggerProvider>
            </AgentProvider>
          </HomeProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
