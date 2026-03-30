import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "kosh.trade — US Stock Fundamental Analyser",
  description: "AI-powered fundamental analysis, portfolio tracking, signals, and auto-investing for long-term US stock investors.",
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
