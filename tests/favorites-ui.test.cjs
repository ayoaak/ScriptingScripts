// A small Scripting bridge double checks our native-component wiring, not pixels
// or iPhone rendering. Springs are held until explicitly completed by each test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { emptyDatabase } = require('../.build/core/store.js');
const { parsePlayer } = require('../.build/core/model.js');

function host() {
  const slots = [], pendingEffects = [], cleanup = [], pendingAnimations = [], animationLog = [];
  let cursor = 0;
  const h = (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } });
  const S = Object.fromEntries(['Button', 'HStack', 'Image', 'RoundedRectangle', 'Spacer', 'Text', 'VStack', 'ZStack'].map(name => [name, name]));
  S.useRef = initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); };
  S.useObservable = initial => { const i = cursor++; return slots[i] ?? (slots[i] = { value: initial, setValue(v) { this.value = v; } }); };
  S.useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = value; }]; };
  S.useEffect = (effect, deps) => {
    const i = cursor++;
    if (!(i in slots) || deps.some((v, n) => v !== slots[i][n])) { slots[i] = [...deps]; pendingEffects.push(effect); }
  };
  S.DragGesture = options => ({ options, onChanged(fn) { this.changed = fn; return this; }, onEnded(fn) { this.ended = fn; return this; } });
  S.Animation = { spring: options => ({ kind: 'spring', options }), linear: duration => ({ kind: 'linear', duration }) };
  S.withAnimation = (animation, ...args) => {
    const body = args.at(-1); animationLog.push({ animation, criteria: typeof args[0] === 'string' ? args[0] : undefined }); body();
    return animation.kind === 'spring' ? new Promise(resolve => pendingAnimations.push(resolve)) : Promise.resolve();
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('Battlefield1Stats/ui/favorites.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: 'h' },
  }).outputText;
  vm.runInNewContext(source, {
    exports, h, console,
    require: name => name === 'scripting' ? S : require('../.build/core/' + name.split('/').at(-1) + '.js'),
  }, { filename: 'favorites.tsx' });
  return {
    render(props) { cursor = 0; const tree = exports.FavoritesDeck(props); while (pendingEffects.length) { const stop = pendingEffects.shift()(); if (typeof stop === 'function') cleanup.push(stop); } return tree; },
    animationLog,
    finish() { pendingAnimations.splice(0).forEach(resolve => resolve()); },
    unmount() { cleanup.forEach(fn => fn()); },
  };
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.props?.children ?? []).flatMap(nodes)]; }
function fixture() {
  const db = emptyDatabase();
  for (const [i, name] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
    const id = `persona:${i + 1}`; db.favorites.push(id);
    db.players[id] = { id, name, lookupName: name, aliases: [], viewedAt: 1000 };
    db.caches[id] = { fetchedAt: 1000, accessedAt: 1000, payload: parsePlayer({ metadata: { name, personaId: String(i + 1) }, stats: { rank: 58 + i, kills: 100 + i, deaths: 10, timePlayed: 120, wins: 1, losses: 1 } }) };
  }
  return { db, now: 1000, large: false, onOpen() {}, onRemove() {} };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('native deck contains real player cards and no previous/next buttons', () => {
  const native = host(), props = fixture(), tree = native.render(props);
  const all = nodes(tree);
  const cards = all.filter(n => typeof n.type === 'function' && n.type.name === 'FavoriteCard');
  assert.equal(cards.length, 3); assert.equal(new Set(cards.map(n => n.props.id)).size, 3);
  assert.ok(!all.some(n => n.type === 'Button' && ['上一位', '下一位'].includes(n.props.title)));
  const card = cards.find(n => n.props.id === props.db.favorites[0]);
  const content = card.type(card.props), texts = nodes(content).filter(n => n.type === 'Text');
  const name = texts.find(n => n.props.children.includes('Alpha'));
  assert.equal(name.props.frame.alignment, 'leading'); assert.equal(name.props.font, 22.1);
  const rank = texts.find(n => n.props.children.some(x => typeof x === 'string' && x.includes('Lv. 58')));
  assert.equal(rank.props.frame.alignment, 'leading'); assert.ok(Math.abs(rank.props.font - 15.6) < 1e-10);
  const numbers = nodes(content).find(n => typeof n.type === 'function' && n.type.name === 'CardNumbers');
  assert.equal(numbers.type(numbers.props).props.frame.alignment, 'leading');
});

function card(tree, id) { return nodes(tree).find(n => n.type === 'Button' && n.props.key === id); }
async function expand(native, props) {
  card(native.render(props), 'persona:2').props.action();
  native.finish(); await tick();
  return native.render(props);
}

test('back-card tap expands without querying; choosing waits for native centering before entering', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  const before = native.render(props);
  assert.equal(card(before, 'persona:2').props.disabled, false);
  card(before, 'persona:2').props.action();
  let tree = native.render(props);
  assert.equal(opened.length, 0);
  assert.equal(card(tree, 'persona:2').props.offset.y, 220);
  assert.equal(card(tree, 'persona:2').props.disabled, true);
  assert.equal(native.animationLog[0].criteria, 'removed');
  native.finish(); await tick();
  tree = native.render(props);
  card(tree, 'persona:2').props.action();
  tree = native.render(props);
  const chosen = card(tree, 'persona:2');
  assert.equal(chosen.props.offset.y, 0); assert.equal(chosen.props.offset.x, 0);
  assert.equal(chosen.props.rotationEffect, 0); assert.equal(chosen.props.scaleEffect, 1);
  assert.equal(chosen.props.zIndex, 100); assert.equal(card(tree, 'persona:1').props.opacity, 0);
  assert.deepEqual(opened, []);
  card(tree, 'persona:3').props.action(); // repeated taps are locked out
  native.finish(); await tick();
  assert.deepEqual(opened, ['Bravo']);
});

