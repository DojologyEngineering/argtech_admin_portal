"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "cn";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Document upload tile.
 *
 * With no file storage in this phase the file is held as a data URL on the
 * record, which is why oversized files are rejected rather than silently
 * filling up local storage. Swapping this for an upload endpoint later only
 * changes what `onChange` receives.
 */
export function FileDrop({
  label,
  hint,
  value,
  onChange,
  accept = "image/*",
  className,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  accept?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Keep the file under 2 MB for this preview build.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">{label}</p>

      {value ? (
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src={value}
            alt={label}
            width={320}
            height={160}
            unoptimized
            className="h-32 w-full object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
            className="absolute top-2 right-2"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/40 px-3 text-center transition-colors hover:border-primary/50 hover:bg-brand-softer"
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-xs font-medium">Upload {label.toLowerCase()}</span>
          <span className="text-xs text-muted-foreground">
            Click to browse files
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
