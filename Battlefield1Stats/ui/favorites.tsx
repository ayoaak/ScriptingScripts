import { Button, DragGesture, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack, useEffect, useState } from "scripting";
import { dateTime, decimal, divide, integer, percent, Stats } from "../core/model";
import { getRank, moveCard, swipeDirection } from "../core/ranks";
import { Database, FRESH_MS } from "../core/store";

function RankAvatar({ rank }: { rank?: number }) {
  const info = getRank(rank);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [info?.imageUrl]);
  const placeholder = <VStack spacing={4}>
    <Image systemName="shield" font="title2" /><Text font="caption">{rank === undefined ? "—" : integer(rank)}</Text>
  </VStack>;
  return <VStack spacing={8} frame={{ width: 62 }} accessibilityLabel={info ? `${info.title}，等级 ${info.level}` : "暂无军衔信息"}>
    {info && !failed ? <Image imageUrl={info.imageUrl} placeholder={placeholder} onError={() => setFailed(true)} resizable scaleToFit frame={{ width: 60, height: 60 }} /> : placeholder}
    <Text font="caption" foregroundStyle="secondaryLabel">{rank === undefined ? "等级 —" : `Lv. ${integer(rank)}`}</Text>
  </VStack>;
}
function CardStat({ label, value }: { label: string; value: string }) {
  return <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
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
  return <VStack alignment="leading" spacing={12}>
    {large ? values.map(v => <CardStat key={v.label} {...v} />) : [0, 2].map(i => <HStack key={i} spacing={16}><CardStat {...values[i]!} /><CardStat {...values[i + 1]!} /></HStack>)}
  </VStack>;
}

export function FavoritesDeck({ db, now, large, onOpen, onRemove }: {
  db: Database; now: number; large: boolean; onOpen(name: string): void; onRemove(id: string): void;
}) {
  const ids = db.favorites.filter(id => !!db.players[id]);
  const [focusedId, setFocusedId] = useState(ids[0]);
  const [dragY, setDragY] = useState(0);
  if (!ids.length) return <Text foregroundStyle="secondaryLabel">还没有常用玩家，查询后可收藏。</Text>;
  const index = Math.max(0, ids.indexOf(focusedId ?? ""));
  const player = db.players[ids[index]!]!;
  const cache = db.caches[player.id];
  const rank = getRank(cache?.payload.stats.rank);
  const step = (direction: number) => { setFocusedId(ids[moveCard(index, ids.length, direction)]); setDragY(0); };
  const front = <VStack alignment="leading" spacing={16} padding={16}
    background={<RoundedRectangle cornerRadius={22} fill="secondarySystemBackground" />}>
    <HStack alignment="center" spacing={14}>
      <RankAvatar rank={cache?.payload.stats.rank} />
      <VStack alignment="leading" spacing={12} frame={{ maxWidth: "infinity" }}>
        <VStack alignment="leading" spacing={4}><Text font="headline" foregroundStyle="label">{player.name}</Text><Text font="caption" foregroundStyle="secondaryLabel">{rank?.title ?? "军衔暂缺"}</Text></VStack>
        <CardNumbers stats={cache?.payload.stats} large={large} />
      </VStack>
    </HStack>
    <Text font="caption" foregroundStyle="secondaryLabel">{cache ? `${now - cache.fetchedAt >= FRESH_MS || now < cache.fetchedAt ? "缓存 · " : ""}获取于 ${dateTime(cache.fetchedAt)}` : "暂无缓存，点击查询此玩家"}</Text>
  </VStack>;
  return <VStack alignment="leading" spacing={18}>
    <Button action={() => onOpen(player.lookupName)} buttonStyle="plain"
      frame={{ maxWidth: "infinity" }}
      accessibilityLabel={`查看 ${player.name} 的战绩，${rank?.title ?? "军衔暂缺"}`}
      accessibilityHint="卡片可上下滑动切换玩家，也可使用下方上一位和下一位按钮。"
      highPriorityGesture={DragGesture({ minDistance: 18, coordinateSpace: "local" })
        .onChanged(d => { if (ids.length > 1 && Math.abs(d.translation.height) > Math.abs(d.translation.width)) setDragY(Math.max(-18, Math.min(18, d.translation.height / 5))); })
        .onEnded(d => { const direction = swipeDirection(d.translation.width, d.translation.height, d.velocity.height); if (direction && ids.length > 1) step(direction); else setDragY(0); })}>
      <VStack offset={{ x: 0, y: dragY }} background={<ZStack>
        {ids.length > 2 && <RoundedRectangle cornerRadius={22} fill={{ color: "secondarySystemBackground", opacity: 0.55 }} scaleEffect={{ x: 0.90, y: 1 }} offset={{ x: 0, y: 20 }} accessibilityHidden />}
        {ids.length > 1 && <RoundedRectangle cornerRadius={22} fill={{ color: "secondarySystemBackground", opacity: 0.85 }} scaleEffect={{ x: 0.95, y: 1 }} offset={{ x: 0, y: 10 }} accessibilityHidden />}
      </ZStack>}>{front}</VStack>
    </Button>
    <HStack spacing={8} padding={{ top: ids.length > 1 ? 10 : 0 }}>
      <Button title="上一位" systemImage="chevron.up" buttonStyle="borderless" frame={{ minHeight: 44 }} disabled={ids.length < 2} action={() => step(-1)} />
      <Spacer /><Text font="caption" foregroundStyle="secondaryLabel" accessibilityLabel={`第 ${index + 1} 位，共 ${ids.length} 位`}>{`${index + 1} / ${ids.length}`}</Text><Spacer />
      <Button title="下一位" systemImage="chevron.down" buttonStyle="borderless" frame={{ minHeight: 44 }} disabled={ids.length < 2} action={() => step(1)} />
    </HStack>
    <HStack><Text font="caption" foregroundStyle="secondaryLabel">上下滑动换人 · 点击查看战绩</Text><Spacer />
      <Button title="取消收藏" buttonStyle="borderless" frame={{ minHeight: 44 }} action={() => onRemove(player.id)} />
    </HStack>
  </VStack>;
}
