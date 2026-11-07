const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApi, retryAt } = require('../.build/core/api.js');
const { parsePlayer, QueryError, divide, lookupKey } = require('../.build/core/model.js');
const { PlayerController } = require('../.build/core/controller.js');
const { restore, FRESH_MS } = require('../.build/core/store.js');
const { RANK_BANDS, getRank, moveCard, swipeDirection } = require('../.build/core/ranks.js');
const { deckLayers, trackedDrag, CARD_NAME_SIZE, CARD_RANK_SIZE } = require('../.build/core/deck.js');

// These are intentionally synthetic accounts, never sent to a live API.
const payload = (name = 'PlayerA', id = '100', kills = 10) => parsePlayer({
  metadata: { name, personaId: id }, stats: { kills, deaths: 5, timePlayed: 120, wins: 1, losses: 1 },
  weapons: [{ type: 'VEHICLE', name: 'Tank', kills: 3, destroyed: 1 }], reports: [], platoons: [],
});
const memory = () => ({ value: null, get() { return this.value; }, set(v) { this.value = structuredClone(v); return true; } });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (status, json = {}, header = null) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => header }, json: async () => json });

test('encodes the trimmed ID and uses Scripting timeout in seconds', async () => {
  let request;
  const api = createApi(async (url, options) => { request = { url, options }; return response(200, payload()); });
  await api(' Player&A /雪 ');
  assert.match(request.url, /name=Player%26A%20%2F%E9%9B%AA$/);
  assert.equal(request.options.timeout, 20);
  assert.equal(request.options.headers.Authorization, undefined);
});

test('404/400/429/503 do not assume the body is JSON', async () => {
  for (const [status, kind] of [[400, 'input'], [404, 'notFound'], [429, 'rateLimit'], [503, 'server']]) {
    const r = response(status); r.json = () => { throw Error('must not parse error body'); };
    await assert.rejects(createApi(async () => r)('x'), e => e.kind === kind);
  }
});

test('invalid JSON and malformed payload are distinct from network failures', async () => {
  const r = response(200); r.json = async () => { throw Error('invalid JSON'); };
  await assert.rejects(createApi(async () => r)('x'), e => e.kind === 'invalid');
  await assert.rejects(createApi(async () => response(200, { stats: {} }))('x'), e => e.kind === 'invalid');
  await assert.rejects(createApi(async () => { throw Error('timeout'); })('x'), e => e.kind === 'network');
});

test('partial fields stay unknown, zero denominators never invent a ratio', () => {
  const p = parsePlayer({ metadata: { name: 'x', bfeac: null }, stats: { kills: 0, deaths: 0, hits: 'bad', rank: -1 } });
  assert.equal(p.stats.hits, undefined); assert.equal(p.stats.rank, undefined);
  assert.equal(divide(0, 0), undefined); assert.equal(divide(undefined, 2), undefined);
  assert.deepEqual(p.weapons, []); assert.equal(p.metadata.bfeac, undefined);
  assert.equal(p.metadata.personaId, undefined);
  assert.throws(() => parsePlayer({ metadata: { name: 'x' }, stats: { kills: 1 }, reports: {} }), e => e.kind === 'invalid');
});

test('Retry-After supports seconds, HTTP dates and a 60-second fallback', () => {
  const now = 1794055000000;
  assert.equal(retryAt('120', now), now + 120000);
  assert.equal(retryAt(new Date(now + 240000).toUTCString(), now), now + 240000);
  for (const value of [null, '', 'nonsense', '-2', '0', new Date(now - 1000).toUTCString()]) assert.equal(retryAt(value, now), now + 60000);
});

test('case and whitespace dedup, cache reuse, and manual refresh', async () => {
  let calls = 0;
  const store = memory(); const c = new PlayerController(async () => { calls++; return payload(); }, store, () => 1000);
  await c.query(' playera '); await c.query('PLAYERA');
  assert.equal(calls, 1); assert.equal(c.view.db.recent.length, 1);
  await c.refresh(); assert.equal(calls, 2);
  assert.equal(c.view.player.name, 'PlayerA'); assert.equal(c.view.cache.fetchedAt, 1000);
});

