export const TELECOM_LOGIN_URL =
  "https://appgologin.189.cn:9031/login/client/userLoginNormal"
export const TELECOM_QUERY_URL =
  "https://appfuwu.189.cn:9021/query/qryImportantData"

const LOGIN_CLIENT_TYPE = "#12.2.0#channel50#iPhone 14 Pro#"
const QUERY_CLIENT_TYPE = "#12.2.0#channel50#iPhone 14 Pro#"
const SYSTEM_VERSION = "13.2.3"
const LOGIN_DEVICE_DESCRIPTION = "iPhone 14 13.2."
const SHOP_ID = "20002"
const SOURCE = "110003"
const SOURCE_PASSWORD = "Sid98s"
const COMMON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json; charset=UTF-8",
  Connection: "Keep-Alive",
  "Accept-Encoding": "gzip",
}

const RSA_MODULUS = BigInt(
  "0xc190b4f5e53855833ebf34e97ab3c18d3e87dd5b359b0a45a791a026eced8b8e43351fb74cbf3922a9dc54d368da9864472d7fd934c0971e73dc5bfb0386214204dd7ca85bf2f20e9561bf50b6ba08d3d7b5efab3e642b62bfb85b8a7d9c0938fdf625299c4968666d7d9701f2a3af6ee543223cca6ad3f5ca04ef2562137f83",
)
const RSA_EXPONENT = 65537n
const RSA_BLOCK_BYTES = 128

export interface TelecomUsage {
  balance: number
  flowTotal: number
  flowUsed: number
  flowRemaining: number
  flowPercent: number
  voiceTotal: number
  voiceUsed: number
  voiceRemaining: number
  voicePercent: number
  updatedAt: string
}

export interface TelecomConfiguration {
  phoneNumber: string
  trustedDeviceId?: string
  refreshIntervalMinutes: number
}

export interface TelecomDataCache {
  data: Record<string, unknown>
  updatedAt: string
}

export interface TelecomLoginInfo extends Record<string, unknown> {
  token: string
  provinceCode?: string
  cityCode?: string
}

export type TelecomKnownErrorCode =
  | "3001"
  | "3005"
  | "3006"
  | "3007"
  | "3008"
  | "3009"
  | "X201"

export interface TelecomFailure {
  ok: false
  code: string
  message: string
  payload?: Record<string, unknown>
}

export interface TelecomLoginSuccess {
  ok: true
  loginInfo: TelecomLoginInfo
  payload: Record<string, unknown>
}

export interface TelecomQuerySuccess {
  ok: true
  data: Record<string, unknown>
  payload: Record<string, unknown>
}

export type TelecomLoginResult = TelecomLoginSuccess | TelecomFailure
export type TelecomQueryResult = TelecomQuerySuccess | TelecomFailure

export interface NetworkProbeResult {
  name: string
  url: string
  reachable: boolean
  status?: number
  contentType?: string
  responseKind?: "json" | "text"
  responsePreview?: string
  errorName?: string
  errorMessage?: string
}

export const EMPTY_TELECOM_USAGE: TelecomUsage = {
  balance: 0,
  flowTotal: 0,
  flowUsed: 0,
  flowRemaining: 0,
  flowPercent: 0,
  voiceTotal: 0,
  voiceUsed: 0,
  voiceRemaining: 0,
  voicePercent: 0,
  updatedAt: "",
}

const CONFIGURATION_KEY = "china-telecom.configuration.v1"
const SESSION_METADATA_KEY = "china-telecom.session-metadata.v1"
const DATA_CACHE_KEY = "china-telecom.data-cache.v1"
const DEVICE_UID_KEY = "china-telecom.device-uid.v1"
const PASSWORD_KEY = "china-telecom.service-password.v1"
const TOKEN_KEY = "china-telecom.token.v1"
const KEYCHAIN_OPTIONS = {
  accessibility: "first_unlock_this_device" as const,
  synchronizable: false,
}
const DEFAULT_CONFIGURATION: TelecomConfiguration = {
  phoneNumber: "",
  trustedDeviceId: "",
  refreshIntervalMinutes: 30,
}
const ALLOWED_REFRESH_INTERVALS = new Set([15, 30, 60, 120])

