"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import {
  ArrowRight,
  CalendarDays,
  Inbox,
  Loader2,
  MapPin,
  ShoppingCart,
  Sprout,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { OrderStatusBadge } from "@/components/status-badge";
import { NotInCatalogTag, OrderTags } from "@/components/orders/order-tags";
import { HarvestChart } from "@/components/dashboard/harvest-chart";
import { Button } from "@/components/ui/button";
import { getDashboard, type DashboardData } from "@/lib/services/dashboard";
import { money, num, prettyDate } from "@/lib/format";

/** Every stat card opens the page behind it. */
function StatLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {children}
    </Link>
  );
}

const CARD_LINK =
  "h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/40";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    void getDashboard().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="space-y-6">

      {/* Five cards: 1 column on phones, 2 on tablets, 3 on small laptops and 5 from 1280 px
          the content is wide enough. The last card widens to fill the row when the
          grid would otherwise leave a gap. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-5">
        <StatLink href="/farmers">
          <StatCard
            icon={<Users />}
            value={num(stats.totalFarmers)}
            label="Total Farmers"
            className={CARD_LINK}
          />
        </StatLink>
        <StatLink href="/plots">
          <StatCard
            icon={<MapPin />}
            value={num(stats.farmPlots)}
            label="Farm Plots"
            hint={`${num(stats.totalAreaHectares, 2)} ha mapped`}
            className={CARD_LINK}
          />
        </StatLink>
        <StatLink href="/cycles">
          <StatCard
            icon={<Sprout />}
            value={num(stats.cropsInProduction)}
            label="Crops in production"
            hint={`${num(stats.openCycles)} open cycle${stats.openCycles === 1 ? "" : "s"}`}
            className={CARD_LINK}
          />
        </StatLink>
        <StatLink href="/requests">
          <StatCard
            icon={<Inbox />}
            value={num(stats.requestsWaiting)}
            label="Requests waiting"
            hint="Needs your reply"
            className={CARD_LINK}
          />
        </StatLink>
        <StatLink href="/orders" className="sm:max-xl:col-span-2">
          <StatCard
            icon={<ShoppingCart />}
            value={num(stats.purchaseOrders)}
            label="Purchase Orders"
            hint={`${stats.ordersInProgress} in progress`}
            className={CARD_LINK}
          />
        </StatLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 [&>section]:h-full">
          <HarvestChart data={data.harvest} trend={data.harvestTrendPct} />
        </div>

        <section className="card-surface">
          <header className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Upcoming Harvests</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Overdue first, then the next 30 days
            </p>
          </header>

          {data.upcoming.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing is due to be harvested in the next 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((item) => (
                <li key={item.cycleId}>
                  <Link
                    href={`/cycles/${item.cycleId}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-hover-tint"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                        <CalendarDays className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.cropName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {prettyDate(item.expectedHarvestDate)} · {item.farmerName}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {num(item.expectedOutputKg)} kg
                      </p>
                      {item.overdue ? (
                        <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs">
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                            Overdue
                          </span>
                          <span className="text-muted-foreground">
                            {Math.abs(item.daysAway)} day{Math.abs(item.daysAway) === 1 ? "" : "s"} late
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{item.province}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border px-5 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/calendar")}
              className="w-full justify-between"
            >
              View full calendar
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden card-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">Recent Purchase Orders</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Latest confirmed orders
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/orders")}>
            View All Orders
          </Button>
        </header>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Order ID", "Crop", "Quantity", "Buyer", "Date", "Total", "Status"].map(
                  (h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-5 py-4 text-xs font-medium text-muted-foreground ${
                        i === 2 || i === 5 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  // Tab to a row, Enter or Space opens the order.
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/orders/${order.id}`);
                    }
                  }}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <td className="min-w-[13rem] px-5 py-4">
                    <span className="font-medium">{order.code}</span>
                    <OrderTags
                      type={order.type}
                      method={order.method}
                      className="mt-1 font-normal"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {order.cropSummary}
                      {order.notInCatalog ? <NotInCatalogTag /> : null}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {num(order.quantityKg)} kg
                  </td>
                  <td className="px-5 py-4">{order.buyerName}</td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {prettyDate(order.date)}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums">
                    {order.totalPrice === null ? "—" : money(order.totalPrice)}
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusBadge status={order.status} method={order.method} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border xl:hidden">
          {data.recentOrders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex flex-col gap-2 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{order.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.buyerName} · {order.cropSummary}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} method={order.method} />
                </div>
                <OrderTags type={order.type} method={order.method} notInCatalog={order.notInCatalog} />
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums">{num(order.quantityKg)} kg</span>
                  <span className="font-medium tabular-nums">
                    {order.totalPrice === null ? "—" : money(order.totalPrice)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
