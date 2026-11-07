import { HStack, Spacer, Text, VStack } from "scripting";
import { dateTime, decimal, divide, duration, Equipment, integer, percent, Stats } from "../core/model";

export function ValueRow({ label, value }: { label: string; value: string }) {
  return <HStack alignment="firstTextBaseline" spacing={16}>
    <Text>{label}</Text><Spacer /><Text foregroundStyle="secondaryLabel">{value}</Text>
  </HStack>;
}
export function StatBlock({ label, value }: { label: string; value: string }) {
  return <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity" }} padding={{ vertical: 8 }}>
    <Text font="caption" foregroundStyle="secondaryLabel">{label}</Text>
    <Text font="title" fontWeight="semibold">{value}</Text>
  </VStack>;
}
export function Summary({ stats, large }: { stats: Stats; large: boolean }) {
  const total = stats.wins !== undefined && stats.losses !== undefined ? stats.wins + stats.losses : undefined;
  const kpm = stats.timePlayed !== undefined ? divide(stats.kills, stats.timePlayed / 60) : undefined;
  const values = [
    { label: "总击杀", value: integer(stats.kills) }, { label: "K/D", value: decimal(divide(stats.kills, stats.deaths)) },
    { label: "KPM", value: decimal(kpm) }, { label: "胜率", value: percent(stats.wins, total) },
  ];
  return <VStack alignment="leading" spacing={8}>
    {large ? values.map(v => <StatBlock key={v.label} {...v} />) : [0, 2].map(i => <HStack key={i} spacing={20}>
      <StatBlock {...values[i]!} /><StatBlock {...values[i + 1]!} />
    </HStack>)}
  </VStack>;
}
export function StatRows({ stats }: { stats: Stats }) {
  return <VStack alignment="leading" spacing={12}>
    <ValueRow label="死亡" value={integer(stats.deaths)} />
    <ValueRow label="命中率" value={percent(stats.hits, stats.shots)} />
    <ValueRow label="爆头率" value={percent(stats.headshots, stats.kills)} />
    <ValueRow label="最高连杀" value={integer(stats.highestKillStreak)} />
    <ValueRow label="最远爆头" value={stats.longestHeadShot === undefined ? "—" : `${decimal(stats.longestHeadShot, 0)} m`} />
    <ValueRow label="技巧值" value={decimal(stats.skill)} />
    <ValueRow label="助攻" value={integer(stats.assists)} />
    <ValueRow label="取得狗牌" value={integer(stats.dogtagTaken)} />
    <ValueRow label="维修" value={integer(stats.repairs)} />
    <ValueRow label="治疗" value={integer(stats.heals)} />
    <ValueRow label="救援" value={integer(stats.revives)} />
  </VStack>;
}
export function EquipmentRows({ item }: { item: Equipment }) {
  return <VStack alignment="leading" spacing={12}>
    <ValueRow label="击杀" value={integer(item.kills)} /><ValueRow label="时长" value={duration(item.time)} />
    <ValueRow label="KPM" value={decimal(item.time === undefined ? undefined : divide(item.kills, item.time / 60))} />
    {item.type === "VEHICLE" ? <ValueRow label="摧毁" value={integer(item.destroyed)} /> : <VStack spacing={12}>
      <ValueRow label="爆头" value={integer(item.headshots)} /><ValueRow label="命中率" value={percent(item.hits, item.shots)} />
      <ValueRow label="爆头率" value={percent(item.headshots, item.kills)} />
    </VStack>}
  </VStack>;
}
export function Acquisition({ time, stale }: { time: number; stale: boolean }) {
  return <Text font="caption" foregroundStyle="secondaryLabel">{`${stale ? "缓存 · " : ""}获取于 ${dateTime(time)}`}</Text>;
}
