"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-base sm:text-sm text-gray-200",
          "placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/20",
          "transition-all duration-300",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
export default Input;
