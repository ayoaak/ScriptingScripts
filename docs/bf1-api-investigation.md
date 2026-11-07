# 战地一查询接口调查

验证日期：2026-11-07（Asia/Shanghai）。本阶段仅调查数据接口，尚未实现插件或提交 GitHub。

## 数据来源与调用方式

- 页面：https://stats.2788.pro/?name=konekoroku&game=bf1
- 检查的公开前端脚本：https://stats.2788.pro/assets/index-BHfJynwT.js
- 已实际请求成功的接口：https://stats.2788.pro/api/bf1/full?name=konekoroku
- 请求方法：GET；成功返回 application/json。
- 前端通用路径为 `/api/${game}/full?name=${encodeURIComponent(name)}`，游戏切换值为 bf1 / bfv。本次仅验证 bf1。
- name 去除首尾空格后按 URL 参数编码；演示账号并非固定参数。
- 前端没有发送 platform 参数，也没有展示 PC / Xbox / PlayStation 选择。本次无法确认服务端的平台覆盖，不应承诺主机平台支持。
- 本次命令行调用未携带 Cookie、Authorization 或 x-trace-id，仍返回 HTTP 200，说明此次查询不需要这些凭据。
- 原前端附带 x-trace-id：本地生成并保存的随机 UUID（不支持 UUID 时采用时间戳与随机字符串）。用途从命名推测为请求追踪，服务端具体用途未确认。

最小复现请求：

```sh
curl 'https://stats.2788.pro/api/bf1/full?name=konekoroku'
```

## 实测返回结构

| 字段 | 内容 | 此次样本 |
| --- | --- | --- |
| metadata | 玩家名称、personaId、userId、反作弊状态、曾用名 | KonekoRoku；2 条曾用名 |
| stats | 总体统计 | Rank 58；3193 击杀；2325 死亡 |
| weapons | 武器和载具混合数组 | 81 条：64 WEAPON，17 VEHICLE |
| reports | 对局记录 | 158 条 |
| platoons | 战队数组 | 空数组 |

### metadata

`name`、`personaId`、`userId`、`bfeac`、`bfban`、`formerNames`。

本次 bfeac、bfban 均为 null，不能将 null 渲染为“已证实无违规”。前端针对非空状态使用 status、caseUrl、banned；其非空结构仅从前端代码确认，未取得实测样本。

曾用名条目为 `{name, time}`。样本 time 为毫秒 Unix 时间戳。

### stats

`rank`、`timePlayed`、`kills`、`deaths`、`wins`、`losses`、`headshots`、`shots`、`hits`、`highestKillStreak`、`longestHeadShot`、`skill`、`assists`、`dogtagTaken`、`repairs`、`heals`、`revives`。

timePlayed 按秒使用（原站据此显示小时、计算 KPM）。最远爆头在原站按米显示。

与原页面一致的派生值：

- K/D = kills / deaths。
- KPM = kills / (timePlayed / 60)。
- 胜率 = wins / (wins + losses) × 100%。
- 命中率 = hits / shots × 100%。
- 爆头率 = headshots / kills × 100%。

插件需要对分母为 0 或字段缺失显示“—”，避免 NaN / Infinity。

### weapons（含载具）

普通武器样本：

```json
{"type":"WEAPON","name":"MP 18（壕沟战）","category":"衝鋒槍","kills":942,"headshots":72,"time":36680.5,"shots":21280,"hits":4234}
```

载具样本：

```json
{"type":"VEHICLE","name":"马匹（所有）","category":"載具","kills":101,"time":10905.4,"destroyed":7}
```

time 按秒使用，可含小数。载具没有普通武器的全部字段，不可强制展示命中率、爆头率。原前端还识别 GADGET，但此次样本未出现该类型。

### reports

本次条目键为 `time`、`stats`、`map`、`mode`、`serverName`、`weapons`。time 为毫秒时间戳，stats 为单场统计，weapons 为单场装备记录。

158 为此次返回数量，不代表已确认的服务端上限。前端的分页是本地切分已有数组，未发现服务端翻页参数。没有完整性或实时性保证，应表述为“接口返回的对局记录”。

### platoons

此次为空，战队条目结构尚未通过真实非空响应验证。前端会寻找 active 战队并读取 tag；若要实现完整战队详情，还应补充非空样本验证。

## 错误与访问行为

| 情况 | 依据 | 响应/行为 |
| --- | --- | --- |
| konekoroku | 实际请求 | 200，JSON，规范名称 KonekoRoku |
| CodexProbe_7e942b60_NoPlayer | 实际请求 | 404，text/plain，Player Not Found |
| name 为空 | 实际请求 | 400，JSON，{"error":"Missing query parameter: name"} |
| 限流 | 前端代码 | 对 429 显示“请求过于频繁，请稍后再试”；未主动压测 |
| 其他失败/网络错误 | 前端代码 | 通用查询失败/网络异常提示 |

成功响应与 404 响应均观察到 `cache-control: no-store`；这并不证明服务端没有内部缓存或数据实时更新。

具体限流阈值、正式外部接入政策、稳定性承诺尚不明确。未发现前端 API key，不等于获得无限调用授权。

本次响应未观察到 Access-Control-Allow-Origin。原站前端使用同源请求；浏览器跨域访问尚未测试。Scripting 的原生 HTTP 请求能力需要在实现阶段单独验证。

## 对插件范围的结论

1. 可以围绕该接口实现任意玩家 ID 查询；每次请求一个 ID，多玩家收藏、历史和切换由插件本地管理。
2. 首版可实现总战绩、武器、载具、对局、曾用名；战队可先处理空状态，非空详情待补充验证。
3. 此次响应和原站展示中未发现独立兵种统计、SPM、头像资源或 BF1 聊天记录，不纳入已确认能力。
4. 建议请求去重、限制并发、短期本地缓存并标注获取时间；遇到 429 停止连发，若有 Retry-After 则遵循它。
5. 当前结论支持继续开发数据层；平台覆盖、数据更新延迟、非空战队与反作弊状态、iOS 实际网络访问仍需后续验证。
