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
} from "scripting"
import {
  clearLoginState,
  clearSavedToken,
  getSavedServicePassword,
  hasSavedLogin,
  loadTelecomConfiguration,
  loadTelecomDataCache,
  loadTelecomLoginInfo,
  loginChinaTelecom,
  queryImportantData,
  saveAuthenticatedLogin,
  saveTelecomDataCache,
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
    } catch (error) {
      setLoginSaved(hasSavedLogin())
      setStatus(`保存失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleManualRefresh = async () => {
    if (busy) return
    const configuration = loadTelecomConfiguration()
    const loginInfo = loadTelecomLoginInfo()
    if (!configuration.phoneNumber || !loginInfo) {
      setStatus("没有有效登录状态，请先登录并保存")
      return
    }

    setBusy(true)
    setStatus("正在刷新套餐数据…")
    try {
      const result = await queryImportantData(
        configuration.phoneNumber,
        loginInfo,
      )
      if (!result.ok) {
        if (result.code === "X201") {
          clearSavedToken()
          setLoginSaved(false)
        }
        setStatus(`刷新失败（${result.code}）：${result.message}`)
        return
      }

      const updatedAt = saveTelecomDataCache(result.data)
      setLastRefreshAt(updatedAt)
      setStatus("套餐数据刷新成功")
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
      </Form>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<SettingsPage />)
  Script.exit()
}

run()
