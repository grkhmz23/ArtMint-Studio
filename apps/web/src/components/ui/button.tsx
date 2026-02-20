import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono uppercase tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--accent)] hover:bg-transparent hover:text-[var(--accent)]",
        secondary:
          "bg-transparent border border-[var(--border)] text-[var(--text)] hover:bg-[var(--text)] hover:text-black",
        outline:
          "border border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black",
        ghost:
          "bg-transparent hover:text-[var(--accent)] text-[var(--text-dim)] border border-transparent",
        destructive:
          "bg-[var(--danger)] text-white border border-[var(--danger)] hover:bg-transparent hover:text-[var(--danger)]",
      },
      size: {
        sm: "h-8 px-4 text-[10px]",
        default: "h-12 px-6 text-xs",
        lg: "h-16 px-10 text-sm",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
