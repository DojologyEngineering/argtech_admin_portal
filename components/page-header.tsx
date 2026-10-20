"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { activeNavItem } from "@/lib/nav";

/**
 * Title block sitting above every module's content.
 *
 * The app bar carries the page's one h1 (the current module's name). When this
 * title would only repeat it, nothing is rendered for it: just the subtitle and
 * actions show. Detail screens pass their own title (a cycle code, an order
 * code) which never matches the nav entry, so those show as the page's h2.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const duplicatesAppBar = activeNavItem(pathname)?.title === title;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {duplicatesAppBar ? null : (
          <h2 className="text-[22px] leading-tight font-semibold tracking-tight">{title}</h2>
        )}
        {subtitle ? (
          <p
            className={cn(
              "text-sm text-muted-foreground",
              !duplicatesAppBar && "mt-0.5",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
