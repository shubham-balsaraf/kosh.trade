"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import Logo from "@/components/ui/Logo";
import { LayoutDashboard, LogIn, UserPlus } from "lucide-react";

export default function LandingNav() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-gray-800/50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="md" showDomain />
        </Link>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors font-medium"
              >
                <LogIn size={16} />
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
              >
                <UserPlus size={16} />
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
