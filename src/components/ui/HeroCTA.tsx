"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, ChevronRight, Crown, Brain } from "lucide-react";

interface HeroCTAProps {
  variant?: "hero" | "bottom";
}

export default function HeroCTA({ variant = "hero" }: HeroCTAProps) {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  if (variant === "bottom") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center relative">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
          {isLoggedIn ? "Take your investing to the next level" : "Ready to analyze like a pro?"}
        </h2>
        <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
          {isLoggedIn
            ? "Unlock AI portfolio management, advanced signals, and automated investing with Pro."
            : "Join investors using AI-powered fundamental analysis to make better, data-driven decisions."}
        </p>
        {isLoggedIn ? (
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/pricing"
              className="group inline-flex items-center justify-center gap-2 px-10 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-105 text-lg"
            >
              <Crown size={20} />
              Upgrade to Pro
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-800/80 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all hover:scale-105 text-lg"
            >
              <Brain size={18} />
              Let AI Manage Your Portfolio
            </Link>
          </div>
        ) : (
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105 text-lg"
          >
            Create Free Account
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 animate-fade-in-up-delay-3">
      {isLoggedIn ? (
        <>
          <Link
            href="/pricing"
            className="group px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-105 flex items-center justify-center gap-2"
          >
            <Crown size={16} />
            Upgrade to Pro Now
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all hover:scale-105 flex items-center justify-center gap-2"
          >
            <Brain size={16} />
            Let AI Manage Your Portfolio
            <ChevronRight size={16} />
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/register"
            className="group px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105 flex items-center justify-center gap-2"
          >
            Get Started Free
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all hover:scale-105 flex items-center justify-center gap-2"
          >
            Sign In
            <ChevronRight size={16} />
          </Link>
        </>
      )}
    </div>
  );
}
