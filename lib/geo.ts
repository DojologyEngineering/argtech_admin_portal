/**
 * Geometry helpers for the plot boundary tool.
 *
 * Turf works in GeoJSON order ([lng, lat]); Leaflet works in [lat, lng]. The
 * conversion lives here so no component has to think about it.
 */

import turfArea from "@turf/area";
import turfCentroid from "@turf/centroid";
import { polygon as turfPolygon } from "@turf/helpers";
import type { LatLng } from "./types";

const SQM_PER_HECTARE = 10_000;

/** Closes the ring and flips to [lng, lat] for Turf. */
function toGeoJsonRing(ring: LatLng[]): number[][] {
  const coords = ring.map(([lat, lng]) => [lng, lat]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    coords.push([...first]);
  }
  return coords;
}

/** Area of a traced boundary in hectares. Returns 0 for a degenerate ring. */
export function polygonAreaHectares(ring: LatLng[] | null | undefined): number {
  if (!ring || ring.length < 3) return 0;
  try {
    const feature = turfPolygon([toGeoJsonRing(ring)]);
    return round3(turfArea(feature) / SQM_PER_HECTARE);
  } catch {
    return 0;
  }
}

export function polygonAreaSqm(ring: LatLng[] | null | undefined): number {
  return Math.round(polygonAreaHectares(ring) * SQM_PER_HECTARE);
}

/** Centre of a traced boundary, used to fill in the plot's GPS coordinate. */
export function polygonCentroid(ring: LatLng[] | null | undefined): LatLng | null {
  if (!ring || ring.length < 3) return null;
  try {
    const feature = turfPolygon([toGeoJsonRing(ring)]);
    const [lng, lat] = turfCentroid(feature).geometry.coordinates;
    return [round6(lat), round6(lng)];
  } catch {
    return null;
  }
}

/** Manual fallback: a length x width rectangle in metres, expressed in hectares. */
export function rectangleAreaHectares(
  lengthM: number | null,
  widthM: number | null,
): number {
  if (!lengthM || !widthM || lengthM <= 0 || widthM <= 0) return 0;
  return round3((lengthM * widthM) / SQM_PER_HECTARE);
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/** Roughly the middle of Cambodia — where the tracing map opens by default. */
export const CAMBODIA_CENTER: LatLng = [12.5657, 104.991];

export const ESRI_WORLD_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
