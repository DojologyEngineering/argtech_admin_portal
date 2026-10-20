"use client";

import * as React from "react";
import { cn } from "cn";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Select or type to create" control.
 *
 * Field agents add soil types, delivery methods and buyers as they meet them,
 * so these lists have to be extendable from inside the form rather than only
 * from a settings screen. Values are plain strings.
 */
export function ComboCreate({
  value,
  onChange,
  options,
  placeholder = "Select or type to create…",
  emptyHint = "No matches — type to add a new one.",
  id,
  disabled,
  invalid,
  allowClear = true,
  onCreate,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyHint?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowClear?: boolean;
  /** Called when a brand-new value is committed, so it can be persisted. */
  onCreate?: (value: string) => unknown;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const filtered = React.useMemo(() => {
    if (!trimmed) return options;
    const q = trimmed.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, trimmed]);

  const exactMatch = options.some(
    (o) => o.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactMatch;

  React.useEffect(() => {
    if (!open) return;
    // Base UI moves focus to the popup; hand it on to the search box.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  /** Closing always discards the search text, so the next open starts clean. */
  const setOpenState = (next: boolean) => {
    if (!next) setQuery("");
    setOpen(next);
  };

  const commit = async (next: string, isNew: boolean) => {
    onChange(next);
    setOpenState(false);
    if (isNew && onCreate) await onCreate(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 text-left text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            !value && "text-muted-foreground",
          )}
        >
          {value || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-56 gap-0 p-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length > 0) void commit(filtered[0]!, false);
                else if (canCreate) void commit(trimmed, true);
              }
            }}
            placeholder="Search or type a new value…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => void commit(option, false)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="truncate">{option}</span>
              {option === value ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : null}
            </button>
          ))}

          {filtered.length === 0 && !canCreate ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {emptyHint}
            </p>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              onClick={() => void commit(trimmed, true)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-2.5 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="size-4 shrink-0" />
              <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
