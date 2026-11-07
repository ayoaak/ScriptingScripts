import * as S from "scripting";
import { Button, EnvironmentValuesReader, HStack, List, Navigation, NavigationLink, NavigationStack, Picker, ProgressView, Section, Spacer, Text, TextField, VStack, useEffect, useState } from "scripting";
import { PlayerController } from "../core/controller";
import { dateTime, decimal, divide, duration, Equipment, integer, PlayerData } from "../core/model";
import { FRESH_MS } from "../core/store";
import { Acquisition, StatRows, Summary } from "./components";
import { EquipmentDetail, Profile, ReportDetail } from "./details";

type Tab = "overview" | "weapons" | "vehicles" | "reports";
type Sort = "kills" | "kpm" | "accuracy";
// Optional capabilities are checked before being passed to a native view.
const hasGlass = Number.parseInt(Device.systemVersion, 10) >= 26 && typeof UIGlass !== "undefined" && typeof S.GlassEffectContainer === "function";
const Controls = hasGlass ? S.GlassEffectContainer : VStack;
const normalStyle = hasGlass ? "glass" : "bordered";
const prominentStyle = hasGlass ? "glassProminent" : "borderedProminent";

function EquipmentList({ data, vehicle }: { data: PlayerData; vehicle: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<Sort>("kills");
  const [count, setCount] = useState(30);
  const all = data.weapons.filter(item => vehicle ? item.type === "VEHICLE" : item.type !== "VEHICLE");
  const categories = [...new Set(all.map(item => item.category).filter((x): x is string => !!x))].sort();
  const value = (item: Equipment) => sort === "kpm" ? (item.time === undefined ? undefined : divide(item.kills, item.time / 60)) ?? -1 : sort === "accuracy" ? divide(item.hits, item.shots) ?? -1 : item.kills ?? -1;
  const list = all.filter(item => (!category || item.category === category) && item.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => value(b) - value(a));
  return <Section header={<Text>{vehicle ? "载具" : "武器与配备"}</Text>}>
    <TextField title="搜索装备" value={search} onChanged={v => { setSearch(v); setCount(30); }} />
    <Picker title="类别" value={category} onChanged={v => { setCategory(v); setCount(30); }} pickerStyle="menu">
      <Text tag="">全部类别</Text>{categories.map(c => <Text key={c} tag={c}>{c}</Text>)}
    </Picker>
    <Picker title="排序" value={sort} onChanged={v => { setSort(v as Sort); setCount(30); }} pickerStyle="menu">
      <Text tag="kills">击杀</Text><Text tag="kpm">KPM</Text>{!vehicle && <Text tag="accuracy">命中率</Text>}
    </Picker>
    {!list.length && <Text>{all.length ? "没有符合条件的记录" : vehicle ? "暂无载具记录" : "暂无武器记录"}</Text>}
    {list.slice(0, count).map((item, i) => <NavigationLink key={`${item.type}:${item.name}:${i}`} destination={<EquipmentDetail item={item} />}>
      <VStack alignment="leading" spacing={4}><Text>{item.name}</Text><Text font="caption" foregroundStyle="secondaryLabel">{vehicle ? `${integer(item.kills)} 击杀 · ${integer(item.destroyed)} 摧毁` : `${integer(item.kills)} 击杀 · ${decimal(item.time === undefined ? undefined : divide(item.kills, item.time / 60))} KPM`}</Text></VStack>
    </NavigationLink>)}
    {list.length > count && <Button title={`显示更多（剩余 ${list.length - count}）`} action={() => setCount(count + 30)} />}
  </Section>;
}
function Reports({ data }: { data: PlayerData }) {
  const [count, setCount] = useState(20);
  const reports = [...data.reports].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return <Section header={<Text>对局记录 · {reports.length}</Text>}>
    {!reports.length && <Text>暂无对局记录</Text>}
    {reports.slice(0, count).map((report, i) => <NavigationLink key={`${report.time}:${i}`} destination={<ReportDetail report={report} />}>
      <VStack alignment="leading" spacing={4}><Text>{report.map ?? "未知地图"} · {report.mode ?? "未知模式"}</Text><Text font="caption" foregroundStyle="secondaryLabel">{`${dateTime(report.time)} · ${integer(report.stats.kills)} / ${integer(report.stats.deaths)}`}</Text></VStack>
    </NavigationLink>)}
    {reports.length > count && <Button title={`显示更多（剩余 ${reports.length - count}）`} action={() => setCount(count + 20)} />}
  </Section>;
}

export function App({ controller }: { controller: PlayerController }) {
  const [, setRevision] = useState(0);
  const [screen, setScreen] = useState<"home" | "detail">(() => controller.view.queryName ? "detail" : "home");
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const dismiss = Navigation.useDismiss();
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => { setRevision(n => n + 1); setNow(Date.now()); });
    void controller.restoreSelection();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); unsubscribe(); controller.dispose(); };
  }, []);
  const view = controller.view;
  const cooling = view.cooldownUntil > now;
  const query = (name: string) => {
    setNotice(undefined);
    if (name.trim()) { setScreen("detail"); setTab("overview"); }
    void controller.query(name);
  };
  const selectedId = view.player?.id;
  const data = view.cache?.payload;
  const favorite = !!selectedId && view.db.favorites.includes(selectedId);
  const stale = !!view.cache && (now < view.cache.fetchedAt || now - view.cache.fetchedAt >= FRESH_MS);
  const playerRows = (ids: string[], kind: "favorite" | "recent") => ids.map(id => {
    const player = view.db.players[id]; if (!player) return null;
    const cache = view.db.caches[id];
    return <VStack key={id} alignment="leading" spacing={6}>
      <Button action={() => query(player.lookupName)} buttonStyle="plain">
        <VStack alignment="leading" spacing={4}>
          <Text>{`${selectedId === id ? "✓ " : ""}${player.name}`}</Text>
          {cache && <Text font="caption" foregroundStyle="secondaryLabel">{`Rank ${integer(cache.payload.stats.rank)} · 获取于 ${dateTime(cache.fetchedAt)}`}</Text>}
        </VStack>
      </Button>
      <Button title={kind === "favorite" ? "取消收藏" : "移除历史"} buttonStyle="borderless" action={() => kind === "favorite" ? controller.removeFavorite(id) : controller.removeRecent(id)} />
    </VStack>;
  });
  return <NavigationStack>
    <EnvironmentValuesReader keys={["dynamicTypeSize"]}>{env => {
      const large = env.dynamicTypeSize.startsWith("accessibility");
      return <List navigationTitle={screen === "home" ? "战地一" : view.player?.name ?? view.queryName} navigationBarTitleDisplayMode="inline" listStyle="insetGroup"
        refreshable={async () => { if (screen === "detail" && view.queryName) await controller.refresh(); }}
        toolbar={{
          topBarLeading: screen === "detail" ? <Button title="玩家" systemImage="chevron.left" action={() => { setScreen("home"); setNotice(undefined); }} /> : undefined,
          topBarTrailing: <Button title="关闭" action={dismiss} />,
        }}>
        {view.storageError && <Section><Text foregroundStyle="systemRed">{view.storageError}</Text><Button title="重试保存" action={() => controller.retrySave()} /></Section>}
        {cooling && <Section><Text>{`查询过于频繁，请于 ${dateTime(view.cooldownUntil)} 后重试`}</Text><Text font="caption" foregroundStyle="secondaryLabel">冷却期间仍可查看已保存的战绩。</Text></Section>}
        {screen === "home" ? <S.Group>
          <Section header={<Text>查询玩家</Text>}>
            <TextField title="玩家 ID" prompt="例如 konekoroku" value={input} onChanged={setInput} textInputAutocapitalization="never" autocorrectionDisabled onSubmit={() => query(input)} />
            <Controls><Button title="查询" systemImage="magnifyingglass" buttonStyle={prominentStyle} controlSize="large" frame={{ minHeight: 44 }} disabled={cooling} action={() => query(input)} /></Controls>
            {!input.trim() && view.error && <Text foregroundStyle="systemRed">{view.error}</Text>}
          </Section>
          <Section header={<Text>常用玩家 · {view.db.favorites.length}/50</Text>}>
            {!view.db.favorites.length ? <Text foregroundStyle="secondaryLabel">还没有常用玩家，查询后可收藏。</Text> : playerRows(view.db.favorites, "favorite")}
          </Section>
          <Section header={<Text>最近查询</Text>}>
            {!view.db.recent.length ? <Text foregroundStyle="secondaryLabel">成功查询的玩家会显示在这里。</Text> : playerRows(view.db.recent, "recent")}
          </Section>
        </S.Group> : <S.Group>
          <Section>
            <Text font="title2" fontWeight="semibold">{view.player?.name ?? view.queryName}</Text>
            {data && <Text foregroundStyle="secondaryLabel">{`Rank ${integer(data.stats.rank)} · ${duration(data.stats.timePlayed)}`}</Text>}
            {view.cache && <Acquisition time={view.cache.fetchedAt} stale={stale || !!view.error} />}
            <Controls><HStack spacing={12}>
              <Button title={favorite ? "已收藏" : "收藏"} systemImage={favorite ? "star.fill" : "star"} buttonStyle={normalStyle} frame={{ minHeight: 44 }} accessibilityLabel={favorite ? "取消收藏当前玩家" : "收藏当前玩家"} disabled={!view.player} action={() => setNotice(controller.toggleFavorite())} />
              <Spacer /><Button title="刷新" systemImage="arrow.clockwise" buttonStyle={normalStyle} frame={{ minHeight: 44 }} accessibilityLabel="刷新当前玩家战绩" disabled={cooling || view.loading} action={() => { setNotice(undefined); void controller.refresh(); }} />
            </HStack></Controls>
            {view.loading && <HStack><ProgressView /><Text>{data ? "正在更新" : "正在查询"}</Text></HStack>}
            {view.error && <VStack alignment="leading" spacing={8}>
              <Text foregroundStyle="systemRed">{view.error}</Text>{data && <Text font="caption">更新失败，正在显示缓存。</Text>}
              <Button title="重试" disabled={cooling || view.loading} action={() => { void controller.refresh(); }} />
            </VStack>}
            {notice && <Text foregroundStyle="systemRed">{notice}</Text>}
          </Section>
          {data && <S.Group>
            <Section><Summary stats={data.stats} large={large} /></Section>
            <Section><Picker title="战绩分类" value={tab} onChanged={v => setTab(v as Tab)} pickerStyle={large ? "menu" : "segmented"}>
              <Text tag="overview">概览</Text><Text tag="weapons">武器</Text><Text tag="vehicles">载具</Text><Text tag="reports">对局</Text>
            </Picker></Section>
            {tab === "overview" && <S.Group>
              <Section header={<Text>详细战绩</Text>}><StatRows stats={data.stats} /></Section>
              <Section><NavigationLink destination={<Profile data={data} />}><Text>玩家资料与曾用名</Text></NavigationLink></Section>
            </S.Group>}
            {(tab === "weapons" || tab === "vehicles") && <EquipmentList key={`${selectedId}:${tab}`} data={data} vehicle={tab === "vehicles"} />}
            {tab === "reports" && <Reports key={selectedId} data={data} />}
          </S.Group>}
        </S.Group>}
        <Section footer={<Text>数据来源 stats.2788.pro · 获取时间不代表战绩实际更新时间。</Text>} />
      </List>;
    }}</EnvironmentValuesReader>
  </NavigationStack>;
}
