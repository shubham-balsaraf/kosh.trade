"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Crown, Sparkles, Lock } from "lucide-react";
import Link from "next/link";

interface ProGateProps {
  children: React.ReactNode;
  feature: string;
}

export default function ProGate({ children, feature }: ProGateProps) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const [gateActive, setGateActive] = useState(false);

  useEffect(() => {
    if (isPro) return;
    const cached = sessionStorage.getItem("proGate");
    if (cached) {
      setGateActive(cached === "1");
      return;
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const enabled = d.proGateEnabled ?? false;
        setGateActive(enabled);
        sessionStorage.setItem("proGate", enabled ? "1" : "0");
        setTimeout(() => sessionStorage.removeItem("proGate"), 60_000);
      })
      .catch(() => {});
  }, [isPro]);

  const blocked = !isPro && gateActive;

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-amber-500/[0.06] border border-amber-500/15 flex items-center justify-center mb-6">
          <Lock size={32} className="text-amber-400/60" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {feature} is a Pro Feature
        </h2>
        <p className="text-sm text-white/30 max-w-sm mb-8">
          Upgrade to Pro to unlock {feature}, along with all other gold features and advanced analytics.
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

  return (
    <>
      {!isPro && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.06] to-yellow-500/[0.04] border border-amber-500/15 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Crown size={20} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-200">Pro Feature</h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/20">
                    GOLD
                  </span>
                </div>
                <p className="text-xs text-amber-200/40 mt-0.5">
                  {feature} is a Pro feature. Upgrade to unlock the full experience.
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/20"
            >
              <Sparkles size={12} />
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
