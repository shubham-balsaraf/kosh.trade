"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-base sm:text-sm text-gray-200",
          "placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          "transition-all duration-200",
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
