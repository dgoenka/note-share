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
          "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-violet-500/35",
        secondary:
          "bg-violet-100 text-violet-900 hover:bg-violet-200/90",
        outline:
          "border border-violet-200/80 bg-white/70 text-violet-950 hover:bg-white hover:border-violet-300",
        destructive:
          "bg-gradient-to-br from-rose-600 to-orange-500 text-white shadow-md shadow-rose-500/20 hover:from-rose-500 hover:to-orange-400",
        ghost: "text-violet-800 hover:bg-violet-100/70",
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
  /** Shows spinner and forces disabled to prevent double clicks */
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
              ? "text-white"
              : "text-violet-700"
          )}
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
