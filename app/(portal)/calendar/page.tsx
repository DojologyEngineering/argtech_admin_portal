"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, List, TrendingUp } from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/page-header";
import { MonthGrid } from "@/components/calendar/month-grid";
import { SupplyForecastView } from "@/components/calendar/supply-forecast";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { ListToolbar } from "@/components/list-toolbar";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_EVENT_TYPES,
  listCalendarEvents,
  type CalendarEvent,
} from "@/lib/services/cycles";
import { num, prettyDate } from "@/lib/format";

type View = "calendar" | "list" | "forecast";

export default function CalendarPage() {
  const [view, setView] = React.useState<View>("calendar");
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("");

  React.useEffect(() => {
    void listCalendarEvents().then((next) => {
      setEvents(next);
      setLoading(false);
    });
  }, []);

  const filteredEvents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (type && e.type !== type) return false;
      if (!q) return true;
      return [e.cropName, e.farmerName, e.plotName, e.cycleCode, e.orderCode ?? "", e.note]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [events, query, type]);

  const dayEvents = selectedDay
    ? events.filter((e) => e.date === selectedDay)
    : [];

  const counts = React.useMemo(() => {
    const by = (t: string) => events.filter((e) => e.type === t).length;
    return {
      planting: by("Planting"),
      harvest: by("Harvest"),
      activity: by("Irrigation") + by("Fertilization"),
      orders: by("Delivery") + by("Pickup"),
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle={`${counts.planting} plantings · ${counts.harvest} harvest pickings · ${counts.activity} field activities · ${counts.orders} deliveries and pickups`}
        actions={
          <div className="inline-flex rounded-full bg-muted p-1">
            <ViewTab active={view === "calendar"} onClick={() => setView("calendar")}>
              <CalendarDays className="size-4" />
              Calendar
            </ViewTab>
            <ViewTab active={view === "list"} onClick={() => setView("list")}>
              <List className="size-4" />
              List
            </ViewTab>
            <ViewTab active={view === "forecast"} onClick={() => setView("forecast")}>
              <TrendingUp className="size-4" />
              Forecast
            </ViewTab>
          </div>
        }
      />

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        This view is read-only. Plantings, pickings and field activities are
        recorded on the crop cycle they belong to; deliveries and pickups come
        from confirmed orders.
      </p>

      {view === "calendar" ? (
        <div className="space-y-4">
          <MonthGrid
            events={events}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay ? (
            <section className="card-surface">
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold">
                  {prettyDate(selectedDay)} · {dayEvents.length} event
                  {dayEvents.length === 1 ? "" : "s"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                  Clear
                </Button>
              </header>
              {dayEvents.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing recorded on this day.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {view === "list" ? (
        <div className="space-y-4">
          <ListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Search by crop, farmer or plot…"
          >
            <div className="w-full sm:w-52">
              <FormSelect
                value={type}
                onChange={setType}
                options={[
                  { value: "", label: "All event types" },
                  ...stringOptions([...CALENDAR_EVENT_TYPES]),
                ]}
                placeholder="All event types"
              />
            </div>
          </ListToolbar>

          <section className="overflow-hidden card-surface">
            {loading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading events…
              </p>
            ) : filteredEvents.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No events match this filter.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredEvents.map((event) => (
                  <EventRow key={event.id} event={event} showDate />
                ))}
              </ul>
            )}
            <div className="px-5 pt-2 pb-5 text-xs text-muted-foreground">
              Showing {filteredEvents.length} of {events.length}
            </div>
          </section>
        </div>
      ) : null}

      {view === "forecast" ? <SupplyForecastView /> : null}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
      aria-pressed={active}
      className={cn("gap-1.5 rounded-full px-4")}
    >
      {children}
    </Button>
  );
}

function EventRow({
  event,
  showDate = false,
}: {
  event: CalendarEvent;
  showDate?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.type} />
          <Link href={event.href} className="text-sm font-medium hover:underline">
            {event.orderCode ? `${event.orderCode} · ${event.cropName}` : event.cropName}
          </Link>
          {(event.type === "Harvest" || event.orderCode) && event.quantityKg ? (
            <span className="text-sm font-medium tabular-nums">
              {num(event.quantityKg)} kg
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {event.orderCode
            ? event.note
            : `${event.farmerName} · ${event.plotName} · ${event.cycleCode}${event.note ? ` · ${event.note}` : ""}`}
        </p>
      </div>
      {showDate ? (
        <span className="shrink-0 text-sm text-muted-foreground">
          {prettyDate(event.date)}
        </span>
      ) : null}
    </li>
  );
}
