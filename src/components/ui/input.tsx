import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full hairline bg-paper px-3 py-2 text-sm placeholder:text-ink/40",
        "focus:outline-none focus:ring-2 focus:ring-accent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "font-mono",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
