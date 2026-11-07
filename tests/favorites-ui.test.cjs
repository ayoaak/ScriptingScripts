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

test('native spring finishes before index changes and a short gesture springs back', async () => {
  const native = host(), props = fixture();
  let tree = native.render(props);
  const gesture = nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture;
  gesture.changed({ translation: { width: 0, height: -120 } });
  tree = native.render(props);
  assert.equal(nodes(tree).find(n => n.type === 'Button' && n.props.key === 'persona:1').props.offset.y, -120);
  gesture.ended({ translation: { width: 0, height: -120 }, velocity: { height: 0 } });
  tree = native.render(props);
  assert.equal(native.animationLog[0].criteria, 'removed');
  assert.equal(native.animationLog[0].animation.kind, 'spring');
  assert.equal(nodes(tree).find(n => n.type === 'Button' && n.props.zIndex === 10).props.key, 'persona:1');
  native.finish(); await tick(); tree = native.render(props);
  assert.equal(nodes(tree).find(n => n.type === 'Button' && n.props.zIndex === 10).props.key, 'persona:2');
  const nextGesture = nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture;
  nextGesture.changed({ translation: { width: 0, height: 20 } });
  nextGesture.ended({ translation: { width: 0, height: 20 }, velocity: { height: 0 } });
  native.finish(); await tick(); tree = native.render(props);
  const front = nodes(tree).find(n => n.type === 'Button' && n.props.zIndex === 10);
  assert.equal(front.props.key, 'persona:2'); assert.equal(front.props.offset.y, 0);
});

test('unmounting while the native spring runs ignores its late completion', async () => {
  const native = host(), props = fixture(); const tree = native.render(props);
  const gesture = nodes(tree).find(n => n.type === 'ZStack').props.highPriorityGesture;
  gesture.changed({ translation: { width: 0, height: -120 } });
  gesture.ended({ translation: { width: 0, height: -120 }, velocity: { height: 0 } });
  native.unmount(); native.finish(); await tick();
  assert.equal(native.animationLog.length, 1); // no follow-up identity/index transaction
});
