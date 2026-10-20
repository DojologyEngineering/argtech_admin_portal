"use client";

import * as React from "react";
import { cn } from "cn";
import { Loader2 } from "lucide-react";

/**
 * The portal's one list surface.
 *
 * On md and wider it renders a real table. Below that, each row becomes a
 * stacked card built from the same column definitions — so a page describes its
 * columns once and gets both layouts.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Small muted line under the header text, e.g. the units or bands behind a value. */
  headerSub?: string;
  /** Tooltip on the header cell. */
  headerTitle?: string;
  cell: (row: T) => React.ReactNode;
  /** Becomes the card title on small screens. Exactly one column should set it. */
  primary?: boolean;
  /** Rendered under the title on cards, e.g. a secondary identifier. */
  subtitle?: boolean;
  align?: "left" | "right";
  /** Keep out of the stacked card view (usually because it duplicates the title). */
  hideInCard?: boolean;
  /** Drop below the given breakpoint in table view. */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  headerClassName?: string;
  width?: string;
}

const HIDE_BELOW_CLASS = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const;

/** Where the stacked-card layout gives way to the real table. Classes are written out in full for Tailwind. */
const LAYOUT_CLASS = {
  md: { table: "hidden overflow-x-auto md:block", cards: "divide-y divide-border md:hidden" },
  lg: { table: "hidden overflow-x-auto lg:block", cards: "divide-y divide-border lg:hidden" },
  xl: { table: "hidden overflow-x-auto xl:block", cards: "divide-y divide-border xl:hidden" },
} as const;

export interface DataTableProps<T> {
  /**
   * Breakpoint at which the table replaces the stacked cards. Wide tables use
   * "xl" so they never clip next to the sidebar. Default "md".
   */
  tableFrom?: keyof typeof LAYOUT_CLASS;
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Trailing actions cell, rendered on the right of both layouts. */
  actions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: React.ReactNode;
  /** Footer line, e.g. "Showing 4 of 12". */
  footer?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  onRowClick,
  loading = false,
  emptyTitle = "Nothing to show yet",
  emptyHint,
  footer,
  className,
  tableFrom = "md",
}: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const subtitle = columns.find((c) => c.subtitle);
  const cardFields = columns.filter(
    (c) => c !== primary && c !== subtitle && !c.hideInCard,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 card-surface px-6 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card-surface px-6 py-14 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        {emptyHint ? (
          <div className="mt-1.5 text-sm text-muted-foreground">{emptyHint}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden card-surface", className)}>
      {/* ---------------------------------------------------- table view */}
      <div className={LAYOUT_CLASS[tableFrom].table}>
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  title={col.headerTitle}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "px-5 py-3.5 text-left text-xs font-medium text-muted-foreground",
                    col.align === "right" && "text-right",
                    col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                    col.headerClassName,
                  )}
                >
                  {col.header}
                  {col.headerSub ? (
                    <span className="block text-[11px] font-normal whitespace-nowrap text-muted-foreground/80">
                      {col.headerSub}
                    </span>
                  ) : null}
                </th>
              ))}
              {actions ? (
                <th
                  scope="col"
                  className="px-5 py-3.5 text-right text-xs font-medium text-muted-foreground"
                >
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                // Keyboard access: Tab to a row, Enter or Space opens it. Keys
                // pressed on a button inside the row are left to that button.
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "h-14 border-b border-border last:border-0 transition-colors",
                  onRowClick &&
                    "cursor-pointer hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-5 py-3.5 align-middle",
                      col.align === "right" && "text-right font-medium tabular-nums",
                      col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
                {actions ? (
                  <td
                    className="px-5 py-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {actions(row)}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----------------------------------------------------- card view */}
      <ul className={LAYOUT_CLASS[tableFrom].cards}>
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "px-4 py-4",
                onRowClick && "cursor-pointer transition-colors active:bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{primary?.cell(row)}</div>
                  {subtitle ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {subtitle.cell(row)}
                    </div>
                  ) : null}
                </div>
                {actions ? (
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </div>
                ) : null}
              </div>

              {cardFields.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {cardFields.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground">
                        {col.header}
                      </dt>
                      <dd className="mt-0.5 truncate text-sm">{col.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {footer ? (
        <div className="px-5 pt-2 pb-5 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
