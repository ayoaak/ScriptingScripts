import { parsePlayer, PlayerData, QueryError } from "./model";
export interface ResponseLike { ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }
export type Fetcher = (url: string, options: { method: string; timeout: number; headers: Record<string, string> }) => Promise<ResponseLike>;
export function retryAt(value: string | null, now: number): number {
  if (value !== null && /^\d+(\.\d+)?$/.test(value.trim())) {
    const result = now + Number(value) * 1000;
    if (Number.isFinite(result) && result > now) return result;
  }
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) && date > now ? date : now + 60_000;
}
export function createApi(fetcher: Fetcher, now = Date.now) {
  return async (name: string): Promise<PlayerData> => {
    if (!name.trim()) throw new QueryError("input", "请输入玩家 ID");
    try {
      const response = await fetcher(`https://stats.2788.pro/api/bf1/full?name=${encodeURIComponent(name.trim())}`, { method: "GET", timeout: 20, headers: { Accept: "application/json" } });
      if (response.status === 400) throw new QueryError("input", "请检查玩家 ID");
      if (response.status === 404) throw new QueryError("notFound", "未找到该玩家，请检查 ID");
      if (response.status === 429) throw new QueryError("rateLimit", "查询过于频繁，请稍后重试", retryAt(response.headers.get("Retry-After"), now()));
      if (!response.ok) throw new QueryError("server", `查询失败（${response.status}），请稍后重试`);
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new QueryError("invalid", "返回的数据无法解析，请稍后重试"); }
      return parsePlayer(payload);
    } catch (error) {
      if (error instanceof QueryError) throw error;
      throw new QueryError("network", "暂时无法连接或请求超时，请稍后重试");
    }
  };
}
