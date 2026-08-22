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
        variant === "default" &&
          "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white",
        variant === "secondary" && "bg-violet-100 text-violet-800",
        variant === "success" && "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80",
        variant === "warning" && "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80",
        variant === "destructive" && "bg-rose-100 text-rose-800 ring-1 ring-rose-200/80",
        className
      )}
      {...props}
    />
  );
}
