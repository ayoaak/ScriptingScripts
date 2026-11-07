import { Animation, Button, DragGesture, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack, useEffect, useObservable, useRef, useState, withAnimation } from "scripting";
import { dateTime, decimal, divide, integer, percent, Stats } from "../core/model";
import { getRank, moveCard, swipeDirection } from "../core/ranks";
import { Database, FRESH_MS } from "../core/store";
import { CARD_NAME_SIZE, CARD_RANK_SIZE, deckLayers, trackedDrag } from "../core/deck";

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
  const drag = useObservable(0);
  const settling = useObservable(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => () => { alive.current = false; generation.current++; }, []);
  useEffect(() => {
    generation.current++; busy.current = false;
    settling.setValue(false); drag.setValue(0);
  }, [ids.join("|")]);
  if (!ids.length) return <Text foregroundStyle="secondaryLabel">还没有常用玩家，查询后可收藏。</Text>;
  const index = Math.max(0, ids.indexOf(focusedId.value ?? ""));
  const player = db.players[ids[index]!]!;
  const travel = large ? 600 : 360;
  const layers = deckLayers(ids, index, drag.value, travel);
  async function release(direction: number) {
    if (busy.current || ids.length < 2) return;
    busy.current = true; settling.setValue(true);
    const token = generation.current;
    try {
      // Drag updates have no implicit animation. Only release uses a native spring,
      // and reordering waits for the native completion instead of a JS timeout.
      await withAnimation(Animation.spring({ duration: 0.42, bounce: 0.16 }), "removed", () => drag.setValue(direction ? -direction * travel : 0));
      if (!alive.current || token !== generation.current) return;
      await withAnimation(Animation.linear(0), () => {
        if (direction) focusedId.setValue(ids[moveCard(index, ids.length, direction)]);
        drag.setValue(0);
      });
    } catch (error) {
      console.error("卡片动画未完成", error);
      if (alive.current && token === generation.current) drag.setValue(0);
    } finally {
      if (alive.current && token === generation.current) { busy.current = false; settling.setValue(false); }
    }
  }
  return <VStack alignment="leading" spacing={10}>
    <ZStack alignment="top" padding={{ top: ids.length > 2 ? 18 : 0, bottom: ids.length > 1 ? 34 : 0 }}
      highPriorityGesture={ids.length > 1 ? DragGesture({ minDistance: 10, coordinateSpace: "local" })
        .onChanged(d => { if (!busy.current && ids.length > 1) drag.setValue(trackedDrag(d.translation.width, d.translation.height, travel)); })
        .onEnded(d => { if (!busy.current && ids.length > 1) void release(swipeDirection(d.translation.width, d.translation.height, d.velocity.height)); }) : undefined}>
      {layers.map(layer => <Button key={layer.id} buttonStyle="plain"
        action={() => { if (!busy.current && layer.slot === 0) onOpen(db.players[layer.id]!.lookupName); }}
        disabled={layer.slot !== 0 || settling.value}
        accessibilityHidden={layer.slot !== 0}
        accessibilityLabel={`查看 ${db.players[layer.id]!.name} 的战绩`}
        accessibilityHint="上下拖动卡片切换常用玩家，轻点查看详情。"
        frame={{ maxWidth: "infinity", alignment: "leading" }}
        offset={{ x: 0, y: layer.y }} scaleEffect={layer.scale} opacity={layer.opacity} zIndex={layer.z}>
        <FavoriteCard db={db} id={layer.id} now={now} large={large} />
      </Button>)}
    </ZStack>
    <Text font="caption" foregroundStyle="secondaryLabel" accessibilityLabel={`第 ${index + 1} 位，共 ${ids.length} 位`}>{`${index + 1} / ${ids.length}`}</Text>
    <HStack><Text font="caption" foregroundStyle="secondaryLabel">上下滑动换人 · 点击查看战绩</Text><Spacer />
      <Button title="取消收藏" buttonStyle="borderless" frame={{ minHeight: 44 }} disabled={settling.value} action={() => onRemove(player.id)} />
    </HStack>
  </VStack>;
}
