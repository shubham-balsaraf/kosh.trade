import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export default function Card({ className, hover = false, glow = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-4",
        hover && "hover:border-gray-700 hover:bg-gray-900 transition-all duration-200 cursor-pointer",
        glow && "shadow-lg shadow-indigo-500/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
