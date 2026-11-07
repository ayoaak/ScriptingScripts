export const CARD_NAME_SIZE = 17 * 1.3;
export const CARD_RANK_SIZE = 12 * 1.3;

/** Expanded cards stay in real layout flow so native ScrollView measures all rows. */
export function presentedCards(ids: string[], focusedId: string | undefined, expanded: boolean): string[] {
  if (expanded) return ids.slice();
  const first = ids.includes(focusedId ?? "") ? focusedId! : ids[0];
  return first ? [first, ...ids.filter(id => id !== first).slice(0, 2)] : [];
}
export function cardAppearance(slot: number, expanded: boolean, id: string, focusedId?: string, enteringId?: string) {
  const chosen = enteringId === id;
  return {
    x: chosen || slot === 0 ? 0 : (slot % 2 ? 1 : -1) * (expanded ? 6 : 10),
    rotation: chosen || slot === 0 ? 0 : (slot % 2 ? 1 : -1) * (expanded ? 1 : 4),
    scale: chosen || id === focusedId ? 1 : expanded ? 0.98 : 1 - slot * 0.045,
    opacity: enteringId && !chosen ? 0 : expanded ? 1 : 1 - slot * 0.14,
    z: chosen ? 100 : id === focusedId ? 10 : 5 - (slot % 3),
  };
}
