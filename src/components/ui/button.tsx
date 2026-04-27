import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-200 cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hairline hover:bg-paper hover:text-ink",
        secondary: "bg-paper text-ink hairline hover:bg-ink hover:text-paper",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        accent: "bg-accent text-paper hover:opacity-90",
        link: "underline underline-offset-4 hover:opacity-70",
      },
      size: {
        // 44px min-height on touch viewports for WCAG 2.5.5 / iOS HIG
        sm: "min-h-11 md:min-h-9 h-11 md:h-9 px-3 text-xs",
        md: "min-h-11 h-11 px-5",
        lg: "min-h-14 h-14 px-7 text-base",
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
