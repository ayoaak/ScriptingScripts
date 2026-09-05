import {
  Button,
  Form,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Text,
  useState,
} from "scripting"
import {
  BROADNET_QUERY_URL,
  checkBroadnetRewriteStatus,
  probeBroadnetEndpoint,
  type BroadnetNetworkProbeResult,
  type BroadnetRewriteStatusResult,
} from "./broadnet"

const LOON_PLUGIN_URL =
  "https://raw.githubusercontent.com/ayoaak/ScriptingScripts/test/ChinaBroadnetMonitor/rewrite/ChinaBroadnet.plugin?v=0.3.1"
const SURGE_MODULE_URL =
  "https://raw.githubusercontent.com/ayoaak/ScriptingScripts/test/ChinaBroadnetMonitor/rewrite/ChinaBroadnet.sgmodule?v=0.3.1"
const SHARED_REWRITE_JS_URL =
  "https://raw.githubusercontent.com/ayoaak/ScriptingScripts/test/ChinaBroadnetMonitor/rewrite/broadnet-capture.js?v=0.3.1"
const BROADNET_MITM_HOST = "wx.10099.com.cn"

type ProxyInstaller = {
  name: "Loon" | "Surge"
  resourceURL: string
  installURL: string
  openURL: string
}

const PROXY_INSTALLERS: ProxyInstaller[] = [
  {
    name: "Loon",
    resourceURL: LOON_PLUGIN_URL,
    installURL: `https://www.nsloon.com/openloon/import?plugin=${encodeURIComponent(LOON_PLUGIN_URL)}`,
    openURL: "loon://",
  },
  {
    name: "Surge",
    resourceURL: SURGE_MODULE_URL,
    installURL: `surge:///install-module?url=${encodeURIComponent(SURGE_MODULE_URL)}`,
    openURL: "surge:///",
  },
]

