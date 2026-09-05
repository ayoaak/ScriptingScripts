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
  probeBroadnetEndpoint,
  type BroadnetNetworkProbeResult,
} from "./broadnet"

function SettingsPage() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("尚未检测")
  const [result, setResult] = useState<BroadnetNetworkProbeResult | null>(null)

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
          <Text>第二步：无凭据网络检测已就绪</Text>
          <Text>账户、会话保存和真实数据查询将在后续步骤加入</Text>
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
