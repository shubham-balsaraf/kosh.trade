import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
  accent?: "indigo" | "emerald" | "blue" | "purple" | "amber" | "cyan" | "rose";
}

const accentStyles = {
  indigo: "hover:border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]",
  emerald: "hover:border-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.06)]",
  blue: "hover:border-blue-500/20 hover:shadow-[0_0_30px_rgba(59,130,246,0.06)]",
  purple: "hover:border-purple-500/20 hover:shadow-[0_0_30px_rgba(168,85,247,0.06)]",
  amber: "hover:border-amber-500/20 hover:shadow-[0_0_30px_rgba(245,158,11,0.06)]",
  cyan: "hover:border-cyan-500/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)]",
  rose: "hover:border-rose-500/20 hover:shadow-[0_0_30px_rgba(244,63,94,0.06)]",
};

export default function Card({ className, hover = false, glow = false, accent, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 transition-all duration-300",
        hover && "cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.1]",
        hover && accent && accentStyles[accent],
        glow && "shadow-lg shadow-indigo-500/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
