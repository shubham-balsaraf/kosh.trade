import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "kosh.trade — AI-Powered Stock Analysis & Autonomous Trading",
  description:
    "Deep fundamental analysis, real-time signal discovery, portfolio AI summaries, and autonomous trading — built for long-term US stock investors. Created by Shubham Balsaraf.",
  keywords: [
    "stock analysis",
    "fundamental analysis",
    "AI trading",
    "autonomous trading",
    "portfolio tracker",
    "signal alerts",
    "kosh",
    "kosh.trade",
    "KoshPilot",
    "Shubham Balsaraf",
  ],
  authors: [{ name: "Shubham Balsaraf", url: "https://github.com/shubham-balsaraf" }],
  creator: "Shubham Balsaraf",
  metadataBase: new URL("https://kosh.trade"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kosh.trade",
    siteName: "kosh.trade",
    title: "kosh.trade — AI-Powered Stock Analysis & Autonomous Trading",
    description:
      "Deep fundamental analysis, real-time signal discovery, portfolio AI summaries, and autonomous trading — built for long-term US stock investors.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kosh.trade — AI-Powered Stock Analysis & Autonomous Trading",
    description:
      "Deep fundamental analysis, real-time signal discovery, and autonomous trading for US stock investors.",
    creator: "@shubhambalsaraf",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} bg-black text-gray-200 min-h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