function SettingsPage() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("尚未检测")
  const [result, setResult] = useState<BroadnetNetworkProbeResult | null>(null)
  const [installStatus, setInstallStatus] = useState("尚未安装")
  const [rewriteBusy, setRewriteBusy] = useState(false)
  const [rewriteResult, setRewriteResult] =
    useState<BroadnetRewriteStatusResult | null>(null)

  const copyPublicText = async (value: string, successMessage: string) => {
    await Pasteboard.setString(value)
    setInstallStatus(successMessage)
  }

  const copyAndOpen = async (installer: ProxyInstaller) => {
    await Pasteboard.setString(installer.resourceURL)
    setInstallStatus(`${installer.name}模块地址已复制`)
    let opened = false
    try {
      opened = await Safari.openURL(installer.openURL)
    } catch {
      opened = false
    }
    await Dialog.alert({
      title: opened ? `已打开${installer.name}` : `无法打开${installer.name}`,
      message: opened
        ? `模块地址已复制，请在${installer.name}的模块或插件页面粘贴并添加。`
        : `模块地址已复制到剪贴板。请确认已经安装${installer.name}，再前往模块或插件页面粘贴添加。`,
      buttonLabel: "知道了",
    })
  }

  const installProxyModule = async (installer: ProxyInstaller) => {
    try {
      const opened = await Safari.openURL(installer.installURL)
      if (opened) {
        setInstallStatus(`已将安装请求交给${installer.name}`)
        return
      }
    } catch {
      // URL Scheme 不可用时进入复制回退。
    }
    await copyAndOpen(installer)
  }

  const handleInstallAssistant = async () => {
    const selection = await Dialog.actionSheet({
      title: "安装自动读取模块",
      message:
        "选择代理软件后将尝试一键安装；如果系统无法跳转，会复制对应模块地址并尝试打开代理软件。",
      actions: [
        { label: "Loon 一键安装" },
        { label: "Surge 一键安装" },
        { label: "复制 Loon 插件地址" },
        { label: "复制 Surge 模块地址" },
      ],
    })

    if (selection === 0) await installProxyModule(PROXY_INSTALLERS[0])
    if (selection === 1) await installProxyModule(PROXY_INSTALLERS[1])
    if (selection === 2) await copyAndOpen(PROXY_INSTALLERS[0])
    if (selection === 3) await copyAndOpen(PROXY_INSTALLERS[1])
  }

  const handleRewriteStatus = async () => {
    if (rewriteBusy) return
    setRewriteBusy(true)
    setRewriteResult(null)
    try {
      setRewriteResult(await checkBroadnetRewriteStatus())
    } finally {
      setRewriteBusy(false)
    }
  }

  const displayNumber = (value: number | null, unit: string) =>
    value === null ? "--" : `${value}${unit}`

  const rewriteStateTitle = (
    state: BroadnetRewriteStatusResult["state"],
  ) => {
    if (state === "not_installed") return "未安装重写"
    if (state === "not_captured") return "已安装，但尚未捕获凭据"
    if (state === "ready") return "已捕获，可以自动读取"
    if (state === "credential_expired") return "凭据已经失效"
    return "网络或接口异常"
  }

  const handleProbe = async () => {
    if (busy) return
    setBusy(true)
    setStatus("正在检测中国广电接口…")
    try {
      const probe = await probeBroadnetEndpoint()
      setResult(probe)
      if (!probe.reachable) {
        setStatus("接口连接失败")
      } else if (probe.responseKind !== "json") {
        setStatus("接口可以连接，但响应不是JSON")
      } else {
        setStatus("接口连接及JSON响应正常")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <NavigationStack>
      <Form
        navigationTitle="中国广电"
        navigationBarTitleDisplayMode="large"
      >
        <Section
          header={<Text>网络兼容性</Text>}
          footer={
            <Text font="caption" foregroundStyle="secondary">
              本检测只发送空data，不携带access、手机号、Cookie或其他会话信息。收到业务错误码也表示网络和POST通道已经连通。
            </Text>
          }
        >
          <Button
            title={busy ? "检测中…" : "运行网络兼容性测试"}
            systemImage="network"
            action={handleProbe}
          />
          <Text>当前状态：{status}</Text>
        </Section>

        <Section header={<Text>检测目标</Text>}>
          <Text>请求方式：POST JSON</Text>
          <Text>超时时间：12秒</Text>
          <Text>{BROADNET_QUERY_URL}</Text>
        </Section>

        <Section
          header={<Text>自动读取</Text>}
          footer={
            <Text font="caption" foregroundStyle="secondary">
              安装后请在代理软件中启用脚本、重写和MITM，并安装及信任HTTPS证书；随后打开中国广电App或小程序进入套餐页面，让重写捕获当前设备的授权请求。模块不会把access或data复制到Scripting。
            </Text>
          }
        >
          <Button
            title="安装/更新重写模块"
            systemImage="square.and.arrow.down"
            action={handleInstallAssistant}
          />
          <Button
            title={rewriteBusy ? "检测中…" : "检查自动读取状态"}
            systemImage="checkmark.shield"
            action={handleRewriteStatus}
          />
          <Text>安装状态：{installStatus}</Text>
          <Button
            title="复制共享 JS 链接"
            systemImage="doc.on.doc"
            action={() =>
              copyPublicText(SHARED_REWRITE_JS_URL, "共享JS链接已复制")
            }
          />
          <Button
            title="复制 MITM 主机"
            systemImage="lock.shield"
            action={() =>
              copyPublicText(BROADNET_MITM_HOST, "MITM主机已复制")
            }
          />
        </Section>

        {rewriteResult ? (
          <Section header={<Text>自动读取状态</Text>}>
            <Text>状态：{rewriteStateTitle(rewriteResult.state)}</Text>
            <Text>说明：{rewriteResult.message}</Text>
            {rewriteResult.serviceStatus ? (
              <Text>业务状态：{rewriteResult.serviceStatus}</Text>
            ) : null}
            {rewriteResult.capturedAt ? (
              <Text>
                最近捕获：{new Date(rewriteResult.capturedAt).toLocaleString()}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {rewriteResult?.usage ? (
          <Section header={<Text>统一数据</Text>}>
            <Text>
              余额：{displayNumber(rewriteResult.usage.balance, "元")}
            </Text>
            <Text>
              套餐流量：{displayNumber(rewriteResult.usage.flowTotalGB, "GB")}
            </Text>
            <Text>
              已用流量：{displayNumber(rewriteResult.usage.flowUsedGB, "GB")}
            </Text>
            <Text>
              剩余流量：{displayNumber(rewriteResult.usage.flowRemainingGB, "GB")}
            </Text>
            <Text>
              流量剩余比例：{displayNumber(rewriteResult.usage.flowRemainingPercent, "%")}
            </Text>
            <Text>
              语音总量：{displayNumber(rewriteResult.usage.voiceTotalMinutes, "分钟")}
            </Text>
            <Text>
              已用语音：{displayNumber(rewriteResult.usage.voiceUsedMinutes, "分钟")}
            </Text>
            <Text>
              剩余语音：{displayNumber(rewriteResult.usage.voiceRemainingMinutes, "分钟")}
            </Text>
            <Text>
              语音剩余比例：{displayNumber(rewriteResult.usage.voiceRemainingPercent, "%")}
            </Text>
            <Text>
              更新时间：{new Date(rewriteResult.usage.updatedAt).toLocaleString()}
            </Text>
          </Section>
        ) : null}

        {result ? (
          <Section header={<Text>检测结果</Text>}>
            <Text>网络连接：{result.reachable ? "成功" : "失败"}</Text>
            {result.httpStatus !== undefined ? (
              <Text>HTTP状态：{result.httpStatus}</Text>
            ) : null}
            {result.responseKind ? (
              <Text>响应格式：{result.responseKind.toUpperCase()}</Text>
            ) : null}
            {result.contentType ? (
              <Text>Content-Type：{result.contentType}</Text>
            ) : null}
            {result.serviceStatus ? (
              <Text>业务状态：{result.serviceStatus}</Text>
            ) : null}
            {result.serviceMessage ? (
              <Text>业务提示：{result.serviceMessage}</Text>
            ) : null}
            {!result.reachable ? (
              <Text>
                错误：{result.errorName ?? "Error"} · {result.errorMessage ?? "未知错误"}
              </Text>
            ) : null}
          </Section>
        ) : null}

        <Section header={<Text>项目状态</Text>}>
          <Text>第一步：独立项目已建立</Text>
          <Text>第二步：无凭据网络检测已通过</Text>
          <Text>第三步：Loon/Surge自动读取重写已建立</Text>
          <Text>第四步：原生安装助手已建立</Text>
          <Text>第五步：重写状态检测已建立</Text>
          <Text>第六步：中国广电统一数据模型已建立</Text>
          <Text>配置缓存和小组件真实刷新将在后续步骤加入</Text>
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