test('expanded drag tracks the finger, snaps without querying, and all fifty players are reachable', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  for (let i = 4; i <= 50; i++) {
    const id = `persona:${i}`; props.db.favorites.push(id);
    props.db.players[id] = { id, name: `Player${i}`, lookupName: `Player${i}`, aliases: [], viewedAt: 1000 };
  }
  let tree = await expand(native, props);
  let gesture = nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture;
  gesture.changed({ translation: { width: 0, height: -110 } });
  tree = native.render(props);
  assert.equal(card(tree, 'persona:1').props.offset.y, -110);
  gesture.ended({ velocity: { height: 0 } });
  native.finish(); await tick();
  tree = native.render(props);
  assert.equal(card(tree, 'persona:2').props.offset.y, 0);
  gesture = nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture;
  gesture.changed({ translation: { width: 0, height: -220 * 100 } });
  gesture.ended({ velocity: { height: -1000 } });
  native.finish(); await tick(); tree = native.render(props);
  assert.equal(card(tree, 'persona:50').props.offset.y, 0);
  assert.equal(nodes(tree).filter(n => typeof n.type === 'function' && n.type.name === 'FavoriteCard').length, 3);
  assert.deepEqual(opened, []);
  card(tree, 'persona:50').props.action();
  native.finish(); await tick();
  assert.deepEqual(opened, ['Player50']);
});

test('unmount or changed favorites invalidates pending entry completion', async () => {
  for (const change of ['unmount', 'remove']) {
    const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
    let tree = await expand(native, props);
    card(tree, 'persona:2').props.action();
    if (change === 'unmount') native.unmount();
    else { props.db.favorites.splice(1, 1); native.render(props); }
    native.finish(); await tick();
    assert.deepEqual(opened, []);
  }
});

test('single favorite enters after animation without capturing list scroll gestures', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  props.db.favorites.splice(1);
  const tree = native.render(props);
  assert.equal(nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture, undefined);
  card(tree, 'persona:1').props.action(); assert.deepEqual(opened, []);
  native.finish(); await tick(); assert.deepEqual(opened, ['Alpha']);
});
