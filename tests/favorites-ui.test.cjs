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
  const slots = [], pendingEffects = [], cleanup = [], pendingAnimations = [], animationLog = [], scrollLog = [];
  let cursor = 0;
  const h = (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } });
  const S = Object.fromEntries(['Button', 'HStack', 'Image', 'RoundedRectangle', 'Spacer', 'Text', 'VStack', 'ScrollView', 'ScrollViewReader'].map(name => [name, name]));
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
  const proxy = { scrollTo(id, anchor) { scrollLog.push({ id, anchor }); } };
  function mountReaders(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'ScrollViewReader') node.props.children = [node.props.children[0](proxy)];
    node.props.children = (node.props.children ?? []).map(mountReaders);
    return node;
  }
  return {
    scrollLog,
    render(props) { cursor = 0; const tree = mountReaders(exports.FavoritesDeck(props)); while (pendingEffects.length) { const stop = pendingEffects.shift()(); if (typeof stop === 'function') cleanup.push(stop); } return tree; },
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

test('back-card tap expands a native ScrollView without querying or intercepting its pan', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  const initial = native.render(props);
  assert.equal(nodes(initial).find(n => n.type === 'ScrollView').props.scrollDisabled, true);
  const tree = await expand(native, props);
  const scroller = nodes(tree).find(n => n.type === 'ScrollView');
  assert.equal(scroller.props.axes, 'vertical'); assert.equal(scroller.props.scrollDisabled, false);
  assert.ok(nodes(scroller).some(n => n.type === 'VStack' && n.props.spacing > 0 && n.props.scrollTargetLayout));
  assert.ok(!nodes(tree).some(n => n.props.gesture || n.props.highPriorityGesture || n.props.onDragGesture));
  assert.deepEqual(opened, []);
});

test('native scrollTo centers the selected stable key before entry, even if it is already focused', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  let tree = await expand(native, props);
  nodes(tree).find(n => n.type === 'ScrollView').props.onScrollTargetVisibilityChange.onChanged(['persona:2']);
  tree = native.render(props);
  card(tree, 'persona:2').props.action();
  tree = native.render(props);
  assert.deepEqual(native.scrollLog, [{ id: 'persona:2', anchor: 'center' }]);
  assert.equal(native.animationLog.at(-1).criteria, 'removed');
  assert.equal(card(tree, 'persona:2').props.rotationEffect, 0);
  assert.equal(card(tree, 'persona:2').props.scaleEffect, 1);
  assert.equal(card(tree, 'persona:1').props.opacity, 0);
  assert.deepEqual(opened, []);
  card(tree, 'persona:3').props.action();
  assert.equal(native.scrollLog.length, 1);
  native.finish(); await tick();
  assert.deepEqual(opened, ['Bravo']);
});

test('all fifty players are actual children of native scroll layout, including the final scroll target', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  for (let i = 4; i <= 50; i++) {
    const id = `persona:${i}`; props.db.favorites.push(id);
    props.db.players[id] = { id, name: `Player${i}`, lookupName: `Player${i}`, aliases: [], viewedAt: 1000 };
  }
  const tree = await expand(native, props);
  const scroller = nodes(tree).find(n => n.type === 'ScrollView');
  const layout = nodes(scroller).find(n => n.type === 'VStack' && n.props.scrollTargetLayout);
  const rows = layout.props.children.filter(n => n?.type === 'Button');
  assert.equal(rows.length, 50); assert.equal(new Set(rows.map(n => n.props.key)).size, 50);
  assert.equal(rows.at(-1).props.key, 'persona:50');
  assert.ok(rows.every(n => n.props.offset.y === 0 && n.props.opacity === 1));
  assert.ok(layout.props.padding.vertical > 0); // native space to center first and last rows
  assert.equal(scroller.props.scrollDisabled, false);
  card(tree, 'persona:50').props.action();
  assert.deepEqual(native.scrollLog, [{ id: 'persona:50', anchor: 'center' }]);
  native.finish(); await tick(); assert.deepEqual(opened, ['Player50']);
});

test('unmount or changed favorites invalidates pending entry completion', async () => {
  for (const change of ['unmount', 'remove']) {
    const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
    const tree = await expand(native, props);
    card(tree, 'persona:2').props.action();
    if (change === 'unmount') native.unmount();
    else { props.db.favorites.splice(1, 1); native.render(props); }
    native.finish(); await tick(); assert.deepEqual(opened, []);
  }
});

test('single favorite can enter after native centering completion', async () => {
  const native = host(), opened = [], props = { ...fixture(), onOpen: name => opened.push(name) };
  props.db.favorites.splice(1);
  const tree = native.render(props);
  card(tree, 'persona:1').props.action(); assert.deepEqual(opened, []);
  assert.deepEqual(native.scrollLog, [{ id: 'persona:1', anchor: 'center' }]);
  native.finish(); await tick(); assert.deepEqual(opened, ['Alpha']);
});
