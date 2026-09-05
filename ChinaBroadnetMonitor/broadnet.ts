export const BROADNET_QUERY_URL =
  "https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo"

export const BROADNET_SCRIPTING_HEADER = "X-ChinaBroadnet-Scripting"
export const BROADNET_STATUS_HEADER = "X-ChinaBroadnet-Status"

export type BroadnetRewriteState =
  | "not_installed"
  | "not_captured"
  | "ready"
  | "credential_expired"
  | "network_error"

export interface BroadnetUsage {
  balance: number | null
  flowTotalGB: number | null
  flowUsedGB: number | null
  flowRemainingGB: number | null
  flowRemainingPercent: number | null
  voiceTotalMinutes: number | null
  voiceUsedMinutes: number | null
  voiceRemainingMinutes: number | null
  voiceRemainingPercent: number | null
  updatedAt: string
}

export interface BroadnetConfiguration {
  refreshIntervalMinutes: number
}

export interface BroadnetDataCache {
  data: BroadnetUsage
  updatedAt: string
}

export type BroadnetRefreshResult =
  | {
      ok: true
      data: BroadnetUsage
      updatedAt: string
    }
  | {
      ok: false
      state: Exclude<BroadnetRewriteState, "ready">
      message: string
      cachedData?: BroadnetUsage
      cachedAt?: string
      stale: boolean
    }

export const EMPTY_BROADNET_USAGE: BroadnetUsage = {
  balance: null,
  flowTotalGB: null,
  flowUsedGB: null,
  flowRemainingGB: null,
  flowRemainingPercent: null,
  voiceTotalMinutes: null,
  voiceUsedMinutes: null,
  voiceRemainingMinutes: null,
  voiceRemainingPercent: null,
  updatedAt: "",
}

const CONFIGURATION_KEY = "china-broadnet.configuration.v1"
const DATA_CACHE_KEY = "china-broadnet.data-cache.v1"
const DEFAULT_CONFIGURATION: BroadnetConfiguration = {
  refreshIntervalMinutes: 30,
}
const ALLOWED_REFRESH_INTERVALS = new Set([15, 30, 60, 120])

export interface BroadnetRewriteStatusResult {
  state: BroadnetRewriteState
  message: string
  capturedAt?: string
  serviceStatus?: string
  usage?: BroadnetUsage
}

