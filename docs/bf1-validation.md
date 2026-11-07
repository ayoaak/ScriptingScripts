# 战地战绩查询：验证报告与用户验收清单

日期：2026-11-07（Asia/Shanghai）。版本：0.4.2。

状态：按用户要求恢复卡片改造前的普通玩家列表，移除卡片相关交互。保留名称、图标、查询按钮和原数据存储格式。用户自行验收，下文未勾选项目不表示通过。

## 已完成的验证

| 项目 | 证据与结果 |
| --- | --- |
| 核心 TypeScript | `npm test` 严格编译 core/ |
| TSX 语法与依赖 | `npm test` 检查 9 个运行源文件的语法及相对导入 |
| 行为测试 | 22 项：并发/排队、旧响应隔离、名称归并、独立缓存、恢复、损坏数据、收藏上限、限流和保存失败 |
| 演示账号 | 实际 HTTP 200，KonekoRoku，personaId 1004454100674，3193 击杀 |
| 第二个有效账号 | 实际 HTTP 200，JackFrags，personaId 247598934，28618 击杀，与演示账号身份不同 |
| 不存在的 ID | 实际 HTTP 404，正文 Player Not Found，不强制按 JSON 解析 |
| 实测响应集成回放 | 将上述 HTTP 状态及响应经过真正 createApi 与 PlayerController，验证两个账号分别收藏、往返切换、404 无数据串号，以及快照恢复 |
| 安装包格式 | 与仓库已有 .scripting 包的 ZIP 格式一致；根目录为 script.json、index.tsx、runtime.ts、core/、ui/、README.md；逐文件核对源码一致性 |

HTTP 请求通过本机 curl 获取。实测响应回放复用了抓取到的真实响应，未将 Node 回放说成 iPhone 原生网络或界面运行成功。查询原始数据只保留在本次本机临时目录，不随安装包或仓库发布。

回放命令：先保存三个查询的 `.headers` 与 `.json` 到同一前缀，文件名分别以 `-demo`、`-second`、`-missing` 结尾，再运行：

```sh
npm run check
node tools/verify-recorded.cjs /path/to/bf1-final
```

普通 `npm test` 无需访问线上接口，不压测真实限流。

## 安装入口

[一键添加到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2Fayoaak%2FScriptingScripts%2Fmain%2FBattlefield1Stats%2FBattlefield1Stats.scripting%22%5D)

[直接下载安装包](https://raw.githubusercontent.com/ayoaak/ScriptingScripts/main/Battlefield1Stats/Battlefield1Stats.scripting)

需支持相关原生组件的 Scripting；原生玻璃目标为 iOS 26+。无法使用玻璃 API 时脚本尝试普通原生按钮回退。目标 App 实际版本兼容性仍需用户验收。

## 用户真机验收

- [ ] 安装后能正常打开，首次不自动查询，输入框显示 konekoroku 示例。
- [ ] 查询 konekoroku，名称显示 KonekoRoku，核心数字与原站当时结果相符。
- [ ] 收藏该账号，再查询并收藏 jackfrags，两位玩家可以往返切换。
- [ ] 快速切换时不出现上一个玩家的战绩覆盖当前名称。
- [ ] 武器与载具分别展示，载具不出现虚假的命中/爆头率；分类、筛选、排序和更多记录可操作。
- [ ] 查看单场对局、装备详情、曾用名；返回路径正常。
- [ ] 查询 CodexProbe_7e942b60_NoPlayer，显示未找到；已有收藏和缓存保留。
- [ ] 手动刷新有进度；断网刷新显示失败且保留该玩家旧数据和获取时间。
- [ ] 关闭脚本后重开，收藏、历史、上次选择和已有缓存恢复。
- [ ] 取消收藏不删除历史；移除历史不取消收藏。
- [ ] 浅色/深色下正文数字清晰，原生玻璃按钮可读、滚动不遮挡正文。
- [ ] 插件名显示“战地战绩查询”，BF 图标不含数字 6，查询按钮紧凑且文字居中。
- [ ] 常用玩家为普通列表，显示名称、等级、获取时间；点击直接进入对应玩家战绩，随首页统一滚动。
- [ ] 无堆叠卡片、展开/收起、独立卡组滚动或居中进入动画。
- [ ] 长名称和服务器名可读，大字体不会裁掉核心数字或分类控件。
- [ ] VoiceOver 能辨认查询、收藏、刷新；减少动态效果和减少透明度下可正常使用。

429 和保存失败已用本地测试验证，不需要为验收故意触发线上限流或破坏设备存储。

## 问题反馈

出现问题时提供 iOS 版本、Scripting 版本、操作步骤、报错文字，以及必要的相关页面截图即可。请勿附 EA 密码、账户令牌或其他无关私人数据。原生完整 `.d.ts` 语义检查及真机界面在用户验收前保持未验证状态。
