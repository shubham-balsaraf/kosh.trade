import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
  accent?: "indigo" | "emerald" | "blue" | "purple" | "amber" | "cyan" | "rose";
}

const accentStyles = {
  indigo: "hover:border-indigo-500/30 hover:shadow-indigo-500/5",
  emerald: "hover:border-emerald-500/30 hover:shadow-emerald-500/5",
  blue: "hover:border-blue-500/30 hover:shadow-blue-500/5",
  purple: "hover:border-purple-500/30 hover:shadow-purple-500/5",
  amber: "hover:border-amber-500/30 hover:shadow-amber-500/5",
  cyan: "hover:border-cyan-500/30 hover:shadow-cyan-500/5",
  rose: "hover:border-rose-500/30 hover:shadow-rose-500/5",
};

export default function Card({ className, hover = false, glow = false, accent, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-4",
        hover && "hover:bg-gray-900 transition-all duration-300 cursor-pointer shadow-lg shadow-transparent",
        hover && accent ? accentStyles[accent] : hover && "hover:border-gray-600",
        glow && "shadow-lg shadow-indigo-500/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