export interface BroadnetNetworkProbeResult {
  reachable: boolean
  httpStatus?: number
  contentType?: string
  responseKind?: "json" | "text"
  serviceStatus?: string
  serviceMessage?: string
  errorName?: string
  errorMessage?: string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function shortText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 100)
    : ""
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rounded(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function remainingPercent(remaining: number | null, total: number | null) {
  if (remaining === null || total === null || total <= 0) return null
  return rounded(Math.max(0, Math.min(100, (remaining / total) * 100)))
}

function usedAmount(total: number | null, remaining: number | null) {
  if (total === null || remaining === null) return null
  return rounded(Math.max(0, total - remaining))
}

function isBroadnetUsage(value: Record<string, unknown>): boolean {
  const nullableNumberKeys = [
    "balance",
    "flowTotalGB",
    "flowUsedGB",
    "flowRemainingGB",
    "flowRemainingPercent",
    "voiceTotalMinutes",
    "voiceUsedMinutes",
    "voiceRemainingMinutes",
    "voiceRemainingPercent",
  ]
  return (
    typeof value.updatedAt === "string" &&
    nullableNumberKeys.every(
      (key) => value[key] === null || typeof value[key] === "number",
    )
  )
}

export function loadBroadnetConfiguration(): BroadnetConfiguration {
  const stored = Storage.get<Partial<BroadnetConfiguration>>(CONFIGURATION_KEY)
  const interval = Number(stored?.refreshIntervalMinutes)
  return {
    refreshIntervalMinutes: ALLOWED_REFRESH_INTERVALS.has(interval)
      ? interval
      : DEFAULT_CONFIGURATION.refreshIntervalMinutes,
  }
}

export function saveBroadnetConfiguration(
  configuration: BroadnetConfiguration,
): void {
  const interval = Number(configuration.refreshIntervalMinutes)
  const normalized = {
    refreshIntervalMinutes: ALLOWED_REFRESH_INTERVALS.has(interval)
      ? interval
      : DEFAULT_CONFIGURATION.refreshIntervalMinutes,
  }
  if (!Storage.set(CONFIGURATION_KEY, normalized)) {
    throw new Error("刷新设置保存失败")
  }
}

export function saveBroadnetDataCache(data: BroadnetUsage): string {
  const updatedAt = data.updatedAt || new Date().toISOString()
  const cache: BroadnetDataCache = {
    data: { ...data, updatedAt },
    updatedAt,
  }
  if (!Storage.set(DATA_CACHE_KEY, cache)) {
    throw new Error("套餐数据缓存失败")
  }
  return updatedAt
}

export function loadBroadnetDataCache(): BroadnetDataCache | null {
  const stored = Storage.get<{ data?: unknown; updatedAt?: unknown }>(
    DATA_CACHE_KEY,
  )
  if (!stored || typeof stored.updatedAt !== "string") return null
  const data = asRecord(stored.data)
  if (!data || !isBroadnetUsage(data)) return null
  return {
    data: { ...(data as unknown as BroadnetUsage), updatedAt: stored.updatedAt },
    updatedAt: stored.updatedAt,
  }
}

export function clearBroadnetDataCache(): void {
  Storage.remove(DATA_CACHE_KEY)
}

function serviceMessage(payload: Record<string, unknown> | undefined) {
  return (
    shortText(payload?.message) ||
    shortText(payload?.msg) ||
    shortText(payload?.desc)
  )
}

export function parseBroadnetUsage(payload: unknown): BroadnetUsage | null {
  const envelope = asRecord(payload)
  if (shortText(envelope?.status) !== "000000") return null
  const data = asRecord(envelope?.data)
  const userData = asRecord(data?.userData)
  if (!userData) return null

  const feeInCents = finiteNumber(userData.fee)
  const flowRemainingRaw = finiteNumber(userData.flow)
  const flowTotalRaw = finiteNumber(userData.flowAll)
  const voiceRemaining = finiteNumber(userData.voice)
  const voiceTotal = finiteNumber(userData.voiceAll)
  const flowRemaining =
    flowRemainingRaw === null ? null : rounded(flowRemainingRaw / 1048576)
  const flowTotal =
    flowTotalRaw === null ? null : rounded(flowTotalRaw / 1048576)

  return {
    balance: feeInCents === null ? null : rounded(feeInCents / 100),
    flowTotalGB: flowTotal,
    flowUsedGB: usedAmount(flowTotal, flowRemaining),
    flowRemainingGB: flowRemaining,
    flowRemainingPercent: remainingPercent(flowRemaining, flowTotal),
    voiceTotalMinutes: voiceTotal,
    voiceUsedMinutes: usedAmount(voiceTotal, voiceRemaining),
    voiceRemainingMinutes: voiceRemaining,
    voiceRemainingPercent: remainingPercent(voiceRemaining, voiceTotal),
    updatedAt: new Date().toISOString(),
  }
}

async function postBroadnet(
  headers: Record<string, string>,
  url = BROADNET_QUERY_URL,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ data: "" }),
    timeout: 12,
    debugLabel: "中国广电自动读取检测",
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error("接口响应不是JSON")
  }
  return { response, json }
}

