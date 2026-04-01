"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Logo from "@/components/ui/Logo";
import { ArrowLeft, Mail, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isGoogle, setIsGoogle] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setIsGoogle(false);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.isGoogle) {
        setIsGoogle(true);
      } else {
        setSent(true);
      }
    } catch {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-2">
          <Logo size="lg" showDomain />
        </div>
        <p className="text-gray-500 text-sm mt-2">Reset your password</p>
      </div>

      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Check size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Check your email</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              If an account exists for <span className="text-white font-medium">{email}</span>, we&apos;ve sent a password reset link. It expires in 1 hour.
            </p>
            <p className="text-xs text-gray-600">
              Didn&apos;t get the email? Check your spam folder or try again.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Try a different email
              </button>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-300 font-medium transition-colors">
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            {isGoogle && (
              <div className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0 mt-0.5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <div>
                  <p className="text-sm text-blue-300 font-medium">This account uses Google Sign-In</p>
                  <p className="text-xs text-blue-400/60 mt-0.5">
                    No password to reset. Use the Google button on the{" "}
                    <Link href="/login" className="underline">sign in page</Link>.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="!pl-10"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
              </p>
              <Button type="submit" className="w-full" loading={loading}>
                Send Reset Link
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 font-medium transition-colors"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