test('switching from A to B hides A immediately and ignores late A for selection', async () => {
  const a = deferred(), b = deferred();
  const calls = []; const c = new PlayerController(name => { calls.push(name); return name === 'A' ? a.promise : b.promise; }, memory());
  const qa = c.query('A'), qb = c.query('B');
  assert.equal(c.view.queryName, 'B'); assert.equal(c.view.cache, undefined); assert.equal(c.view.loading, true);
  assert.deepEqual(calls, ['A']);
  a.resolve(payload('A', '100', 100)); await qa;
  assert.equal(c.view.queryName, 'B'); assert.equal(c.view.cache, undefined);
  assert.deepEqual(calls, ['A', 'B']);
  b.resolve(payload('B', '200', 200)); await qb;
  assert.equal(c.view.cache.payload.stats.kills, 200); assert.equal(c.view.db.lastSelected, 'persona:200');
  assert.equal(c.view.db.caches['persona:100'].payload.stats.kills, 100);
});

test('only the latest waiting account is sent and in-flight refresh is deduplicated', async () => {
  const a = deferred(); const calls = [];
  const c = new PlayerController(async name => { calls.push(name); return name === 'A' ? a.promise : payload(name, '300'); }, memory());
  const qa = c.query('A'); const same = c.refresh(); assert.equal(qa, same);
  const qb = c.query('B'); const qc = c.query('C'); await qb;
  a.resolve(payload('A')); await qa; await qc;
  assert.deepEqual(calls, ['A', 'C']); assert.equal(c.view.player.name, 'C');
});

test('returning to the running account discards an unrelated queued query', async () => {
  const a = deferred(); const calls = [];
  const c = new PlayerController(name => { calls.push(name); return a.promise; }, memory());
  const qa = c.query('A'); const qb = c.query('B'); const again = c.query('a');
  await qb; a.resolve(payload('A')); await qa; await again;
  assert.deepEqual(calls, ['A']); assert.equal(c.view.player.name, 'A');
});

test('stale cache is visible during refresh and failure keeps its timestamp', async () => {
  let now = 1000, pending;
  const c = new PlayerController(async () => pending ? pending.promise : payload(), memory(), () => now);
  await c.query('PlayerA'); now += FRESH_MS + 1; pending = deferred();
  const query = c.query('PlayerA'); assert.equal(c.view.loading, true); assert.equal(c.view.cache.fetchedAt, 1000);
  pending.reject(new QueryError('network', 'offline')); await query;
  assert.equal(c.view.cache.fetchedAt, 1000); assert.equal(c.view.error, 'offline'); assert.equal(c.view.loading, false);
});

test('404 and blank searches do not create saved accounts or history', async () => {
  let calls = 0;
  const c = new PlayerController(async () => { calls++; throw new QueryError('notFound', 'missing'); }, memory());
  await c.query(' '); assert.equal(calls, 0); assert.match(c.view.error, /请输入/);
  await c.query('NoPlayer'); assert.equal(calls, 1); assert.deepEqual(c.view.db.recent, []); assert.deepEqual(c.view.db.players, {});
});

test('favorite and history removals are independent and survive reopening', async () => {
  const store = memory(); const c = new PlayerController(async () => payload(), store);
  await c.query('PlayerA'); assert.equal(c.toggleFavorite(), undefined);
  c.removeRecent('persona:100'); assert.deepEqual(c.view.db.favorites, ['persona:100']);
  const restored = new PlayerController(async () => { throw Error('should use cache'); }, store);
  assert.equal(restored.view.player.name, 'PlayerA'); assert.equal(restored.view.cache.payload.stats.kills, 10);
  await restored.restoreSelection(); restored.removeFavorite('persona:100');
  assert.deepEqual(restored.view.db.recent, ['persona:100']); assert.equal(restored.view.db.favorites.length, 0);
});

test('renamed players with equal persona ID merge favorites, history and aliases', async () => {
  const store = memory(); const c = new PlayerController(async name => payload(name, '123'), store);
  await c.query('OldName'); c.toggleFavorite(); await c.query('NewName');
  assert.deepEqual(Object.keys(c.view.db.players), ['persona:123']);
  assert.deepEqual(c.view.db.recent, ['persona:123']); assert.deepEqual(c.view.db.favorites, ['persona:123']);
  assert.equal(c.view.db.index[lookupKey('OldName')], 'persona:123'); assert.equal(c.view.player.name, 'NewName');
  const reopened = new PlayerController(async () => payload(), store);
  assert.equal(reopened.view.player.name, 'NewName');
});

test('an account gaining a persona ID preserves its existing favorite', async () => {
  // Explicitly omit ID: payload's default parameter would otherwise assign one.
  const first = payload(); delete first.metadata.personaId;
  let call = 0; const d = new PlayerController(async () => ++call === 1 ? first : payload(), memory());
  await d.query('PlayerA'); d.toggleFavorite(); await d.refresh();
  assert.deepEqual(d.view.db.favorites, ['persona:100']); assert.equal(Object.keys(d.view.db.players).length, 1);
});

