import { Animation, Button, DragGesture, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack, useEffect, useObservable, useRef, useState, withAnimation } from "scripting";
import { dateTime, decimal, divide, integer, percent, Stats } from "../core/model";
import { getRank } from "../core/ranks";
import { Database, FRESH_MS } from "../core/store";
import { CARD_NAME_SIZE, CARD_RANK_SIZE, boundedPosition, deckLayers, draggedPosition, releasedPosition } from "../core/deck";

function RankAvatar({ rank }: { rank?: number }) {
  const info = getRank(rank);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [info?.imageUrl]);
  const placeholder = <VStack spacing={4}>
    <Image systemName="shield" font="title2" /><Text font={CARD_RANK_SIZE}>{rank === undefined ? "—" : integer(rank)}</Text>
  </VStack>;
  return <VStack spacing={8} frame={{ width: 62 }} accessibilityLabel={info ? `${info.title}，等级 ${info.level}` : "暂无军衔信息"}>
    {info && !failed ? <Image imageUrl={info.imageUrl} placeholder={placeholder} onError={() => setFailed(true)} resizable scaleToFit frame={{ width: 60, height: 60 }} /> : placeholder}
  </VStack>;
}
function CardStat({ label, value }: { label: string; value: string }) {
  return <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <Text font="caption" foregroundStyle="secondaryLabel">{label}</Text>
    <Text font="headline" foregroundStyle="label">{value}</Text>
  </VStack>;
}
function CardNumbers({ stats = {}, large }: { stats?: Stats; large: boolean }) {
  const total = stats.wins !== undefined && stats.losses !== undefined ? stats.wins + stats.losses : undefined;
  const values = [
    { label: "总击杀", value: integer(stats.kills) }, { label: "KD", value: decimal(divide(stats.kills, stats.deaths)) },
    { label: "KPM", value: decimal(stats.timePlayed === undefined ? undefined : divide(stats.kills, stats.timePlayed / 60)) },
    { label: "胜率", value: percent(stats.wins, total) },
  ];
  return <VStack alignment="leading" spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    {large ? values.map(v => <CardStat key={v.label} {...v} />) : [0, 2].map(i => <HStack key={i} spacing={16}><CardStat {...values[i]!} /><CardStat {...values[i + 1]!} /></HStack>)}
  </VStack>;
}