function restoreKeychainValue(key: string, value: string | null): void {
  if (value === null) {
    Keychain.remove(key, KEYCHAIN_OPTIONS)
  } else {
    Keychain.set(key, value, KEYCHAIN_OPTIONS)
  }
}

export function loadTelecomConfiguration(): TelecomConfiguration {
  const stored = Storage.get<Partial<TelecomConfiguration>>(CONFIGURATION_KEY)
  if (!stored || typeof stored !== "object") return { ...DEFAULT_CONFIGURATION }

  const refreshIntervalMinutes = Number(stored.refreshIntervalMinutes)
  return {
    phoneNumber:
      typeof stored.phoneNumber === "string" ? stored.phoneNumber.trim() : "",
    trustedDeviceId:
      typeof stored.trustedDeviceId === "string"
        ? stored.trustedDeviceId.trim()
        : "",
    refreshIntervalMinutes: ALLOWED_REFRESH_INTERVALS.has(
      refreshIntervalMinutes,
    )
      ? refreshIntervalMinutes
      : DEFAULT_CONFIGURATION.refreshIntervalMinutes,
  }
}

export function getSavedServicePassword(): string {
  return Keychain.get(PASSWORD_KEY, KEYCHAIN_OPTIONS) ?? ""
}

export function hasSavedLogin(): boolean {
  return Boolean(Keychain.get(TOKEN_KEY, KEYCHAIN_OPTIONS))
}

export function loadTelecomLoginInfo(): TelecomLoginInfo | null {
  const token = Keychain.get(TOKEN_KEY, KEYCHAIN_OPTIONS)
  if (!token) return null

  const metadata = Storage.get<{
    provinceCode?: string
    cityCode?: string
  }>(SESSION_METADATA_KEY)
  return {
    token,
    provinceCode:
      typeof metadata?.provinceCode === "string"
        ? metadata.provinceCode
        : undefined,
    cityCode:
      typeof metadata?.cityCode === "string" ? metadata.cityCode : undefined,
  }
}

export function saveAuthenticatedLogin(
  configuration: TelecomConfiguration,
  password: string,
  loginInfo: TelecomLoginInfo,
): void {
  const normalizedConfiguration: TelecomConfiguration = {
    phoneNumber: configuration.phoneNumber.trim(),
    trustedDeviceId: configuration.trustedDeviceId?.trim() ?? "",
    refreshIntervalMinutes: ALLOWED_REFRESH_INTERVALS.has(
      configuration.refreshIntervalMinutes,
    )
      ? configuration.refreshIntervalMinutes
      : DEFAULT_CONFIGURATION.refreshIntervalMinutes,
  }
  const oldPassword = Keychain.get(PASSWORD_KEY, KEYCHAIN_OPTIONS)
  const oldToken = Keychain.get(TOKEN_KEY, KEYCHAIN_OPTIONS)
  const oldConfiguration = Storage.get(CONFIGURATION_KEY)
  const oldMetadata = Storage.get(SESSION_METADATA_KEY)

  try {
    if (!Keychain.set(PASSWORD_KEY, password, KEYCHAIN_OPTIONS)) {
      throw new Error("服务密码写入系统钥匙串失败")
    }
    if (!Keychain.set(TOKEN_KEY, loginInfo.token, KEYCHAIN_OPTIONS)) {
      throw new Error("登录 Token 写入系统钥匙串失败")
    }
    if (!Storage.set(CONFIGURATION_KEY, normalizedConfiguration)) {
      throw new Error("普通设置保存失败")
    }
    if (
      !Storage.set(SESSION_METADATA_KEY, {
        provinceCode: loginInfo.provinceCode ?? "",
        cityCode: loginInfo.cityCode ?? "",
      })
    ) {
      throw new Error("登录地区信息保存失败")
    }
  } catch (error) {
    restoreKeychainValue(PASSWORD_KEY, oldPassword)
    restoreKeychainValue(TOKEN_KEY, oldToken)
    if (oldConfiguration === null) Storage.remove(CONFIGURATION_KEY)
    else Storage.set(CONFIGURATION_KEY, oldConfiguration)
    if (oldMetadata === null) Storage.remove(SESSION_METADATA_KEY)
    else Storage.set(SESSION_METADATA_KEY, oldMetadata)
    throw error
  }
}

