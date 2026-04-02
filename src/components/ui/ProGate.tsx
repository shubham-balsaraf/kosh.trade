"use client";

import { useSession } from "next-auth/react";
import { Crown, Sparkles, Lock } from "lucide-react";
import Link from "next/link";

interface ProGateProps {
  children: React.ReactNode;
  feature: string;
}

export default function ProGate({ children, feature }: ProGateProps) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";
  const isPro = isAdmin || (user?.tier === "PRO" && !user?.banned);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-amber-500/[0.06] border border-amber-500/15 flex items-center justify-center mb-6">
          <Lock size={32} className="text-amber-400/60" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {feature} is a Pro Feature
        </h2>
        <p className="text-sm text-white/30 max-w-sm mb-8">
          You&apos;re on the Free plan. Upgrade to Pro to unlock {feature} and all premium features.
        </p>
        <Link
          href="/pricing"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-2xl hover:from-amber-400 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/20"
        >
          <Sparkles size={16} />
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
