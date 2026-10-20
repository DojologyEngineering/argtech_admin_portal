"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import {
  CAMBODIA_CENTER,
  ESRI_ATTRIBUTION,
  ESRI_WORLD_IMAGERY_URL,
} from "@/lib/geo";
import type { LatLng } from "@/lib/types";

const POLYGON_STYLE: L.PathOptions = {
  color: "#0a6b36",
  weight: 3,
  opacity: 1,
  fillColor: "#0a6b36",
  fillOpacity: 0.25,
};

function ringFromLayer(layer: L.Polygon): LatLng[] {
  const latlngs = layer.getLatLngs();
  // Leaflet nests rings; the outer ring is the first element.
  const outer = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as L.LatLng[];
  return outer.map((p) => [round6(p.lat), round6(p.lng)]);
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Wires Leaflet-Geoman's drawing toolbar to a single polygon and reports the
 * traced ring upward. Only one boundary can exist per plot, so drawing a new
 * shape replaces whatever was there before.
 */
function BoundaryEditor({
  initialBoundary,
  boundary,
  onChange,
  readOnly,
}: {
  initialBoundary: LatLng[] | null;
  boundary: LatLng[] | null;
  onChange: (ring: LatLng[] | null) => void;
  readOnly: boolean;
}) {
  const map = useMap();
  const layerRef = React.useRef<L.Polygon | null>(null);
  // Latest-callback ref, written in an effect rather than during render, so the
  // Leaflet handlers registered below always call the current onChange.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  /** Re-emits the ring whenever the shape is edited or dragged. */
  const attach = React.useCallback((layer: L.Polygon) => {
    const emit = () => onChangeRef.current(ringFromLayer(layer));
    layer.on("pm:edit", emit);
    layer.on("pm:dragend", emit);
    layer.on("pm:markerdragend", emit);
    layer.on("pm:vertexadded", emit);
    layer.on("pm:vertexremoved", emit);
  }, []);

  // Draw the existing boundary and frame it, once, on mount.
  React.useEffect(() => {
    if (!initialBoundary || initialBoundary.length < 3) return;
    const layer = L.polygon(initialBoundary, POLYGON_STYLE).addTo(map);
    layerRef.current = layer;
    attach(layer);
    map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 18 });
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, initialBoundary, attach]);

  // Toolbar and map-level draw events.
  React.useEffect(() => {
    if (readOnly) {
      map.pm.removeControls();
      return;
    }

    map.pm.setGlobalOptions({
      snappable: true,
      allowSelfIntersection: false,
      templineStyle: POLYGON_STYLE,
      hintlineStyle: { ...POLYGON_STYLE, dashArray: "6,6" },
      pathOptions: POLYGON_STYLE,
    });

    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    const handleCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      // Replace any previous boundary — a plot has exactly one.
      if (layerRef.current && layerRef.current !== layer) {
        layerRef.current.remove();
      }
      layer.setStyle(POLYGON_STYLE);
      layerRef.current = layer;
      attach(layer);
      onChangeRef.current(ringFromLayer(layer));
    };

    const handleRemove = (e: { layer: L.Layer }) => {
      if (e.layer === layerRef.current) {
        layerRef.current = null;
        onChangeRef.current(null);
      }
    };

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
      map.pm.removeControls();
    };
  }, [map, readOnly, attach]);

  // An external "Clear boundary" action must also clear the drawn layer.
  React.useEffect(() => {
    if (boundary === null && layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
  }, [boundary]);

  return null;
}

/**
 * Keeps Leaflet's size in sync when the map appears inside a dialog.
 *
 * A dialog is still animating open (and sometimes not yet laid out) when the map
 * mounts, so Leaflet measures a wrong size and paints only part of the tiles.
 * Watching the container fixes that: every size change re-measures the map and,
 * until the person starts panning or zooming, frames the polygon again with
 * padding.
 */
function ResizeHandler({ initialBoundary }: { initialBoundary: LatLng[] | null }) {
  const map = useMap();
  React.useEffect(() => {
    const container = map.getContainer();
    const bounds =
      initialBoundary && initialBoundary.length >= 3 ? L.latLngBounds(initialBoundary) : null;
    let touched = false;

    const settle = () => {
      map.invalidateSize({ pan: false });
      if (bounds && !touched) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18, animate: false });
      }
    };

    const markTouched = () => {
      touched = true;
    };
    const events = ["mousedown", "wheel", "touchstart"] as const;
    events.forEach((name) => container.addEventListener(name, markTouched, { passive: true }));

    const observer = new ResizeObserver(settle);
    observer.observe(container);
    // Covers the dialog's open animation finishing without a further size change.
    const timers = [60, 250, 500].map((ms) => window.setTimeout(settle, ms));
    window.addEventListener("resize", settle);

    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", settle);
      events.forEach((name) => container.removeEventListener(name, markTouched));
    };
  }, [map, initialBoundary]);
  return null;
}

export default function BoundaryMapInner({
  boundary,
  onChange,
  center,
  readOnly = false,
  className,
}: {
  boundary: LatLng[] | null;
  onChange: (ring: LatLng[] | null) => void;
  center?: LatLng | null;
  readOnly?: boolean;
  className?: string;
}) {
  // Captured once so re-renders driven by our own edits never redraw the layer.
  const [initialBoundary] = React.useState(() => boundary);
  const startCenter = initialBoundary?.[0] ?? center ?? CAMBODIA_CENTER;

  return (
    <MapContainer
      center={startCenter}
      zoom={initialBoundary || center ? 17 : 7}
      scrollWheelZoom
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url={ESRI_WORLD_IMAGERY_URL}
        attribution={ESRI_ATTRIBUTION}
        maxZoom={19}
      />
      <BoundaryEditor
        initialBoundary={initialBoundary}
        boundary={boundary}
        onChange={onChange}
        readOnly={readOnly}
      />
      <ResizeHandler initialBoundary={initialBoundary} />
    </MapContainer>
  );
}
