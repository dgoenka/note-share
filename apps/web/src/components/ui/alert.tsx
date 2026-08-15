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
        "rounded-md border px-4 py-3 text-sm",
        variant === "default" && "border-slate-200 bg-slate-50 text-slate-800",
        variant === "destructive" && "border-red-200 bg-red-50 text-red-800",
        variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        variant === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        className
      )}
      {...props}
    />
  );
}