test('an in-flight failure follows a known player across name aliases', async () => {
  let pending;
  const c = new PlayerController(async name => pending ? pending.promise : payload(name, '123'), memory());
  await c.query('OldName'); await c.query('NewName');
  pending = deferred(); const request = c.query('OldName', true); const switched = c.query('NewName');
  pending.reject(new QueryError('network', 'offline')); await request; await switched;
  assert.equal(c.view.player.name, 'NewName'); assert.equal(c.view.error, 'offline');
  assert.ok(c.view.cache); assert.equal(c.view.loading, false);
});

test('global rate-limit cooldown cancels pending network work and survives reopening', async () => {
  let now = 1000; const a = deferred(); const calls = []; const store = memory();
  const c = new PlayerController(name => { calls.push(name); return a.promise; }, store, () => now);
  const qa = c.query('A'); const qb = c.query('B');
  a.reject(new QueryError('rateLimit', 'limited', 121000)); await qa; await qb;
  assert.deepEqual(calls, ['A']); assert.equal(c.view.cooldownUntil, 121000);
  const reopened = new PlayerController(async name => { calls.push(name); return payload(name); }, store, () => now);
  await reopened.query('C'); assert.deepEqual(calls, ['A']);
  now = 121001; await reopened.query('C'); assert.deepEqual(calls, ['A', 'C']);
});

test('a 404 refresh preserves existing favorites and last successful data', async () => {
  let fails = false;
  const c = new PlayerController(async () => { if (fails) throw new QueryError('notFound', 'missing'); return payload(); }, memory());
  await c.query('PlayerA'); c.toggleFavorite(); const stamp = c.view.cache.fetchedAt;
  fails = true; await c.refresh();
  assert.deepEqual(c.view.db.favorites, ['persona:100']); assert.equal(c.view.cache.fetchedAt, stamp); assert.equal(c.view.error, 'missing');
});

test('restoration skips a corrupt cache without deleting unrelated accounts', async () => {
  const store = memory(); const c = new PlayerController(async name => payload(name, name === 'A' ? '1' : '2'), store);
  await c.query('A'); c.toggleFavorite(); await c.query('B');
  store.value.caches['persona:1'].payload = { broken: true };
  const restored = restore(store.value);
  assert.ok(restored.players['persona:1']); assert.equal(restored.caches['persona:1'], undefined);
  assert.equal(restored.caches['persona:2'].payload.metadata.name, 'B'); assert.deepEqual(restored.favorites, ['persona:1']);
  assert.deepEqual(restore({ version: 999 }), restore(null));
});

test('cache LRU and history are bounded while favorited players are retained', async () => {
  let now = 1000;
  const c = new PlayerController(async name => payload(name, name.slice(1)), memory(), () => ++now);
  await c.query('P1'); c.toggleFavorite();
  for (let i = 2; i <= 52; i++) await c.query(`P${i}`);
  assert.equal(Object.keys(c.view.db.caches).length, 50); assert.equal(c.view.db.recent.length, 20);
  assert.equal(c.view.db.caches['persona:1'], undefined); assert.ok(c.view.db.players['persona:1']);
  assert.deepEqual(c.view.db.favorites, ['persona:1']);
});

test('favorite capacity rejects the 51st without silently evicting a player', async () => {
  const c = new PlayerController(async name => payload(name, name.slice(1)), memory());
  for (let i = 1; i <= 50; i++) { await c.query(`P${i}`); assert.equal(c.toggleFavorite(), undefined); }
  await c.query('P51'); assert.match(c.toggleFavorite(), /50/); assert.equal(c.view.db.favorites.length, 50);
  assert.ok(c.view.db.favorites.includes('persona:1'));
});

test('storage failure is surfaced and a later save can recover', async () => {
  const store = memory(); const original = store.set; store.set = () => false;
  const c = new PlayerController(async () => payload(), store);
  await c.query('A'); assert.match(c.view.storageError, /保存失败/); assert.ok(c.view.cache);
  store.set = original; c.retrySave(); assert.equal(c.view.storageError, undefined); assert.ok(store.value);
});

test('disposing while a request runs prevents late persistence and queued requests', async () => {
  const a = deferred(); let writes = 0; let calls = 0;
  const c = new PlayerController(() => { calls++; return a.promise; }, { get: () => null, set: () => { writes++; return true; } });
  const qa = c.query('A'); const qb = c.query('B'); c.dispose(); await qb;
  a.resolve(payload()); await qa;
  assert.equal(writes, 0); assert.equal(calls, 1);
});

