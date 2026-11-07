import { lookupKey, PlayerData, QueryError } from "./model";
import { Cache, cloneDatabase, Database, emptyDatabase, FRESH_MS, MAX_FAVORITES, Persistence, Player, prune, restore } from "./store";
type Task = { key: string; name: string; lookup: string; promise: Promise<void>; resolve(): void };
export interface ViewState { db: Database; player?: Player; cache?: Cache; queryName: string; loading: boolean; error?: string; cooldownUntil: number; storageError?: string }
export class PlayerController {
  private db: Database;
  private selected?: { lookup: string; name: string };
  private errors = new Map<string, string>();
  private inputError?: string;
  private storageError?: string;
  private running?: Task;
  private pending?: Task;
  private listeners = new Set<() => void>();
  private disposed = false;
  constructor(private api: (name: string) => Promise<PlayerData>, private storage: Persistence, private now = Date.now) {
    try { this.db = restore(storage.get()); } catch { this.db = emptyDatabase(); this.storageError = "无法读取本地数据，本次仍可查询"; }
    const player = this.db.lastSelected ? this.db.players[this.db.lastSelected] : undefined;
    if (player) this.selected = { lookup: lookupKey(player.lookupName), name: player.lookupName };
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { if (!this.disposed) for (const listener of this.listeners) listener(); }
  private save() {
    prune(this.db);
    try { this.storageError = this.storage.set(cloneDatabase(this.db)) ? undefined : "本地保存失败，关闭后可能无法恢复；请重试保存"; }
    catch { this.storageError = "本地保存失败，关闭后可能无法恢复；请重试保存"; }
  }
  retrySave() { this.save(); this.emit(); }
  private key(lookup: string) { return this.db.index[lookup] ?? lookup; }
  get view(): ViewState {
    const lookup = this.selected?.lookup;
    const key = lookup ? this.key(lookup) : undefined;
    return { db: this.db, player: key ? this.db.players[key] : undefined, cache: key ? this.db.caches[key] : undefined, queryName: this.selected?.name ?? "", loading: !!key && (this.running?.key === key || this.pending?.key === key), error: this.inputError ?? (lookup ? this.errors.get(lookup) ?? (key ? this.errors.get(key) : undefined) : undefined), cooldownUntil: this.db.cooldownUntil, storageError: this.storageError };
  }
  private remember(player: Player) {
    this.db.lastSelected = player.id; player.viewedAt = this.now();
    this.db.recent = [player.id, ...this.db.recent.filter(id => id !== player.id)].slice(0, 20);
  }
  query(input: string, force = false): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const name = input.trim();
    if (!name) { this.inputError = "请输入玩家 ID"; this.emit(); return Promise.resolve(); }
    this.inputError = undefined;
    const lookup = lookupKey(name); const key = this.key(lookup);
    this.selected = { lookup, name }; this.errors.delete(lookup); this.errors.delete(key);
    const cache = this.db.caches[key]; const player = this.db.players[key];
    if (cache && player) { cache.accessedAt = this.now(); this.remember(player); this.save(); }
    // Selecting a new account invalidates any queued account that is no longer wanted.
    if (this.pending && this.pending.key !== key) { this.pending.resolve(); this.pending = undefined; }
    if (this.running?.key === key) { this.emit(); return this.running.promise; }
    if (this.pending?.key === key) { this.emit(); return this.pending.promise; }
    if (!force && cache && this.now() >= cache.fetchedAt && this.now() - cache.fetchedAt < FRESH_MS) { this.emit(); return Promise.resolve(); }
    if (this.db.cooldownUntil > this.now()) { this.errors.set(lookup, "查询过于频繁，请等待冷却后重试"); this.emit(); return Promise.resolve(); }
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    const task: Task = { key, lookup, name, promise, resolve };
    if (this.running) this.pending = task; else { this.running = task; void this.run(task); }
    this.emit(); return promise;
  }
  refresh() { return this.query(this.selected?.name ?? "", true); }
  restoreSelection() { return this.selected ? this.query(this.selected.name) : Promise.resolve(); }
  private async run(task: Task) {
    try {
      const payload = await this.api(task.name);
      if (this.disposed) return;
      const stamp = this.now();
      const id = payload.metadata.personaId ? `persona:${payload.metadata.personaId}` : lookupKey(payload.metadata.name);
      const oldId = this.db.index[task.lookup];
      const existing = this.db.players[id];
      // Merge aliases only with identity evidence. A reused name with a different persona
      // is detached from the old account rather than merging two different players.
      const previous = oldId ? this.db.players[oldId] : undefined;
      const canMerge = previous && oldId !== id && !previous.personaId && !!payload.metadata.personaId;
      const aliases = new Set([...(existing?.aliases ?? []), ...(canMerge ? previous.aliases : []), task.lookup, lookupKey(payload.metadata.name)]);
      const player: Player = { id, name: payload.metadata.name, lookupName: payload.metadata.name, aliases: [...aliases], personaId: payload.metadata.personaId, userId: payload.metadata.userId, viewedAt: stamp };
      if (canMerge && oldId) {
        this.db.favorites = [...new Set(this.db.favorites.map(x => x === oldId ? id : x))];
        this.db.recent = [...new Set(this.db.recent.map(x => x === oldId ? id : x))];
        if (this.db.lastSelected === oldId) this.db.lastSelected = id;
        delete this.db.players[oldId]; delete this.db.caches[oldId];
      }
      for (const alias of aliases) {
        const owner = this.db.index[alias];
        if (owner && owner !== id && this.db.players[owner]) this.db.players[owner]!.aliases = this.db.players[owner]!.aliases.filter(x => x !== alias);
        this.db.index[alias] = id;
      }
      this.db.players[id] = player;
      this.db.caches[id] = { fetchedAt: stamp, accessedAt: stamp, payload };
      this.errors.delete(task.lookup);
      this.errors.delete(task.key); this.errors.delete(id);
      for (const alias of aliases) this.errors.delete(alias);
      if (this.selected?.lookup === task.lookup) this.remember(player);
      this.save();
    } catch (error) {
      if (!this.disposed) {
        const problem = error instanceof QueryError ? error : new QueryError("network", "暂时无法连接，请稍后重试");
        this.errors.set(task.lookup, problem.message);
        this.errors.set(task.key, problem.message);
        if (problem.kind === "rateLimit") { this.db.cooldownUntil = problem.retryAt ?? this.now() + 60_000; this.save(); }
      }
    } finally {
      task.resolve(); this.running = undefined;
      const next = this.pending; this.pending = undefined;
      if (next && !this.disposed) {
        if (this.db.cooldownUntil > this.now()) { this.errors.set(next.lookup, "查询过于频繁，请等待冷却后重试"); next.resolve(); }
        else { next.key = this.key(next.lookup); this.running = next; void this.run(next); }
      }
      this.emit();
    }
  }
  toggleFavorite(): string | undefined {
    const player = this.view.player;
    if (!player) return "请先成功查询玩家";
    if (this.db.favorites.includes(player.id)) this.db.favorites = this.db.favorites.filter(x => x !== player.id);
    else {
      if (this.db.favorites.length >= MAX_FAVORITES) return "最多收藏 50 位玩家，请先移除已有收藏";
      this.db.favorites.unshift(player.id);
    }
    this.save(); this.emit(); return undefined;
  }
  removeFavorite(id: string) { this.db.favorites = this.db.favorites.filter(x => x !== id); this.save(); this.emit(); }
  removeRecent(id: string) { this.db.recent = this.db.recent.filter(x => x !== id); this.save(); this.emit(); }
  dispose() { this.disposed = true; this.pending?.resolve(); this.pending = undefined; this.listeners.clear(); }
}