export function clearSavedToken(): void {
  Keychain.remove(TOKEN_KEY, KEYCHAIN_OPTIONS)
  Storage.remove(SESSION_METADATA_KEY)
}

export function clearLoginState(): void {
  Keychain.remove(PASSWORD_KEY, KEYCHAIN_OPTIONS)
  clearSavedToken()
}

export function saveTelecomDataCache(data: Record<string, unknown>): string {
  const updatedAt = new Date().toISOString()
  const cache: TelecomDataCache = { data, updatedAt }
  if (!Storage.set(DATA_CACHE_KEY, cache)) {
    throw new Error("套餐数据缓存失败")
  }
  return updatedAt
}

export function loadTelecomDataCache(): TelecomDataCache | null {
  const cache = Storage.get<TelecomDataCache>(DATA_CACHE_KEY)
  if (
    !cache ||
    typeof cache !== "object" ||
    typeof cache.updatedAt !== "string" ||
    !cache.data ||
    typeof cache.data !== "object"
  ) {
    return null
  }
  return cache
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function childRecord(
  parent: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  return asRecord(parent?.[key])
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function errorDetails(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name || "Error", message: error.message }
    : { name: "Error", message: String(error) }
}

function sanitizedPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180)
}

export function shiftTelecomText(value: string, encode = true): string {
  const offset = encode ? 2 : -2
  let result = ""
  for (const character of value) {
    result += String.fromCharCode((character.charCodeAt(0) + offset) & 0xffff)
  }
  return result
}

function twoDigits(value: number): string {
  return value.toString().padStart(2, "0")
}

export function formatTelecomTimestamp(date = new Date()): string {
  return [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
    twoDigits(date.getHours()),
    twoDigits(date.getMinutes()),
    "00",
  ].join("")
}

export function formatTelecomLoginTimestamp(date = new Date()): string {
  return [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
    twoDigits(date.getHours()),
    twoDigits(date.getMinutes()),
    twoDigits(date.getSeconds()),
  ].join("")
}

export function buildStableDeviceUid(phoneNumber: string): string {
  return `3${phoneNumber}0000`.slice(0, 16)
}

export function getOrCreateStableDeviceUid(): string {
  const stored = Storage.get<string>(DEVICE_UID_KEY)
  if (stored && /^\d{16}$/.test(stored)) return stored

  const bytes = Crypto.generateSymmetricKey(256).toUint8Array()
  if (!bytes || bytes.length < 16) {
    throw new Error("无法生成稳定设备标识")
  }
  let deviceUid = ""
  for (let index = 0; index < 16; index += 1) {
    deviceUid += String(bytes[index] % 10)
  }
  if (!Storage.set(DEVICE_UID_KEY, deviceUid)) {
    throw new Error("稳定设备标识保存失败")
  }
  return deviceUid
}

function utf8Bytes(value: string): Uint8Array {
  const bytes = Data.fromRawString(value, "utf-8")?.toUint8Array()
  if (!bytes) throw new Error("无法把登录明文转换为 UTF-8 数据")
  return bytes
}

function secureNonZeroRandomBytes(length: number): Uint8Array {
  const output = new Uint8Array(length)
  let cursor = 0
  while (cursor < length) {
    const block = Crypto.generateSymmetricKey(256).toUint8Array()
    if (!block) throw new Error("无法生成 RSA 安全填充数据")
    for (const byte of block) {
      if (byte !== 0) {
        output[cursor++] = byte
        if (cursor === length) break
      }
    }
  }
  return output
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  return value
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let remaining = value
  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  if (remaining !== 0n) throw new Error("RSA 密文长度超出公钥块大小")
  return bytes
}

