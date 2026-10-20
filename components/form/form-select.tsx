"use client";

import * as React from "react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional second line inside the option row. */
  description?: string;
}

/**
 * Thin wrapper over the Base UI select.
 *
 * Every call site in the portal deals in plain string values, so this collapses
 * Base UI's `Value | Value[] | null` change signature down to `string`, wires up
 * the `items` list that lets the trigger show a label instead of a raw id, and
 * makes the control full width by default.
 */
export function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
  disabled,
  invalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const items = React.useMemo(
    () => options.map((o) => ({ value: o.value, label: o.label })),
    [options],
  );

  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn("h-9 w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.description ? (
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Builds options from a plain string list, where value === label. */
export function stringOptions(values: string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: v }));
}
