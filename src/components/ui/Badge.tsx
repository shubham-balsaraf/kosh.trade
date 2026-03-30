import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "green" | "yellow" | "red" | "blue" | "gray" | "indigo" | "gold";
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant = "gray", children, className }: BadgeProps) {
  const variants = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    yellow: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    red: "bg-red-500/15 text-red-400 border-red-500/20",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    gray: "bg-gray-500/15 text-gray-400 border-gray-500/20",
    indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    gold: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", variants[variant], className)}>
      {children}
    </span>
  );
}