function FavoriteCard({ db, id, now, large }: { db: Database; id: string; now: number; large: boolean }) {
  const player = db.players[id]!;
  const cache = db.caches[id];
  const rank = getRank(cache?.payload.stats.rank);
  const typeScale = large ? 1.5 : 1;
  return <VStack alignment="leading" spacing={16} padding={16}
    frame={{ minHeight: large ? 400 : 240, maxWidth: "infinity", alignment: "topLeading" }}
    background={<RoundedRectangle cornerRadius={22} fill="secondarySystemBackground" />}>
    <HStack alignment="top" spacing={14}>
      <RankAvatar rank={cache?.payload.stats.rank} />
      <VStack alignment="leading" spacing={14} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={CARD_NAME_SIZE * typeScale} fontWeight="semibold" foregroundStyle="label" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{player.name}</Text>
          <Text font={CARD_RANK_SIZE * typeScale} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${rank?.title ?? "军衔暂缺"} · Lv. ${integer(cache?.payload.stats.rank)}`}</Text>
        </VStack>
        <CardNumbers stats={cache?.payload.stats} large={large} />
      </VStack>
    </HStack>
    <Text font="caption" foregroundStyle="secondaryLabel">{cache ? `${now - cache.fetchedAt >= FRESH_MS || now < cache.fetchedAt ? "缓存 · " : ""}获取于 ${dateTime(cache.fetchedAt)}` : "暂无缓存，点击查询此玩家"}</Text>
  </VStack>;
}

export function FavoritesDeck({ db, now, large, onOpen, onRemove }: {
  db: Database; now: number; large: boolean; onOpen(name: string): void; onRemove(id: string): void;
}) {
  const ids = db.favorites.filter(id => !!db.players[id]);
  const focusedId = useObservable<string | undefined>(ids[0]);
  const position = useObservable(0);
  const expansion = useObservable(0);
  const enteringId = useObservable<string | undefined>(undefined);
  const settling = useObservable(false);
  const busy = useRef(false);
  const dragOrigin = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => () => { alive.current = false; generation.current++; }, []);
  useEffect(() => {
    generation.current++; busy.current = false; dragOrigin.current = undefined;
    settling.setValue(false); enteringId.setValue(undefined); expansion.setValue(0);
    position.setValue(Math.max(0, ids.indexOf(focusedId.value ?? "")));
  }, [ids.join("|")]);
  if (!ids.length) return <Text foregroundStyle="secondaryLabel">还没有常用玩家，查询后可收藏。</Text>;
  const index = Math.round(boundedPosition(position.value, ids.length));
  const player = db.players[ids[index]!]!;
  const step = large ? 360 : 220;
  const layers = deckLayers(ids, position.value, expansion.value, step, enteringId.value);

  async function animate(body: () => void, after?: () => void) {
    if (busy.current) return;
    busy.current = true; settling.setValue(true);
    const token = generation.current;
    try {
      await withAnimation(Animation.spring({ duration: 0.4, bounce: 0 }), "removed", body);
      if (alive.current && token === generation.current) after?.();
    } catch (error) {
      console.error("卡片动画未完成", error);
      if (alive.current && token === generation.current) {
        enteringId.setValue(undefined);
        position.setValue(Math.round(boundedPosition(position.value, ids.length)));
      }
    } finally {
      if (alive.current && token === generation.current) { busy.current = false; settling.setValue(false); }
    }
  }
  function choose(id: string) {
    if (busy.current || dragOrigin.current !== undefined) return;
    const target = ids.indexOf(id);
    if (target < 0) return;
    // First tap on a back card fans out the whole deck, without querying anyone.
    if (expansion.value < 0.5 && target !== index) {
      void animate(() => expansion.setValue(1));
      return;
    }
    const name = db.players[id]!.lookupName;
    void animate(() => {
      enteringId.setValue(id); position.setValue(target); expansion.setValue(0);
    }, () => { focusedId.setValue(id); onOpen(name); });
  }
  function finishDrag(velocity: number) {
    if (dragOrigin.current === undefined || busy.current) return;
    dragOrigin.current = undefined;
    const target = releasedPosition(position.value, velocity, step, ids.length);
    void animate(() => position.setValue(target), () => focusedId.setValue(ids[target]));
  }
  return <VStack alignment="leading" spacing={10}>
    <ZStack alignment="center" frame={{ height: large ? 640 : 420 }} clipped contentShape={{ type: "rect" }}
      highPriorityGesture={ids.length > 1 && expansion.value > 0.5 ? DragGesture({ minDistance: 10, coordinateSpace: "local" })
        .onChanged(d => {
          if (busy.current || Math.abs(d.translation.width) >= Math.abs(d.translation.height)) return;
          if (dragOrigin.current === undefined) dragOrigin.current = position.value;
          position.setValue(draggedPosition(dragOrigin.current, d.translation.width, d.translation.height, step, ids.length));
        })
        .onEnded(d => finishDrag(d.velocity.height)) : undefined}>
      {layers.map(layer => <Button key={layer.id} buttonStyle="plain"
        action={() => choose(layer.id)} disabled={settling.value}
        accessibilityLabel={`${db.players[layer.id]!.name}${layer.index === index ? "，当前玩家" : ""}`}
        accessibilityHint={expansion.value > 0.5 ? "轻点后卡片居中，再进入此玩家战绩。" : layer.index === index ? "轻点查看战绩。" : "轻点展开所有常用玩家卡片。"}
        frame={{ maxWidth: "infinity", alignment: "leading" }}
        offset={{ x: layer.x, y: layer.y }} scaleEffect={layer.scale}
        rotationEffect={layer.rotation} opacity={layer.opacity} zIndex={layer.z}
        shadow={{ color: "black", radius: layer.index === index ? 10 : 4, x: 0, y: 4 }}>
        <FavoriteCard db={db} id={layer.id} now={now} large={large} />
      </Button>)}
    </ZStack>
    <HStack>
      <Text font="caption" foregroundStyle="secondaryLabel" accessibilityLabel={`第 ${index + 1} 位，共 ${ids.length} 位`}>{`${index + 1} / ${ids.length}`}</Text>
      <Spacer />
      {ids.length > 1 && <Button title={expansion.value > 0.5 ? "收起卡组" : "展开卡组"} buttonStyle="borderless" frame={{ minHeight: 44 }} disabled={settling.value}
        action={() => { dragOrigin.current = undefined; void animate(() => { position.setValue(index); expansion.setValue(expansion.value > 0.5 ? 0 : 1); }); }} />}
    </HStack>
    <Text font="caption" foregroundStyle="secondaryLabel">{expansion.value > 0.5 ? "上下滑动浏览 · 点选后居中进入" : "点击后排卡片展开 · 点击当前玩家进入"}</Text>
    <Button title="取消收藏" buttonStyle="borderless" frame={{ minHeight: 44 }} disabled={settling.value} action={() => onRemove(player.id)} />
  </VStack>;
}
