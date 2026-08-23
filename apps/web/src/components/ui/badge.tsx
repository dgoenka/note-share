import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        variant === "default" && "bg-[var(--primary)] text-[#faf6ef]",
        variant === "secondary" && "bg-[var(--primary-soft)] text-[var(--primary)]",
        variant === "success" &&
          "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
        variant === "warning" &&
          "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
        variant === "destructive" &&
          "bg-rose-100 text-rose-900 ring-1 ring-rose-200/80",
        className
      )}
      {...props}
    />
  );
}
