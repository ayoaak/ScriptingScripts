export const STAT_KEYS = ["rank", "timePlayed", "kills", "deaths", "wins", "losses", "headshots", "shots", "hits", "highestKillStreak", "longestHeadShot", "skill", "assists", "dogtagTaken", "repairs", "heals", "revives"] as const;
export type StatKey = typeof STAT_KEYS[number];
export type Stats = Partial<Record<StatKey, number>>;
export interface Equipment {
  type: string; name: string; category?: string; kills?: number; time?: number;
  headshots?: number; shots?: number; hits?: number; destroyed?: number;
}
export interface Report { time?: number; map?: string; mode?: string; serverName?: string; stats: Stats; weapons: Equipment[] }
export interface CaseInfo { status?: string; caseUrl?: string; banned?: boolean }
export interface Platoon { name?: string; tag?: string; active?: boolean }
export interface PlayerData {
  metadata: { name: string; personaId?: string; userId?: string; formerNames: { name: string; time?: number }[]; bfeac?: CaseInfo; bfban?: CaseInfo };
  stats: Stats; weapons: Equipment[]; reports: Report[]; platoons: Platoon[];
}
export type ErrorKind = "input" | "notFound" | "rateLimit" | "network" | "invalid" | "server";
export class QueryError extends Error {
  constructor(public kind: ErrorKind, message: string, public retryAt?: number) { super(message); this.name = "QueryError"; }
}
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const text = (v: unknown): string | undefined => typeof v === "string" && v.trim() ? v.trim() : undefined;
export const number = (v: unknown): number | undefined => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
const id = (v: unknown) => typeof v === "string" && /^\d+$/.test(v) ? v : typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? String(v) : undefined;
const array = (v: unknown): unknown[] => {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new QueryError("invalid", "返回的数据格式异常，请稍后重试");
  return v;
};
const stats = (v: unknown): Stats => {
  const result: Stats = {};
  if (record(v)) for (const key of STAT_KEYS) { const n = number(v[key]); if (n !== undefined) result[key] = n; }
  return result;
};
const equipment = (v: unknown): Equipment[] => array(v).flatMap(item => {
  if (!record(item) || !text(item.name) || !text(item.type)) return [];
  const result: Equipment = { name: text(item.name)!, type: text(item.type)!, category: text(item.category) };
  for (const key of ["kills", "time", "headshots", "shots", "hits", "destroyed"] as const) result[key] = number(item[key]);
  return [result];
});
function caseInfo(v: unknown): CaseInfo | undefined {
  if (!record(v)) return undefined;
  const url = text(v.caseUrl);
  return { status: text(v.status), caseUrl: url && /^https:\/\//i.test(url) ? url : undefined, banned: typeof v.banned === "boolean" ? v.banned : undefined };
}
export function parsePlayer(v: unknown): PlayerData {
  if (!record(v) || !record(v.metadata) || !text(v.metadata.name) || !record(v.stats)) throw new QueryError("invalid", "返回的数据格式异常，请稍后重试");
  const total = stats(v.stats);
  if (!Object.keys(total).length) throw new QueryError("invalid", "暂未返回可用的战绩统计");
  return {
    metadata: {
      name: text(v.metadata.name)!, personaId: id(v.metadata.personaId), userId: id(v.metadata.userId),
      bfeac: caseInfo(v.metadata.bfeac), bfban: caseInfo(v.metadata.bfban),
      formerNames: array(v.metadata.formerNames).flatMap(x => record(x) && text(x.name) ? [{ name: text(x.name)!, time: number(x.time) }] : []),
    }, stats: total, weapons: equipment(v.weapons),
    reports: array(v.reports).flatMap(x => !record(x) ? [] : [{ time: number(x.time), map: text(x.map), mode: text(x.mode), serverName: text(x.serverName), stats: stats(x.stats), weapons: equipment(x.weapons) }]),
    platoons: array(v.platoons).flatMap(x => !record(x) ? [] : [{ name: text(x.name), tag: text(x.tag), active: typeof x.active === "boolean" ? x.active : undefined }]),
  };
}
export const lookupKey = (name: string) => `stats2788:bf1:${name.trim().toLowerCase()}`;
export const divide = (a?: number, b?: number) => a !== undefined && b !== undefined && b > 0 ? a / b : undefined;
export const decimal = (n: number | undefined, digits = 2) => n !== undefined && Number.isFinite(n) ? n.toFixed(digits) : "—";
export const integer = (n?: number) => n === undefined ? "—" : Math.round(n).toLocaleString();
export const percent = (a?: number, b?: number) => { const n = divide(a, b); return n === undefined ? "—" : `${(n * 100).toFixed(1)}%`; };
export const duration = (seconds?: number) => seconds === undefined ? "—" : seconds >= 3600 ? `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟` : `${Math.floor(seconds / 60)} 分 ${Math.floor(seconds % 60)} 秒`;
export const dateTime = (ms?: number) => ms === undefined || !Number.isFinite(new Date(ms).getTime()) ? "—" : new Date(ms).toLocaleString();
