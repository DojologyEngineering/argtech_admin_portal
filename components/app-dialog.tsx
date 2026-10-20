"use client";

import * as React from "react";
import { cn } from "cn";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The portal's modal shell.
 *
 * Full-screen on phones and a centred panel from `sm` upward, with a pinned
 * header, a scrolling body and a pinned footer — long forms like "Register New
 * Plot" stay usable on a handset without the action buttons drifting off screen.
 */

const SIZE_CLASS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
} as const;

export type DialogSize = keyof typeof SIZE_CLASS;

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  children,
  contentClassName,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: DialogSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Phones: edge-to-edge sheet. sm and up: centred, rounded panel.
          "fixed inset-0 top-0 left-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0",
          "sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          "sm:max-w-[calc(100%-2rem)]",
          SIZE_CLASS[size],
          contentClassName,
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 pb-1 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="-mt-1 -mr-1 shrink-0 text-muted-foreground"
          >
            <X className="size-5" />
          </Button>
        </header>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <footer className="flex shrink-0 flex-col-reverse gap-2 bg-muted/40 px-5 py-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:px-7">
            {footer}
          </footer>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form dialog with the mockups' primary/secondary button pair. Submitting runs
 * through a real `<form>` so Enter works and required fields are announced.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  submitLabel,
  submitting = false,
  onSubmit,
  children,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: DialogSize;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: () => void | Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const formId = React.useId();

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            disabled={submitting || disabled}
            className="w-full sm:w-auto"
          >
            {submitting ? "Saving…" : submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          // A dialog opened from inside another form (e.g. "add a new buyer" in
          // the order form) must not also submit the form underneath it.
          e.stopPropagation();
          void onSubmit();
        }}
        className="space-y-6"
      >
        {children}
      </form>
    </AppDialog>
  );
}
