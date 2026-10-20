"use client";

import * as React from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneDot, toneChipClass } from "@/components/status-badge";
import { num } from "@/lib/format";
import { CALENDAR_EVENT_TYPES, type CalendarEvent } from "@/lib/services/cycles";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read-only month grid.
 *
 * Every harvest-log entry gets its own marker rather than one per cycle, so a
 * crop picked eight times over three weeks shows eight harvest days.
 */
export function MonthGrid({
  events,
  onSelectDay,
  selectedDay,
}: {
  events: CalendarEvent[];
  onSelectDay: (iso: string | null) => void;
  selectedDay: string | null;
}) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const todayISO = toISO(new Date());

  // Grid always starts on the Monday on or before the 1st.
  const gridStart = React.useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - offset);
    return first;
  }, [cursor]);

  const days = React.useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [gridStart],
  );

  return (
    <div className="card-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold">
            {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {CALENDAR_EVENT_TYPES.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"
            >
              <ToneDot status={type} />
              {type}
            </span>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] px-3 pb-4">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const iso = toISO(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayEvents = byDate.get(iso) ?? [];
              const isToday = iso === todayISO;
              const isSelected = iso === selectedDay;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelectDay(isSelected ? null : iso)}
                  className={cn(
                    "min-h-24 rounded-xl p-2 text-left align-top outline-none transition-colors hover:bg-hover-tint focus-visible:ring-2 focus-visible:ring-ring/50",
                    !inMonth && "bg-muted/40",
                    isSelected && "bg-brand-softer ring-2 ring-primary/30",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                      !isToday && !inMonth && "text-muted-foreground",
                      !isToday && inMonth && "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>

                  <span className="mt-1.5 flex flex-col gap-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs",
                          toneChipClass(event.type),
                        )}
                        title={
                          event.orderCode
                            ? `${event.type} · ${event.orderCode} · ${event.cropName}`
                            : `${event.type} · ${event.cropName} · ${event.farmerName}`
                        }
                      >
                        <ToneDot status={event.type} />
                        <span className="truncate">
                          {event.type === "Harvest" && event.quantityKg
                            ? `${num(event.quantityKg)} kg ${event.cropName}`
                            : event.orderCode
                              ? `${event.orderCode} ${event.cropName}`
                              : `${event.cropName}`}
                        </span>
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="px-1.5 text-xs font-medium text-primary">
                        +{dayEvents.length - 3} more
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
