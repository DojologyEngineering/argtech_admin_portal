"use client";

import * as React from "react";
import { cn } from "cn";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Search box plus optional filters, matching the bar that sits above every
 * list in the mockups. Stacks on phones.
 */
export function ListToolbar({
  query,
  onQueryChange,
  placeholder = "Search…",
  children,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  /** Filter controls rendered beside the search box. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 card-surface p-3 sm:p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-lg pl-10"
        />
      </div>
      {children ? (
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
