export interface DeckLayer {
  id: string; index: number; x: number; y: number; rotation: number; scale: number; opacity: number; z: number;
}
export const CARD_NAME_SIZE = 17 * 1.3;
export const CARD_RANK_SIZE = 12 * 1.3;

export function boundedPosition(value: number, count: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(Math.max(0, count - 1), value)) : 0;
}

/** An expanded deck scrolls continuously, including the first and last of 50 players. */
export function draggedPosition(origin: number, x: number, y: number, step: number, count: number): number {
  if (![x, y, step].every(Number.isFinite) || step <= 0 || Math.abs(x) >= Math.abs(y)) return boundedPosition(origin, count);
  return boundedPosition(origin - y / step, count);
}
export function releasedPosition(position: number, velocity: number, step: number, count: number): number {
  const projected = Number.isFinite(velocity) && step > 0 ? position - Math.max(-2, Math.min(2, velocity * 0.16 / step)) : position;
  return Math.round(boundedPosition(projected, count));
}

/** Stable real cards: fan out from a rotated stack, then move the chosen card to y=0. */
export function deckLayers(ids: string[], position: number, expansion: number, step: number, enteringId?: string): DeckLayer[] {
  const center = boundedPosition(position, ids.length);
  const expanded = Number.isFinite(expansion) ? Math.max(0, Math.min(1, expansion)) : 0;
  const spacing = Number.isFinite(step) && step > 0 ? step : 220;
  const nearest = Math.round(center);
  const selected = enteringId ? ids.indexOf(enteringId) : -1;
  return ids.map((id, index) => {
    const slot = index - center, depth = Math.abs(slot), side = slot < 0 ? -1 : 1;
    const away = Math.min(1, depth);
    const visible = Math.abs(index - nearest) <= 2 || index === selected;
    const rotation = away * side * (index % 2 ? 4 : -4);
    return {
      id, index,
      x: away * ((1 - expanded) * side * (index % 2 ? 10 : -10) + expanded * (index % 2 ? 22 : -22)),
      y: slot * (48 + expanded * (spacing - 48)),
      rotation: rotation * (1 - expanded * 0.6),
      scale: Math.max(0.8, 1 - Math.min(2, depth) * (0.045 + expanded * 0.005)),
      opacity: !visible || (enteringId && index !== selected) ? 0 : Math.max(0.55, 1 - depth * 0.14),
      z: index === selected ? 100 : 10 - depth,
    };
  }).filter(layer => Math.abs(layer.index - nearest) <= 2 || layer.index === selected);
}
