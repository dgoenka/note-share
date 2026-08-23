import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/** Full-area loading state that replaces content (session/page loads). */
export function LoadingBlock({
  label = "Loading…",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "glass-card flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center",
        className
      )}
    >
      <Spinner size="lg" />
      <p className="text-sm font-semibold text-violet-800/80">{label}</p>
      {children}
    </div>
  );
}

/**
 * Wraps interactive content. While `active`, shows a spinner overlay and
 * blocks pointer/keyboard interaction so users can't double-submit.
 */
export function LoadingOverlay({
  active,
  label = "Working…",
  children,
  className,
}: {
  active: boolean;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("relative", className)}
      aria-busy={active || undefined}
    >
      <div
        className={cn(
          active && "pointer-events-none select-none opacity-55"
        )}
      >
        {children}
      </div>
      {active && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white/55 backdrop-blur-[2px]"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-violet-200/70 bg-white/95 px-4 py-2.5 shadow-lg shadow-violet-500/10">
            <Spinner size="sm" />
            <span className="text-sm font-semibold text-violet-900">
              {label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
