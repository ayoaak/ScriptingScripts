import {
  List,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Text,
} from "scripting"
import { probeTelecomEndpoints, rsaPkcs1v15Encrypt } from "./telecom"
import type { NetworkProbeResult } from "./telecom"

function resultSummary(result: NetworkProbeResult): string {
  if (!result.reachable) {
    return `连接失败：${result.errorName ?? "Error"} ${result.errorMessage ?? "未知错误"}`
  }
  return `连接成功：HTTP ${result.status ?? "-"}，响应格式 ${result.responseKind ?? "未知"}`
}

function CompatibilityPage({
  results,
  rsaReady,
}: {
  results: NetworkProbeResult[]
  rsaReady: boolean
}) {
  const login = results[0]
  const query = results[1]

  return (
    <NavigationStack>
      <List
        navigationTitle="中国电信"
        navigationBarTitleDisplayMode="large"
      >
        <Section title="第2步：网络兼容性">
          <Text>{resultSummary(login)}</Text>
          <Text>{resultSummary(query)}</Text>
        </Section>
        <Section title="响应摘要">
          <Text>{login.responsePreview || "登录接口没有可显示的响应"}</Text>
          <Text>{query.responsePreview || "查询接口没有可显示的响应"}</Text>
        </Section>
        <Section title="第3步：认证算法">
          <Text>
            {rsaReady
              ? "RSA PKCS#1 v1.5 本地加密已就绪"
              : "RSA 本地自检失败"}
          </Text>
          <Text>已实现字符偏移、稳定设备标识、时间戳、登录、Token提取和错误码识别</Text>
          <Text>本页检测不发送手机号、密码或Token</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  const results = await probeTelecomEndpoints()
  let rsaReady = false
  try {
    rsaReady = rsaPkcs1v15Encrypt("ChinaTeleMonitor").length === 172
  } catch (error) {
    console.error("RSA自检失败", error)
  }

  await Navigation.present(
    <CompatibilityPage results={results} rsaReady={rsaReady} />,
  )
  Script.exit()
}

run()