function modularPower(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n
  let currentBase = base % modulus
  let currentExponent = exponent
  while (currentExponent > 0n) {
    if ((currentExponent & 1n) === 1n) {
      result = (result * currentBase) % modulus
    }
    currentExponent >>= 1n
    currentBase = (currentBase * currentBase) % modulus
  }
  return result
}

export function rsaPkcs1v15Encrypt(plainText: string): string {
  const message = utf8Bytes(plainText)
  if (message.length > RSA_BLOCK_BYTES - 11) {
    throw new Error(`RSA 登录明文不能超过 ${RSA_BLOCK_BYTES - 11} 字节`)
  }
  const padding = secureNonZeroRandomBytes(RSA_BLOCK_BYTES - message.length - 3)
  const encoded = new Uint8Array(RSA_BLOCK_BYTES)
  encoded[0] = 0
  encoded[1] = 2
  encoded.set(padding, 2)
  encoded[2 + padding.length] = 0
  encoded.set(message, 3 + padding.length)

  const encrypted = modularPower(
    bytesToBigInt(encoded),
    RSA_EXPONENT,
    RSA_MODULUS,
  )
  const data = Data.fromUint8Array(bigIntToBytes(encrypted, RSA_BLOCK_BYTES))
  if (!data) throw new Error("无法生成 RSA 密文")
  return data.toBase64String()
}

function telecomErrorMessage(code: string, fallback: string): string {
  const messages: Record<TelecomKnownErrorCode, string> = {
    "3001": "手机号或服务密码错误，或登录签名校验未通过",
    "3005": "服务端要求验证码或二次校验，当前版本不能提交验证码",
    "3006": "设备未受信任，请填写有效的设备信任 ID",
    "3007": "登录过于频繁，请稍后再试",
    "3008": "账号已被锁定，请通过中国电信官方渠道处理",
    "3009": "服务密码已被锁定，请通过中国电信官方渠道处理",
    X201: "登录 Token 已失效，需要重新登录",
  }
  return messages[code as TelecomKnownErrorCode] ?? fallback
}

function responseError(
  payload: Record<string, unknown>,
  fallback: string,
): TelecomFailure {
  const responseData = childRecord(payload, "responseData")
  const data = childRecord(responseData, "data")
  const loginFailure = childRecord(data, "loginFailResult")
  const headerInfos = childRecord(payload, "headerInfos")
  const code =
    stringValue(responseData?.resultCode) ||
    stringValue(headerInfos?.code) ||
    "UNKNOWN"
  const upstreamMessage =
    stringValue(loginFailure?.reason) ||
    stringValue(responseData?.resultDesc) ||
    stringValue(responseData?.resultMsg) ||
    stringValue(responseData?.msg) ||
    stringValue(headerInfos?.reason) ||
    fallback
  return {
    ok: false,
    code,
    message: telecomErrorMessage(code, upstreamMessage),
    payload,
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  debugLabel: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
    timeout: 30,
    debugLabel,
  })
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      `${debugLabel} 返回非 JSON 内容（HTTP ${response.status}）：${sanitizedPreview(text)}`,
    )
  }
  const payload = asRecord(parsed)
  if (!payload) throw new Error(`${debugLabel} 返回内容不是 JSON 对象`)
  return payload
}

async function probeEndpoint(name: string, url: string): Promise<NetworkProbeResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: "{}",
      timeout: 12,
      debugLabel: `中国电信网络检测-${name}`,
    })
    const text = await response.text()
    let responseKind: "json" | "text" = "text"
    try {
      JSON.parse(text)
      responseKind = "json"
    } catch {}
    return {
      name,
      url,
      reachable: true,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      responseKind,
      responsePreview: sanitizedPreview(text),
    }
  } catch (error) {
    const details = errorDetails(error)
    return {
      name,
      url,
      reachable: false,
      errorName: details.name,
      errorMessage: details.message,
    }
  }
}

export async function probeTelecomEndpoints(): Promise<NetworkProbeResult[]> {
  return Promise.all([
    probeEndpoint("登录接口", TELECOM_LOGIN_URL),
    probeEndpoint("套餐查询接口", TELECOM_QUERY_URL),
  ])
}

