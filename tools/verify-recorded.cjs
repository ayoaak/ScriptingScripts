// Replays independently recorded HTTP responses through the real API/controller.
// This command does not perform network requests or publish player data.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createApi } = require('../.build/core/api.js');
const { PlayerController } = require('../.build/core/controller.js');
const prefix = process.argv[2];
if (!prefix) throw Error('Usage: node tools/verify-recorded.cjs /path/to/bf1-final');
const records = new Map([
  ['konekoroku', 'demo'], ['jackfrags', 'second'], ['codexprobe_7e942b60_noplayer', 'missing'],
].map(([name, label]) => {
  const header = fs.readFileSync(`${prefix}-${label}.headers`, 'utf8');
  const status = Number([...header.matchAll(/^HTTP\/[^ ]+ (\d+)/gm)].pop()?.[1]);
  const body = fs.readFileSync(`${prefix}-${label}.json`, 'utf8');
  return [name, { status, body }];
}));
let saved;
const storage = { get: () => saved, set: value => { saved = structuredClone(value); return true; } };
const api = createApi(async url => {
  const record = records.get(new URL(url).searchParams.get('name').toLowerCase());
  if (!record) throw Error('Unrecorded player');
  return { status: record.status, ok: record.status === 200, headers: { get: () => null }, json: async () => JSON.parse(record.body) };
});
async function run() {
  const c = new PlayerController(api, storage);
  await c.query('konekoroku');
  assert.equal(c.view.player.name, 'KonekoRoku');
  const firstId = c.view.player.id, firstKills = c.view.cache.payload.stats.kills;
  c.toggleFavorite();
  await c.query('jackfrags');
  assert.equal(c.view.player.name, 'JackFrags');
  const secondId = c.view.player.id;
  assert.notEqual(firstId, secondId);
  const secondKills = c.view.cache.payload.stats.kills;
  c.toggleFavorite();
  await c.query('konekoroku');
  assert.equal(c.view.player.id, firstId); assert.equal(c.view.cache.payload.stats.kills, firstKills);
  await c.query('CodexProbe_7e942b60_NoPlayer');
  assert.match(c.view.error, /未找到/); assert.equal(c.view.cache, undefined);
  assert.equal(c.view.db.favorites.length, 2); assert.equal(c.view.db.recent.length, 2);
  const reopened = new PlayerController(api, storage);
  await reopened.restoreSelection();
  assert.equal(reopened.view.player.id, firstId);
  await reopened.query('jackfrags'); assert.equal(reopened.view.player.id, secondId);
  assert.equal(reopened.view.cache.payload.stats.kills, secondKills);
  c.dispose(); reopened.dispose();
  console.log(JSON.stringify({ result: 'passed', players: [{ name: 'KonekoRoku', id: firstId, kills: firstKills }, { name: 'JackFrags', id: secondId, kills: secondKills }], notFoundStatus: records.get('codexprobe_7e942b60_noplayer').status, checks: ['separate identities', 'separate caches', 'favorites', 'switch back', '404 isolation', 'persistent restoration'] }, null, 2));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
