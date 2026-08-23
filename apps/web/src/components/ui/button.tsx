import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[#faf6ef] shadow-md shadow-stone-900/15 hover:bg-[#4a3125]",
        secondary:
          "bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[#ead7c4]",
        outline:
          "border border-stone-300/90 bg-white/80 text-stone-900 hover:bg-white hover:border-stone-400",
        destructive:
          "bg-[var(--danger)] text-white shadow-md shadow-rose-900/15 hover:bg-[#991b1b]",
        ghost: "text-stone-800 hover:bg-stone-900/5",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-2xl px-5 text-base sm:h-12 sm:px-8",
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
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Spinner
          size="sm"
          className={cn(
            variant === "default" || variant === "destructive"
              ? "text-[#faf6ef]"
              : "text-[var(--primary)]"
          )}
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
