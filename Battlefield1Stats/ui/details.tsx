import { List, NavigationLink, Section, Text, VStack } from "scripting";
import { CaseInfo, dateTime, duration, Equipment, PlayerData, Report } from "../core/model";
import { EquipmentRows, StatRows, Summary, ValueRow } from "./components";

export function EquipmentDetail({ item }: { item: Equipment }) {
  return <List navigationTitle={item.name} navigationBarTitleDisplayMode="inline">
    <Section header={<Text>{item.category ?? "装备统计"}</Text>}><EquipmentRows item={item} /></Section>
  </List>;
}
export function ReportDetail({ report }: { report: Report }) {
  return <List navigationTitle={report.map ?? "对局详情"} navigationBarTitleDisplayMode="inline">
    <Section><Text>{report.mode ?? "未知模式"}</Text><Text>{dateTime(report.time)}</Text><Text>{report.serverName ?? "服务器信息暂缺"}</Text><ValueRow label="时长" value={duration(report.stats.timePlayed)} /></Section>
    <Section header={<Text>单场战绩</Text>}><Summary stats={report.stats} large /><StatRows stats={report.stats} /></Section>
    <Section header={<Text>单场装备</Text>}>
      {!report.weapons.length && <Text>暂无装备记录</Text>}
      {report.weapons.map((item, i) => <NavigationLink key={`${item.type}:${item.name}:${i}`} destination={<EquipmentDetail item={item} />}><Text>{item.name}</Text></NavigationLink>)}
    </Section>
  </List>;
}
function CaseRow({ label, info }: { label: string; info?: CaseInfo }) {
  return <VStack alignment="leading" spacing={4}><Text>{label}</Text><Text foregroundStyle="secondaryLabel">{info?.status ?? "暂无可用记录"}</Text></VStack>;
}
export function Profile({ data }: { data: PlayerData }) {
  return <List navigationTitle="玩家资料" navigationBarTitleDisplayMode="inline">
    <Section header={<Text>账号</Text>}>
      <Text>{data.metadata.name}</Text><ValueRow label="Persona ID" value={data.metadata.personaId ?? "—"} />
      <ValueRow label="User ID" value={data.metadata.userId ?? "—"} />
    </Section>
    <Section header={<Text>曾用名</Text>}>
      {!data.metadata.formerNames.length && <Text>暂无曾用名记录</Text>}
      {data.metadata.formerNames.map((item, i) => <VStack key={`${item.name}:${i}`} alignment="leading"><Text>{item.name}</Text><Text font="caption" foregroundStyle="secondaryLabel">{dateTime(item.time)}</Text></VStack>)}
    </Section>
    <Section header={<Text>战队</Text>}>
      {!data.platoons.length && <Text>暂无战队信息</Text>}
      {data.platoons.map((p, i) => <Text key={i}>{`${p.active ? "当前 · " : ""}${p.tag ? `[${p.tag}] ` : ""}${p.name ?? "名称暂缺"}`}</Text>)}
    </Section>
    <Section header={<Text>第三方反作弊记录</Text>} footer={<Text>记录缺失不代表已证实无违规。</Text>}>
      <CaseRow label="BFEAC" info={data.metadata.bfeac} /><CaseRow label="BFBAN" info={data.metadata.bfban} />
    </Section>
  </List>;
}
