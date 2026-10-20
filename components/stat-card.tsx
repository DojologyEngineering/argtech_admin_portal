import * as React from "react";
import { cn } from "cn";

/**
 * Summary tile used on the dashboard and at the top of each module.
 * The icon sits in a soft brand-tinted square, as in the mockups.
 */
export function StatCard({
  icon,
  value,
  label,
  hint,
  className,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 card-surface p-5 xl:gap-3.5 xl:p-4 2xl:gap-4 2xl:p-6",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        {/* Proportional figures: tabular-nums only belongs in aligned columns. */}
        <div className="text-[28px] leading-9 font-semibold tracking-tight">{value}</div>
        <div className="text-xs leading-snug text-muted-foreground">{label}</div>
        {hint ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