export async function loginChinaTelecom(
  phoneNumber: string,
  password: string,
  trustedDeviceId = "",
): Promise<TelecomLoginResult> {
  if (!/^\d{11}$/.test(phoneNumber)) {
    return { ok: false, code: "INVALID_PHONE", message: "手机号必须为 11 位数字" }
  }
  if (!password) {
    return { ok: false, code: "EMPTY_PASSWORD", message: "服务密码不能为空" }
  }

  const timestamp = formatTelecomLoginTimestamp()
  const deviceId = trustedDeviceId.trim()
  const deviceUid = getOrCreateStableDeviceUid()
  const signDeviceId = deviceId
    ? deviceId.slice(0, 12)
    : deviceUid.slice(0, 12)
  const plainText =
    LOGIN_DEVICE_DESCRIPTION +
    `${signDeviceId}${phoneNumber}${timestamp}${password}0$$$0.`
  const body = {
    content: {
      fieldData: {
        accountType: "",
        authentication: shiftTelecomText(password),
        deviceUid,
        isChinatelecom: "",
        loginAuthCipherAsymmertric: rsaPkcs1v15Encrypt(plainText),
        loginType: "4",
        phoneNum: shiftTelecomText(phoneNumber),
        systemVersion: SYSTEM_VERSION,
        androidId: deviceId ? shiftTelecomText(deviceId) : "",
      },
      attach: "test",
    },
    headerInfos: {
      code: "userLoginNormal",
      clientType: LOGIN_CLIENT_TYPE,
      timestamp,
      shopId: SHOP_ID,
      source: SOURCE,
      sourcePassword: SOURCE_PASSWORD,
      userLoginName: shiftTelecomText(phoneNumber),
    },
  }

  try {
    const payload = await postJson(TELECOM_LOGIN_URL, body, "中国电信登录")
    const responseData = childRecord(payload, "responseData")
    if (stringValue(responseData?.resultCode) !== "0000") {
      return responseError(payload, "登录失败")
    }
    const loginInfo = childRecord(childRecord(responseData, "data"), "loginSuccessResult")
    const token = stringValue(loginInfo?.token)
    if (!loginInfo || !token) {
      return {
        ok: false,
        code: "MISSING_TOKEN",
        message: "登录响应成功但没有返回 Token",
        payload,
      }
    }
    return { ok: true, loginInfo: { ...loginInfo, token }, payload }
  } catch (error) {
    const details = errorDetails(error)
    return {
      ok: false,
      code: details.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      message: details.message,
    }
  }
}

export async function queryImportantData(
  phoneNumber: string,
  loginInfo: TelecomLoginInfo,
): Promise<TelecomQueryResult> {
  const timestamp = formatTelecomTimestamp()
  const body = {
    content: {
      fieldData: {
        provinceCode: stringValue(loginInfo.provinceCode) || "600101",
        cityCode: stringValue(loginInfo.cityCode) || "8441900",
        shopId: SHOP_ID,
        isChinatelecom: "0",
        account: shiftTelecomText(phoneNumber),
      },
    },
    headerInfos: {
      code: "qryImportantData",
      clientType: QUERY_CLIENT_TYPE,
      timestamp,
      shopId: SHOP_ID,
      source: SOURCE,
      sourcePassword: SOURCE_PASSWORD,
      userLoginName: shiftTelecomText(phoneNumber),
      token: loginInfo.token,
    },
  }

  try {
    const payload = await postJson(TELECOM_QUERY_URL, body, "中国电信套餐查询")
    const responseData = childRecord(payload, "responseData")
    const headerInfos = childRecord(payload, "headerInfos")
    const code =
      stringValue(responseData?.resultCode) || stringValue(headerInfos?.code)
    if (code === "X201") return responseError(payload, "Token 已失效")
    const data = childRecord(responseData, "data")
    return data
      ? { ok: true, data, payload }
      : responseError(payload, "套餐查询未返回数据")
  } catch (error) {
    const details = errorDetails(error)
    return {
      ok: false,
      code: details.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      message: details.message,
    }
  }
}
