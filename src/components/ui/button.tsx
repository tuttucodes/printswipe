import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 cursor-pointer select-none rounded-pill disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent focus-visible:outline-offset-2 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-ink/90 shadow-glass-sm hover:shadow-glass-md",
        secondary: "bg-paper text-ink border border-hairline hover:bg-ink/5 shadow-glass-sm",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        accent: "bg-accent text-paper hover:bg-accent/90 shadow-glass-sm hover:shadow-glass-md",
        link: "underline underline-offset-4 hover:opacity-70",
      },
      size: {
        sm: "min-h-11 md:min-h-9 h-11 md:h-9 px-4 text-xs",
        md: "min-h-11 h-11 px-6",
        lg: "min-h-14 h-14 px-8 text-base",
        icon: "min-h-11 min-w-11 md:min-h-10 md:min-w-10 h-11 w-11 md:h-10 md:w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