export async function checkBroadnetRewriteStatus(): Promise<BroadnetRewriteStatusResult> {
  try {
    const handshake = await postBroadnet(
      { [BROADNET_STATUS_HEADER]: "1" },
      `${BROADNET_QUERY_URL}?cbm_status=1`,
    )
    const bridge = asRecord(handshake.json)
    const bridgeVersion = finiteNumber(bridge?.version)
    if (
      bridge?.bridge !== "ChinaBroadnetMonitor" ||
      bridgeVersion === null ||
      bridgeVersion < 2
    ) {
      const legacyQuery = await postBroadnet({
        [BROADNET_SCRIPTING_HEADER]: "1",
      })
      const legacyPayload = asRecord(legacyQuery.json)
      const legacyStatus = shortText(legacyPayload?.status)
      const legacyUsage = parseBroadnetUsage(legacyQuery.json)
      if (legacyStatus === "000000" && legacyUsage) {
        return {
          state: "ready",
          message: "旧版重写可以读取；请更新模块以启用完整状态检测",
          serviceStatus: legacyStatus,
          usage: legacyUsage,
        }
      }
      return {
        state: "not_installed",
        message: "未检测到新版自动读取重写，请强制更新或重新安装模块",
        serviceStatus: legacyStatus || shortText(bridge?.status),
      }
    }

    if (bridge.captured !== true) {
      return {
        state: "not_captured",
        message: "重写已安装，但尚未捕获授权请求",
      }
    }

    const capturedAtValue = finiteNumber(bridge.capturedAt)
    const capturedAt =
      capturedAtValue === null
        ? undefined
        : new Date(capturedAtValue).toISOString()
    const query = await postBroadnet({ [BROADNET_SCRIPTING_HEADER]: "1" })
    const payload = asRecord(query.json)
    const status = shortText(payload?.status)
    const usage = parseBroadnetUsage(query.json)
    if (status === "000000" && usage) {
      return {
        state: "ready",
        message: "已捕获，可以自动读取",
        capturedAt,
        serviceStatus: status,
        usage,
      }
    }

    const message = serviceMessage(payload)
    const authFailure =
      status === "000001" || /登录|认证|授权|access|token|失效|过期/i.test(message)
    if (authFailure) {
      return {
        state: "credential_expired",
        message: "已捕获的授权信息失效，请重新打开广电App或小程序",
        capturedAt,
        serviceStatus: status,
      }
    }

    return {
      state: "network_error",
      message: message || "中国广电接口返回异常",
      capturedAt,
      serviceStatus: status,
    }
  } catch (error) {
    const details = errorDetails(error)
    return {
      state: "network_error",
      message: `${details.name}：${details.message}`,
    }
  }
}

export async function refreshBroadnetData(): Promise<BroadnetRefreshResult> {
  const cache = loadBroadnetDataCache()
  const result = await checkBroadnetRewriteStatus()
  if (result.state === "ready" && result.usage) {
    const updatedAt = saveBroadnetDataCache(result.usage)
    return { ok: true, data: result.usage, updatedAt }
  }

  return {
    ok: false,
    state: result.state === "ready" ? "network_error" : result.state,
    message:
      result.state === "ready"
        ? "接口未返回可用的套餐数据"
        : result.message,
    cachedData: cache?.data,
    cachedAt: cache?.updatedAt,
    stale: Boolean(cache),
  }
}

function errorDetails(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name || "Error", message: error.message }
    : { name: "Error", message: String(error) }
}

export async function probeBroadnetEndpoint(): Promise<BroadnetNetworkProbeResult> {
  try {
    const response = await fetch(BROADNET_QUERY_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: "" }),
      timeout: 12,
      debugLabel: "中国广电网络兼容性检测",
    })
    const text = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        reachable: true,
        httpStatus: response.status,
        contentType: response.headers.get("content-type") ?? "",
        responseKind: "text",
      }
    }

    const payload = asRecord(parsed)
    return {
      reachable: true,
      httpStatus: response.status,
      contentType: response.headers.get("content-type") ?? "",
      responseKind: "json",
      serviceStatus: shortText(payload?.status),
      serviceMessage: serviceMessage(payload),
    }
  } catch (error) {
    const details = errorDetails(error)
    return {
      reachable: false,
      errorName: details.name,
      errorMessage: details.message,
    }
  }
}
