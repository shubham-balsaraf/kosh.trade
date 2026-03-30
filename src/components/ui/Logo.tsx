import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showDomain?: boolean;
  isPro?: boolean;
  className?: string;
}

export function LogoIcon({ size = "md", isPro = false, className }: { size?: "sm" | "md" | "lg"; isPro?: boolean; className?: string }) {
  const sizes = { sm: 20, md: 24, lg: 32 };
  const s = sizes[size];

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <rect width="32" height="32" rx="8" className={isPro ? "fill-amber-500/20" : "fill-indigo-500/20"} />
      <path
        d="M8 22L12 12L16 18L20 8L24 14"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="14" r="2" className={isPro ? "fill-amber-400" : "fill-indigo-400"} />
      <defs>
        <linearGradient id="logoGrad" x1="8" y1="22" x2="24" y2="8">
          {isPro ? (
            <>
              <stop stopColor="#F59E0B" />
              <stop offset="1" stopColor="#FCD34D" />
            </>
          ) : (
            <>
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#818CF8" />
            </>
          )}
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Logo({ size = "md", showDomain = false, isPro = false, className }: LogoProps) {
  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoIcon size={size === "xl" ? "lg" : size === "lg" ? "lg" : "md"} isPro={isPro} />
      <span className={cn(
        "font-black tracking-tight",
        textSizes[size],
        isPro
          ? "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent"
          : "text-white"
      )}>
        kosh{showDomain && <span className={isPro ? "text-amber-400/60" : "text-indigo-400"}>.trade</span>}
      </span>
    </span>
  );
}
