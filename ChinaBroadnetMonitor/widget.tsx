import {
  HStack,
  Image,
  Script,
  Spacer,
  SVG,
  Text,
  VStack,
  Widget,
  ZStack,
} from "scripting"
import {
  EMPTY_BROADNET_USAGE,
  loadBroadnetConfiguration,
  loadBroadnetDataCache,
  refreshBroadnetData,
  type BroadnetDataCache,
  type BroadnetUsage,
} from "./broadnet"

const WIDGET_BACKGROUND = { light: "#FFFFFF", dark: "#000000" }
const FEE_COLOR = "#3F85AD"
const FLOW_COLOR = "#20A162"
const VOICE_COLOR = "#FF6F61"

interface WidgetSnapshot {
  data: BroadnetUsage
  updatedAt: string
  stale: boolean
}

function formatValue(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "0"
  return value
    .toFixed(digits)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1")
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "0.00"
  return Math.max(0, Math.min(100, value)).toFixed(2)
}

function formatClock(isoTime: string): string {
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) return "--:--"
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`
}

function cacheIsDue(
  cache: BroadnetDataCache | null,
  intervalMinutes: number,
): boolean {
  if (!cache) return true
  const cachedAt = new Date(cache.updatedAt).getTime()
  if (!Number.isFinite(cachedAt)) return true
  return Date.now() - cachedAt >= intervalMinutes * 60_000
}

async function prepareWidgetSnapshot(): Promise<WidgetSnapshot> {
  const cache = loadBroadnetDataCache()
  const configuration = loadBroadnetConfiguration()
  if (!cacheIsDue(cache, configuration.refreshIntervalMinutes)) {
    return { data: cache!.data, updatedAt: cache!.updatedAt, stale: false }
  }

  const refreshed = await refreshBroadnetData()
  if (refreshed.ok) {
    return {
      data: refreshed.data,
      updatedAt: refreshed.updatedAt,
      stale: false,
    }
  }

  return {
    data: refreshed.cachedData ?? cache?.data ?? EMPTY_BROADNET_USAGE,
    updatedAt:
      refreshed.cachedAt ?? cache?.updatedAt ?? new Date().toISOString(),
    stale: true,
  }
}

function cardGradient(color: string, reversed = false) {
  const rgb = color
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => Number.parseInt(part, 16))
  const low = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.03)`
  const high = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.10)`
  return {
    gradient: [
      { color: reversed ? low : high, location: 0 },
      { color: reversed ? high : low, location: 1 },
    ],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 0 },
  }
}

function SmallRow(props: {
  title: string
  value: string
  unit: string
  color: string
  icon?: string
  logo?: boolean
  combinedUnit?: boolean
  stale?: boolean
}) {
  return (
    <HStack
      alignment="center"
      padding={{ vertical: 5, horizontal: 8 }}
      frame={{ maxWidth: "infinity" }}
      background={cardGradient(props.color)}
      clipShape={{ type: "rect", cornerRadius: 12, style: "continuous" }}
    >
      <VStack alignment="leading" spacing={0}>
        <Text
          font={11}
          fontWeight="medium"
          foregroundStyle={props.color}
          opacity={0.5}
          lineLimit={1}
        >
          {props.title}{props.stale ? " · 旧数据" : ""}
        </Text>
        {props.combinedUnit ? (
          <Text
            font={16}
            fontWeight="semibold"
            fontDesign="rounded"
            foregroundStyle={props.color}
            lineLimit={1}
            minScaleFactor={0.7}
          >
            {props.value} {props.unit}
          </Text>
        ) : (
          <HStack alignment="lastTextBaseline" spacing={1}>
            <Text
              font={16}
              fontWeight="semibold"
              fontDesign="rounded"
              foregroundStyle={props.color}
              lineLimit={1}
              minScaleFactor={0.7}
            >
              {props.value}
            </Text>
            <Text font={13} fontWeight="semibold" foregroundStyle={props.color}>
              {props.unit}
            </Text>
          </HStack>
        )}
      </VStack>
      <Spacer />
      {props.logo ? (
        <Image
          filePath={`${Script.directory}/broadnet-logo.png`}
          resizable
          scaleToFit
          frame={{ width: 22, height: 22 }}
        />
      ) : (
        <Image
          systemName={props.icon ?? "phone.fill"}
          resizable
          scaleToFit
          frame={{ width: 22, height: 22 }}
          foregroundStyle={props.color}
        />
      )}
    </HStack>
  )
}

function ringSvg(percent: number | null, color: string): string {
  const value = Math.max(0, Math.min(100, percent ?? 0))
  const radius = 28.2
  const circumference = 2 * Math.PI * radius
  const progress = (circumference * value) / 100
  return `<svg xmlns="http://www.w3.org/2000/svg" width="65" height="65" viewBox="0 0 65 65">
    <circle cx="32.5" cy="32.5" r="${radius}" fill="none" stroke="${color}" stroke-opacity="0.20" stroke-width="6.6" />
    <circle cx="32.5" cy="32.5" r="${radius}" fill="none" stroke="${color}" stroke-width="6.6" stroke-linecap="round" stroke-dasharray="${progress} ${circumference}" transform="rotate(-90 32.5 32.5)" />
  </svg>`
}

function Ring(props: { percent: number | null; color: string; icon: string }) {
  return (
    <ZStack frame={{ width: 65, height: 65 }}>
      <SVG
        code={ringSvg(props.percent, props.color)}
        resizable
        antialiased
        frame={{ width: 65, height: 65 }}
      />
      <VStack alignment="center" spacing={1}>
        <Image
          systemName={props.icon}
          resizable
          scaleToFit
          frame={{ width: 12, height: 12 }}
          foregroundStyle={props.color}
          opacity={0.7}
        />
        <Text font={12} foregroundStyle={props.color}>
          {formatPercent(props.percent)}
        </Text>
        <Text font={8} fontWeight="bold" foregroundStyle={props.color} opacity={0.5}>
          %
        </Text>
      </VStack>
    </ZStack>
  )
}

function MediumCell(props: {
  title: string
  value: string
  unit: string
  color: string
  percent?: number | null
  icon?: string
  fee?: boolean
  updatedAt: string
  stale: boolean
}) {
  return (
    <VStack
      alignment="center"
      spacing={0}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      background={cardGradient(props.color, true)}
      clipShape={{ type: "rect", cornerRadius: 15, style: "continuous" }}
    >
      <Spacer />
      {props.fee ? (
        <Image
          filePath={`${Script.directory}/broadnet-logo.png`}
          resizable
          scaleToFit
          padding={{ top: 10 }}
          frame={{ width: 40, height: 50 }}
        />
      ) : (
        <Ring
          percent={props.percent ?? 0}
          color={props.color}
          icon={props.icon ?? "phone.fill"}
        />
      )}
      {props.fee ? (
        <HStack alignment="center" spacing={3} padding={{ top: 5 }}>
          <Image
            systemName={props.stale ? "exclamationmark.triangle.fill" : "arrow.2.circlepath"}
            resizable
            scaleToFit
            frame={{ width: 10, height: 10 }}
            foregroundStyle={props.color}
            opacity={0.6}
          />
          <Text font={10} fontWeight="medium" foregroundStyle={props.color} opacity={0.6}>
            {props.stale ? "旧 " : ""}{formatClock(props.updatedAt)}
          </Text>
        </HStack>
      ) : null}
      <Spacer />
      <Text
        font={15}
        fontWeight="semibold"
        foregroundStyle={props.color}
        lineLimit={1}
        minScaleFactor={0.65}
      >
        {props.value} {props.unit}
      </Text>
      <Spacer frame={{ height: 3 }} />
      <Text font={11} fontWeight="medium" foregroundStyle={props.color} opacity={0.7} lineLimit={1}>
        {props.title}
      </Text>
      <Spacer frame={{ height: 15 }} />
    </VStack>
  )
}

function SmallWidget(props: WidgetSnapshot) {
  const data = props.data
  return (
    <VStack
      spacing={0}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      padding={12}
      widgetBackground={WIDGET_BACKGROUND}
    >
      <SmallRow
        title="话费剩余"
        value={formatValue(data.balance)}
        unit="元"
        color={FEE_COLOR}
        logo
        stale={props.stale}
      />
      <Spacer />
      <SmallRow
        title="流量剩余"
        value={formatValue(data.flowRemainingGB)}
        unit="GB"
        color={FLOW_COLOR}
        icon="antenna.radiowaves.left.and.right"
        combinedUnit
      />
      <Spacer />
      <SmallRow
        title="语音剩余"
        value={formatValue(data.voiceRemainingMinutes, 0)}
        unit="分钟"
        color={VOICE_COLOR}
        icon="phone.badge.waveform.fill"
      />
    </VStack>
  )
}

function MediumWidget(props: WidgetSnapshot) {
  const data = props.data
  return (
    <HStack
      alignment="center"
      spacing={10}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      padding={10}
      widgetBackground={WIDGET_BACKGROUND}
    >
      <MediumCell
        title="话费剩余"
        value={formatValue(data.balance)}
        unit="¥"
        color={FEE_COLOR}
        fee
        updatedAt={props.updatedAt}
        stale={props.stale}
      />
      <MediumCell
        title="流量剩余"
        value={formatValue(data.flowRemainingGB)}
        unit="GB"
        color={FLOW_COLOR}
        percent={data.flowRemainingPercent}
        icon="antenna.radiowaves.left.and.right"
        updatedAt={props.updatedAt}
        stale={props.stale}
      />
      <MediumCell
        title="语音剩余"
        value={formatValue(data.voiceRemainingMinutes, 0)}
        unit="MIN"
        color={VOICE_COLOR}
        percent={data.voiceRemainingPercent}
        icon="phone.badge.waveform.fill"
        updatedAt={props.updatedAt}
        stale={props.stale}
      />
    </HStack>
  )
}

async function run() {
  const snapshot = await prepareWidgetSnapshot()
  const configuration = loadBroadnetConfiguration()
  const intervalMs = configuration.refreshIntervalMinutes * 60_000
  const cachedAt = new Date(snapshot.updatedAt).getTime()
  const nextRefresh =
    !snapshot.stale && Number.isFinite(cachedAt)
      ? Math.max(Date.now() + 60_000, cachedAt + intervalMs)
      : Date.now() + intervalMs
  const view =
    Widget.family === "systemMedium" ? (
      <MediumWidget {...snapshot} />
    ) : (
      <SmallWidget {...snapshot} />
    )

  Widget.present(view, {
    policy: "after",
    date: new Date(nextRefresh),
  })
}

run()
