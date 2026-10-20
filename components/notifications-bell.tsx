"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  Inbox,
  MapPin,
  MessageSquareWarning,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import type { AttentionItem, AttentionKind } from "@/lib/services/attention";
import { cn } from "cn";

const ICONS: Record<AttentionKind, LucideIcon> = {
  today: CalendarClock,
  overdue: Sprout,
  requests: Inbox,
  pickup: MapPin,
  issue: MessageSquareWarning,
};

/**
 * The notification bell. It lists what needs attention, each linking to the page
 * where it is dealt with. The red dot shows only while there is something to do.
 */
export function NotificationsBell({ items }: { items: AttentionItem[] }) {
  const [open, setOpen] = React.useState(false);
  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={
          count > 0 ? `Notifications, ${count} need attention` : "Notifications, nothing needs attention"
        }
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-card"
          />
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-0 p-0 sm:w-96">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">
            {count > 0 ? `Needs attention (${count})` : "Nothing needs attention"}
          </p>
        </div>
        {count === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No requests waiting, pickups to arrange, open issues, overdue harvests
            or orders due today.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.text}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
