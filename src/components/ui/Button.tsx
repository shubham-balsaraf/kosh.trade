"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25",
      secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700",
      ghost: "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200",
      danger: "bg-red-600 hover:bg-red-500 text-white",
    };
    const sizes = {
      sm: "text-xs px-3 py-2 gap-1.5 min-h-[36px]",
      md: "text-sm px-4 py-2.5 gap-2 min-h-[44px]",
      lg: "text-base px-6 py-3 gap-2.5 min-h-[48px]",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
