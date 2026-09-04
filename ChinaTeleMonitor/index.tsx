import {
  Button,
  Form,
  Navigation,
  NavigationStack,
  Picker,
  Script,
  SecureField,
  Section,
  Text,
  TextField,
  useState,
  Widget,
} from "scripting"
import {
  clearLoginState,
  getSavedServicePassword,
  hasSavedLogin,
  loadTelecomConfiguration,
  loadTelecomDataCache,
  loginChinaTelecom,
  refreshTelecomData,
  saveAuthenticatedLogin,
  type TelecomUsage,
} from "./telecom"

function maskedPhone(phoneNumber: string): string {
  return /^\d{11}$/.test(phoneNumber)
    ? `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`
    : "当前账号"
}

function displayTime(isoTime: string): string {
  if (!isoTime) return "尚未刷新"
  const date = new Date(isoTime)
  return Number.isNaN(date.getTime()) ? "尚未刷新" : date.toLocaleString()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function displayNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace(/\.00$/, "")
}

function SettingsPage() {
  const initialConfiguration = loadTelecomConfiguration()
  const initialCache = loadTelecomDataCache()
  const [phoneNumber, setPhoneNumber] = useState(initialConfiguration.phoneNumber)
  const [password, setPassword] = useState(getSavedServicePassword())
  const [trustedDeviceId, setTrustedDeviceId] = useState(
    initialConfiguration.trustedDeviceId ?? "",
  )
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState(
    initialConfiguration.refreshIntervalMinutes,
  )
  const [loginSaved, setLoginSaved] = useState(hasSavedLogin())
  const [lastRefreshAt, setLastRefreshAt] = useState(
    initialCache?.updatedAt ?? "",
  )
  const [usage, setUsage] = useState<TelecomUsage | null>(
    initialCache?.data ?? null,
  )
  const [status, setStatus] = useState(
    hasSavedLogin() ? "登录信息已安全保存" : "请填写账号并登录",
  )
  const [busy, setBusy] = useState(false)

  const handleLoginAndSave = async () => {
    if (busy) return
    const normalizedPhone = phoneNumber.trim()
    const normalizedDeviceId = trustedDeviceId.trim()
    setBusy(true)
    setStatus("正在验证登录…")
    try {
      const result = await loginChinaTelecom(
        normalizedPhone,
        password,
        normalizedDeviceId,
      )
      if (!result.ok) {
        setLoginSaved(hasSavedLogin())
        setStatus(`登录失败（${result.code}）：${result.message}`)
        return
      }

      saveAuthenticatedLogin(
        {
          phoneNumber: normalizedPhone,
          trustedDeviceId: normalizedDeviceId,
          refreshIntervalMinutes,
        },
        password,
        result.loginInfo,
      )
      setPhoneNumber(normalizedPhone)
      setTrustedDeviceId(normalizedDeviceId)
      setLoginSaved(true)
      setStatus(`${maskedPhone(normalizedPhone)} 登录成功，凭据已安全保存`)
      Widget.reloadAll()
    } catch (error) {
      setLoginSaved(hasSavedLogin())
      setStatus(`保存失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleManualRefresh = async () => {
    if (busy) return
    setBusy(true)
    setStatus("正在刷新套餐数据…")
    try {
      const result = await refreshTelecomData()
      if (!result.ok) {
        setLoginSaved(hasSavedLogin())
        if (result.cachedData) {
          setUsage(result.cachedData)
          setLastRefreshAt(result.cachedAt ?? result.cachedData.updatedAt)
        }
        setStatus(
          `刷新失败（${result.code}）：${result.message}${result.stale ? "，继续显示上次数据" : ""}`,
        )
        return
      }

      setUsage(result.data)
      setLastRefreshAt(result.updatedAt)
      setLoginSaved(true)
      setStatus(result.relogged ? "重新登录并刷新成功" : "套餐数据刷新成功")
      Widget.reloadAll()
    } catch (error) {
      setStatus(`刷新失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleClearLogin = () => {
    clearLoginState()
    setPassword("")
    setLoginSaved(false)
    setStatus("登录状态已清除，普通设置与套餐缓存已保留")
    Widget.reloadAll()
  }

  return (
    <NavigationStack>
      <Form
        navigationTitle="中国电信"
        navigationBarTitleDisplayMode="large"
      >
        <Section header={<Text>账号</Text>}>
          <TextField
            title="手机号"
            value={phoneNumber}
            onChanged={setPhoneNumber}
            prompt="11位中国电信手机号"
          />
          <SecureField
            title="服务密码"
            value={password}
            onChanged={setPassword}
            prompt="中国电信服务密码"
          />
          <TextField
            title="设备信任ID"
            value={trustedDeviceId}
            onChanged={setTrustedDeviceId}
            prompt="可选，设备未受信任时填写"
          />
        </Section>

        <Section header={<Text>刷新设置</Text>}>
          <Picker
            title="刷新间隔"
            value={refreshIntervalMinutes}
            onChanged={setRefreshIntervalMinutes}
            pickerStyle="menu"
          >
            <Text tag={15}>15分钟</Text>
            <Text tag={30}>30分钟</Text>
            <Text tag={60}>1小时</Text>
            <Text tag={120}>2小时</Text>
          </Picker>
        </Section>

        <Section header={<Text>操作</Text>}>
          <Button
            title={busy ? "处理中…" : "登录并保存"}
            systemImage="person.crop.circle.badge.checkmark"
            action={handleLoginAndSave}
          />
          <Button
            title={busy ? "处理中…" : "手动刷新"}
            systemImage="arrow.clockwise"
            action={handleManualRefresh}
          />
          <Button
            title="预览小号小组件"
            systemImage="rectangle"
            action={() => Widget.preview({ family: "systemSmall" })}
          />
          <Button
            title="预览中号小组件"
            systemImage="rectangle.split.3x1"
            action={() => Widget.preview({ family: "systemMedium" })}
          />
          <Button
            title="清除登录状态"
            systemImage="trash"
            role="destructive"
            action={handleClearLogin}
          />
        </Section>

        <Section header={<Text>状态</Text>}>
          <Text>{loginSaved ? "当前状态：已登录" : "当前状态：未登录"}</Text>
          <Text>{status}</Text>
          <Text>最近成功刷新：{displayTime(lastRefreshAt)}</Text>
          <Text>密码和Token仅保存在iOS钥匙串，不写入源码或普通缓存</Text>
        </Section>

        {usage ? (
          <Section header={<Text>套餐数据</Text>}>
            <Text>余额：{displayNumber(usage.balance)} 元</Text>
            <Text>本月消费：{displayNumber(usage.currentMonthCost)} 元</Text>
            <Text>
              剩余流量：{displayNumber(usage.flowRemaining)} GB（{displayNumber(usage.flowPercent, 1)}%）
            </Text>
            <Text>
              剩余语音：{displayNumber(usage.voiceRemaining, 0)} 分钟（{displayNumber(usage.voicePercent, 1)}%）
            </Text>
            <Text>积分：{displayNumber(usage.points, 0)}</Text>
          </Section>
        ) : null}
      </Form>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<SettingsPage />)
  Script.exit()
}

run()
