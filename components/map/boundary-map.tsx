"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { LatLng } from "@/lib/types";

/**
 * Leaflet touches `window` at import time, so the map is loaded only in the
 * browser. Everything above this boundary stays server-renderable.
 */
const BoundaryMapInner = dynamic(() => import("./boundary-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading satellite imagery…
    </div>
  ),
});

export function BoundaryMap(props: {
  boundary: LatLng[] | null;
  onChange: (ring: LatLng[] | null) => void;
  center?: LatLng | null;
  readOnly?: boolean;
  className?: string;
}) {
  return <BoundaryMapInner {...props} />;
}