test('all 151 BF1 levels map to the wiki badge bands and GitHub URLs', () => {
  for (let rank = 0; rank <= 150; rank++) {
    const info = getRank(rank);
    assert.ok(info); assert.equal(info.level, rank);
    assert.match(info.imageUrl, /^https:\/\/raw\.githubusercontent\.com\/ayoaak\/ScriptingScripts\/main\/Battlefield1Stats\/assets\/ranks\/rank-\d{3}\.png$/);
    const matching = RANK_BANDS.filter(b => rank >= b.min && rank <= b.max);
    assert.equal(matching.length, 1);
    assert.ok(require('node:fs').existsSync(`Battlefield1Stats/assets/ranks/${info.file}`));
  }
  assert.equal(getRank(58).title, '少尉 IX');
  assert.equal(getRank(58).english, 'Second Lieutenant IX');
  assert.equal(getRank(58).file, 'rank-050.png');
  assert.equal(getRank(149).english, 'General X');
  assert.equal(getRank(150).english, 'Five-Star General');
  for (const value of [undefined, -1, 151, 58.5, NaN, Infinity]) assert.equal(getRank(value), undefined);
});

test('vertical card changes wrap correctly and ignore taps or sideways scrolls', () => {
  assert.equal(swipeDirection(0, -60), 1); assert.equal(swipeDirection(0, 60), -1);
  assert.equal(swipeDirection(3, -20, -600), 1);
  for (const values of [[0, 0], [0, 10], [80, 50], [3, -20, 600], [NaN, 60]]) assert.equal(swipeDirection(...values), 0);
  assert.equal(moveCard(0, 3, -1), 2); assert.equal(moveCard(2, 3, 1), 0);
  assert.equal(moveCard(0, 1, 1), 0); assert.equal(moveCard(0, 0, 1), 0);
});

test('the animated deck renders distinct real players with stable identity keys', () => {
  for (let count = 1; count <= 50; count++) {
    const ids = Array.from({ length: count }, (_, i) => `player-${i}`);
    for (const y of [-200, 0, 200]) {
      const layers = deckLayers(ids, 0, y, 360);
      assert.equal(new Set(layers.map(l => l.id)).size, layers.length);
      assert.ok(layers.length <= 4);
      assert.ok(layers.every(l => ids.includes(l.id)));
      assert.equal(layers.find(l => l.slot === 0).id, ids[0]);
      assert.ok(layers.every(l => l.opacity >= 0 && l.opacity <= 1 && l.scale > 0));
    }
  }
  assert.deepEqual(deckLayers([], 0, 0, 360), []);
});

test('the front card tracks the finger while its actual successor moves and grows', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const idle = deckLayers(ids, 0, 0, 360), moving = deckLayers(ids, 0, -120, 360);
  assert.equal(moving.find(l => l.id === 'A').y, -120);
  assert.ok(moving.find(l => l.id === 'A').opacity < 1);
  assert.ok(moving.find(l => l.id === 'B').scale > idle.find(l => l.id === 'B').scale);
  assert.ok(moving.find(l => l.id === 'B').y < idle.find(l => l.id === 'B').y);
  assert.equal(trackedDrag(0, -120, 360), -120);
  assert.equal(trackedDrag(0, -900, 360), -324);
  assert.equal(trackedDrag(80, 20, 360), 0);
});

test('promoted cards retain their identity, position and size across animated reorder', () => {
  const ids = ['A', 'B', 'C', 'D'];
  for (const direction of [-1, 1]) {
    const finished = deckLayers(ids, 0, -direction * 360, 360);
    const after = deckLayers(ids, moveCard(0, ids.length, direction), 0, 360);
    const promoted = finished.find(l => l.slot === direction);
    const front = after.find(l => l.slot === 0);
    assert.equal(promoted.id, front.id); assert.equal(promoted.y, front.y); assert.equal(promoted.scale, front.scale);
    assert.equal(finished.find(l => l.slot === 0).opacity, 0);
  }
  const start = deckLayers(ids, 0, 0, 360);
  assert.deepEqual(deckLayers(ids, 0, 0, 360), start); // a cancelled release has the exact idle targets
  const single = deckLayers(['A'], 0, -200, 360)[0];
  assert.equal(single.y, 0); assert.equal(single.opacity, 1);
});

test('name and rank fonts are increased by exactly thirty percent', () => {
  assert.ok(Math.abs(CARD_NAME_SIZE / 17 - 1.3) < 1e-10);
  assert.ok(Math.abs(CARD_RANK_SIZE / 12 - 1.3) < 1e-10);
});

require('./favorites-ui.test.cjs');
