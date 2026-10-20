/**
 * Pickup points: public meeting points where buyers collect pickup orders.
 *
 * A point is never a farm. Points are deactivated rather than deleted, so the
 * orders that used them keep their history.
 */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { PICKUP_DISTRICTS, type ID, type PickupPoint } from "../types";

export type PickupPointInput = Omit<PickupPoint, "id">;

export interface PickupPointView extends PickupPoint {
  /** Orders (any status) arranged at this point. */
  orderCount: number;
}

export async function listPickupPoints(): Promise<PickupPointView[]> {
  const db = getDb();
  return delay(
    db.pickupPoints
      .map((p) => ({
        ...p,
        orderCount: db.orders.filter((o) => o.pickup?.pointId === p.id).length,
      }))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
  );
}

function validate(input: PickupPointInput): PickupPointInput {
  const name = input.name.trim();
  if (!name) throw new Error("A pickup point needs a name.");
  if (!(PICKUP_DISTRICTS as readonly string[]).includes(input.district)) {
    throw new Error("Choose Kang Meas, Srey Santhor or Kampong Siem.");
  }
  const mapUrl = input.mapUrl.trim();
  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
    throw new Error("The map link must start with http:// or https://.");
  }
  return { ...input, name, landmark: input.landmark.trim(), mapUrl };
}

export async function createPickupPoint(input: PickupPointInput): Promise<PickupPoint> {
  const data = validate(input);
  return commit((db) => {
    const point: PickupPoint = { ...data, id: newId("pickup") };
    db.pickupPoints.push(point);
    return { ...point };
  });
}

export async function updatePickupPoint(
  id: ID,
  input: PickupPointInput,
): Promise<PickupPoint> {
  const data = validate(input);
  return commit((db) => {
    const point = db.pickupPoints.find((p) => p.id === id);
    if (!point) throw new NotFoundError("Pickup point", id);
    Object.assign(point, data);
    return { ...point };
  });
}

export async function setPickupPointActive(id: ID, active: boolean): Promise<PickupPoint> {
  return commit((db) => {
    const point = db.pickupPoints.find((p) => p.id === id);
    if (!point) throw new NotFoundError("Pickup point", id);
    point.active = active;
    return { ...point };
  });
}
