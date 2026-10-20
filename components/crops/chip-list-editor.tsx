"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * A short list of labels that can be added and removed, shown as pills. Used for
 * a crop's chips and for the options a buyer can pick on a request.
 */
export function ChipListEditor({
  label,
  values,
  onChange,
  max,
  placeholder,
  leading,
}: {
  /** Accessible name for the group and the add box. */
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  /** A fixed first pill that cannot be removed, e.g. "Standard". */
  leading?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const full = max !== undefined && values.length >= max;

  const add = () => {
    const next = draft.trim();
    if (!next || full) return;
    const exists = values.some((v) => v.toLowerCase() === next.toLowerCase());
    if (!exists && next.toLowerCase() !== leading?.toLowerCase()) {
      onChange([...values, next]);
    }
    setDraft("");
  };

  return (
    <div role="group" aria-label={label} className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {leading ? (
          <li className="rounded-full border border-dashed border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
            {leading}
          </li>
        ) : null}
        {values.map((value) => (
          <li
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
        {values.length === 0 && !leading ? (
          <li className="text-xs text-muted-foreground">None yet</li>
        ) : null}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={full ? `Up to ${max} — remove one to add another` : placeholder}
          aria-label={`Add to ${label}`}
          disabled={full}
          className="h-8 max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={full || !draft.trim()}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}
