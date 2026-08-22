import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "success" | "warning";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        variant === "default" &&
          "border-violet-200 bg-violet-50/90 text-violet-900",
        variant === "destructive" &&
          "border-rose-200 bg-rose-50 text-rose-900",
        variant === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        variant === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-950",
        className
      )}
      {...props}
    />
  );
}
