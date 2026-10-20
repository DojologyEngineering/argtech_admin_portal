import { cn } from "cn";
import { MapPin, Truck } from "lucide-react";
import type { DeliveryMethod, OrderType } from "@/lib/types";

const TAG =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** Order now or Request. */
export function TypeTag({ type, className }: { type: OrderType; className?: string }) {
  return (
    <span className={cn(TAG, "bg-muted text-muted-foreground", className)}>
      {type}
    </span>
  );
}

/** Delivery or Pickup. */
export function MethodTag({
  method,
  className,
}: {
  method: DeliveryMethod;
  className?: string;
}) {
  const Icon = method === "Pickup" ? MapPin : Truck;
  return (
    <span className={cn(TAG, "bg-muted text-muted-foreground", className)}>
      <Icon className="size-3" aria-hidden />
      {method}
    </span>
  );
}

/** A request for a crop that is not in the catalog. */
export function NotInCatalogTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        TAG,
        "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
        className,
      )}
    >
      Not in catalog
    </span>
  );
}

/** The small tag row shown under an order code. */
export function OrderTags({
  type,
  method,
  notInCatalog,
  className,
}: {
  type: OrderType;
  method: DeliveryMethod;
  notInCatalog?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      <TypeTag type={type} />
      <MethodTag method={method} />
      {notInCatalog ? <NotInCatalogTag /> : null}
    </span>
  );
}
