"use client";

import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  locked?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export default function ProBadge({ locked = false, size = "sm", className }: ProBadgeProps) {
  const router = useRouter();

  const handleClick = () => {
    if (locked) router.push("/pricing");
  };

  return (
    <span
      onClick={locked ? handleClick : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold border",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/30",
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs",
        locked && "cursor-pointer hover:from-amber-500/30 hover:to-yellow-500/30 transition-all",
        className
      )}
    >
      <Crown size={size === "sm" ? 10 : 12} />
      PRO
    </span>
  );
}
