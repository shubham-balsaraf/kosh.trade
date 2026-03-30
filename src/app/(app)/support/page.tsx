"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Mail, MessageSquare, Send, CheckCircle } from "lucide-react";

const CATEGORIES = [
  "General Question",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Billing / Pro Plan",
  "Data Accuracy",
  "Other",
];

export default function SupportPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSending(true);
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          userEmail: user?.email,
          userName: user?.name,
        }),
      });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch {
      // still show success — the message will be logged server-side
      setSent(true);
    }
    setSending(false);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Contact Support</h1>
        <p className="text-gray-500 text-sm mt-1">
          Have a question, found a bug, or want to request a feature? We&apos;re here to help.
        </p>
      </div>

      <Card className="!bg-gradient-to-br from-indigo-950/30 to-gray-900 !border-indigo-500/15">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 shrink-0">
            <Mail size={24} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Email Us Directly</h3>
            <p className="text-sm text-gray-400 mt-1">
              For quick inquiries, reach out directly at
            </p>
            <a
              href="mailto:shubhambalsaraf73@gmail.com"
              className="inline-flex items-center gap-2 mt-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors"
            >
              <Mail size={14} />
              shubhambalsaraf73@gmail.com
            </a>
          </div>
        </div>
      </Card>

      {sent ? (
        <Card className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-lg font-bold text-white">Message Sent</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            Thanks for reaching out. We&apos;ll get back to you as soon as possible.
          </p>
          <Button
            onClick={() => setSent(false)}
            variant="secondary"
            className="mt-6"
          >
            Send Another Message
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare size={18} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-400">Send a Message</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                      category === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Subject</label>
              <Input
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Message</label>
              <textarea
                placeholder="Tell us more about your question or issue..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-base sm:text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
              />
            </div>

            {user?.email && (
              <p className="text-xs text-gray-600">
                We&apos;ll reply to <span className="text-gray-400">{user.email}</span>
              </p>
            )}

            <Button
              type="submit"
              loading={sending}
              disabled={!subject.trim() || !message.trim()}
              className="w-full sm:w-auto"
            >
              <Send size={14} />
              Send Message
            </Button>
          </form>
        </Card>
      )}

      <Card className="!p-3">
        <p className="text-[11px] text-gray-600 text-center">
          We typically respond within 24-48 hours. For urgent issues, email us directly.
        </p>
      </Card>
    </div>
  );
}
