import { moveCard } from "./ranks";

export interface DeckLayer {
  id: string; slot: number; y: number; scale: number; opacity: number; z: number;
}
export const CARD_STEP = 16;
export const CARD_SCALE_STEP = 0.045;
export const CARD_NAME_SIZE = 17 * 1.3;
export const CARD_RANK_SIZE = 12 * 1.3;

/** A bounded window of real players with stable IDs, not decorative back plates. */
export function deckLayers(ids: string[], index: number, drag: number, travel: number): DeckLayer[] {
  if (!ids.length) return [];
  const safeTravel = Number.isFinite(travel) && travel > 0 ? travel : 360;
  const y = Number.isFinite(drag) ? Math.max(-safeTravel, Math.min(safeTravel, drag)) : 0;
  const p = ids.length > 1 ? Math.min(1, Math.abs(y) / safeTravel) : 0;
  const direction = y > 0 ? -1 : 1;
  const slots = ids.length === 1 ? [0] : ids.length === 2 ? [0, direction] : ids.length === 3 ? [-1, 0, 1] : [-1, 0, 1, 2];
  return slots.map(slot => {
    const id = ids[moveCard(index, ids.length, slot)]!;
    if (slot === 0) return { id, slot, y: ids.length > 1 ? y : 0, scale: 1 - 0.06 * p, opacity: 1 - p, z: 10 };
    const promoting = slot === direction;
    const depth = Math.abs(slot) + (promoting || (direction === 1 && slot > 1) ? -p : p);
    return {
      id, slot, y: depth === 0 ? 0 : Math.sign(slot) * depth * CARD_STEP,
      scale: 1 - CARD_SCALE_STEP * depth,
      opacity: slot === -direction ? 1 - p : 1,
      z: promoting ? 9 : 5 - Math.abs(slot),
    };
  });
}

/** Finger movement is immediate; spring interpolation happens only on release. */
export function trackedDrag(x: number, y: number, travel: number): number {
  if (![x, y, travel].every(Number.isFinite) || travel <= 0 || Math.abs(x) >= Math.abs(y)) return 0;
  return Math.max(-travel * 0.9, Math.min(travel * 0.9, y));
}
