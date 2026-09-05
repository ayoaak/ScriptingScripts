export const BROADNET_QUERY_URL =
  "https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo"

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
      serviceMessage:
        shortText(payload?.message) ||
        shortText(payload?.msg) ||
        shortText(payload?.desc),
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
