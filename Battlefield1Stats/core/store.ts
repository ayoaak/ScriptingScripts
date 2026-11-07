import { lookupKey, number, parsePlayer, PlayerData, record, text } from "./model";
export const STORAGE_KEY = "bf1.players.v1";
export const FRESH_MS = 5 * 60_000;
export const MAX_FAVORITES = 50;
export interface Player { id: string; name: string; lookupName: string; aliases: string[]; personaId?: string; userId?: string; viewedAt: number }
export interface Cache { fetchedAt: number; accessedAt: number; payload: PlayerData }
export interface Database {
  version: 1; players: Record<string, Player>; index: Record<string, string>;
  favorites: string[]; recent: string[]; caches: Record<string, Cache>;
  lastSelected?: string; cooldownUntil: number;
}
export interface Persistence { get(): unknown; set(value: Database): boolean }
export const emptyDatabase = (): Database => ({ version: 1, players: {}, index: {}, favorites: [], recent: [], caches: {}, cooldownUntil: 0 });
export const cloneDatabase = (db: Database): Database => JSON.parse(JSON.stringify(db));
export function restore(raw: unknown): Database {
  const db = emptyDatabase();
  if (!record(raw) || raw.version !== 1 || !record(raw.players)) return db;
  for (const entry of Object.values(raw.players)) {
    if (!record(entry) || !text(entry.name) || !text(entry.lookupName)) continue;
    const personaId = typeof entry.personaId === "string" && /^\d+$/.test(entry.personaId) ? entry.personaId : undefined;
    const key = personaId ? `persona:${personaId}` : lookupKey(entry.lookupName as string);
    if (entry.id !== key) continue;
    const aliases = Array.isArray(entry.aliases) ? entry.aliases.filter((x): x is string => typeof x === "string" && x.startsWith("stats2788:bf1:")) : [];
    const player: Player = { id: key, name: text(entry.name)!, lookupName: text(entry.lookupName)!, personaId, userId: typeof entry.userId === "string" ? entry.userId : undefined, aliases: [...new Set([...aliases, lookupKey(entry.name as string), lookupKey(entry.lookupName as string)])], viewedAt: number(entry.viewedAt) ?? 0 };
    db.players[key] = player;
    for (const alias of player.aliases) db.index[alias] = key;
  }
  const ids = (v: unknown, max: number) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && Object.hasOwnProperty.call(db.players, x)))].slice(0, max) : [];
  db.favorites = ids(raw.favorites, MAX_FAVORITES); db.recent = ids(raw.recent, 20);
  if (typeof raw.lastSelected === "string" && db.players[raw.lastSelected]) db.lastSelected = raw.lastSelected;
  db.cooldownUntil = number(raw.cooldownUntil) ?? 0;
  if (record(raw.caches)) {
    for (const [key, v] of Object.entries(raw.caches)) {
      if (!db.players[key] || !record(v) || number(v.fetchedAt) === undefined) continue;
      try {
        const payload = parsePlayer(v.payload);
        const expected = payload.metadata.personaId ? `persona:${payload.metadata.personaId}` : lookupKey(payload.metadata.name);
        if (expected !== key) continue;
        db.caches[key] = { fetchedAt: v.fetchedAt as number, accessedAt: number(v.accessedAt) ?? v.fetchedAt as number, payload };
      } catch { /* Skip just the corrupt account, preserving other saved players. */ }
    }
  }
  prune(db);
  return db;
}
export function prune(db: Database) {
  const entries = Object.entries(db.caches).sort((a, b) => b[1].accessedAt - a[1].accessedAt);
  for (const [key] of entries.slice(50)) delete db.caches[key];
  const retained = new Set([...db.favorites, ...db.recent, ...Object.keys(db.caches), ...(db.lastSelected ? [db.lastSelected] : [])]);
  for (const key of Object.keys(db.players)) if (!retained.has(key)) delete db.players[key];
  for (const alias of Object.keys(db.index)) if (!db.players[db.index[alias]!]) delete db.index[alias];
}
