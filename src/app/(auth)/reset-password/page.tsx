"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Logo from "@/components/ui/Logo";
import { Lock, Eye, EyeOff, Check, AlertTriangle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Invalid Reset Link</h2>
        <p className="text-sm text-gray-400">
          This password reset link is invalid or missing. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Check size={24} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Password Updated</h2>
        <p className="text-sm text-gray-400">
          Your password has been successfully reset. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="inline-block mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm rounded-xl px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">New password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="!pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Confirm password</label>
          <Input
            type="password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {password.length > 0 && (
          <div className="flex items-center gap-2">
            <div className={`h-1 flex-1 rounded-full transition-all ${
              password.length >= 8
                ? password.length >= 12 ? "bg-emerald-500" : "bg-yellow-500"
                : "bg-red-500"
            }`} />
            <span className="text-[10px] text-gray-500">
              {password.length >= 12 ? "Strong" : password.length >= 8 ? "Good" : "Too short"}
            </span>
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Reset Password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-2">
          <Logo size="lg" showDomain />
        </div>
        <p className="text-gray-500 text-sm mt-2">Set a new password</p>
      </div>

      <Suspense fallback={
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
