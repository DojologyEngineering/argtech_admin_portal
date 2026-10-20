"use client";

import * as React from "react";
import { FormDialog } from "@/components/app-dialog";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Small dialog that asks staff for a reason before a request is declined or an
 * order is cancelled. The reason is required.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  suggestions,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  /** Quick reasons shown as chips. Choosing one fills the box; "Other" clears it. */
  suggestions?: string[];
  submitLabel: string;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const boxRef = React.useRef<HTMLTextAreaElement>(null);

  const choose = (option: string) => {
    setError(null);
    if (option === "Other") {
      setReason("");
      boxRef.current?.focus();
    } else {
      setReason(option);
    }
  };

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the reason.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      submitLabel={submitLabel}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {suggestions && suggestions.length > 0 ? (
        <div role="group" aria-label="Quick reasons" className="flex flex-wrap gap-1.5">
          {suggestions.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={reason === option ? "default" : "outline"}
              aria-pressed={reason === option}
              onClick={() => choose(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}
      <Field label={label} required error={error} htmlFor="order-reason">
        <Textarea
          ref={boxRef}
          id="order-reason"
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          aria-invalid={Boolean(error) || undefined}
          autoFocus
        />
      </Field>
    </FormDialog>
  );
}
