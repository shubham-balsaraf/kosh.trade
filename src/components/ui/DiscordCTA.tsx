"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, MessageCircle } from "lucide-react";

const DISCORD_USER_URL = "https://discord.com/users/noobkratos987";

export default function DiscordCTA() {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const message = `Hi! I'd like to test out Pro features on kosh.trade.\nEmail: ${email || "your@email.com"}`;

  const handleSend = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {});
    window.open(DISCORD_USER_URL, "_blank");
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#5865F2]/20 bg-gradient-to-br from-[#5865F2]/[0.08] to-[#5865F2]/[0.02]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#5865F2]/[0.06] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="relative p-8 md:p-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="#5865F2"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Want to try Pro features?</h2>
            <p className="text-sm text-gray-400">DM me on Discord — I&apos;ll enable it for you</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Send a quick message with your email and I&apos;ll upgrade your account to Pro.
          Also happy to hear feature suggestions or feedback.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Your email (the one you signed up with)</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#5865F2]/40 focus:border-[#5865F2]/30 transition-all"
            />
          </div>

          <div className="bg-black/20 border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Message preview</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-400 whitespace-pre-line font-mono leading-relaxed">{message}</p>
          </div>

          <button
            onClick={handleSend}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-xl shadow-lg shadow-[#5865F2]/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <MessageCircle size={18} />
            Send on Discord
            <ArrowRight size={16} />
          </button>

          <p className="text-center text-[11px] text-gray-600 mt-2">
            Opens Discord and copies the message — just paste it in the DM to{" "}
            <span className="text-[#5865F2]/70 font-semibold">noobkratos987</span>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-sm text-gray-500">
            Have a feature idea or suggestion?
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Reach out on Discord — always looking for ways to improve Kosh.
          </p>
        </div>
      </div>
    </div>
  );
}
