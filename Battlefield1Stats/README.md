# 战地战绩查询

版本 0.2.0，待用户真机验收。[一键添加到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2Fayoaak%2FScriptingScripts%2Fmain%2FBattlefield1Stats%2FBattlefield1Stats.scripting%22%5D) · [直接下载安装包](https://raw.githubusercontent.com/ayoaak/ScriptingScripts/main/Battlefield1Stats/Battlefield1Stats.scripting) · [验收清单](../docs/bf1-validation.md)。

Scripting 原生 TSX 脚本，查询 stats.2788.pro 提供的战地一数据。`konekoroku` 为输入示例，首次打开不会自动查询或收藏。

## 功能

- 输入任意玩家 ID；收藏最多 50 位，成功查询历史最多 20 位。
- 每位玩家独立缓存，5 分钟内复用，过期先展示旧数据再请求；手动刷新当前玩家。
- 核心战绩、武器/配备、载具、对局详情、曾用名、战队和可用的第三方反作弊状态。
- 请求串行执行，同一玩家在途去重，队列只保留最后一次选择；迟到响应不会切换当前页面。
- 处理 400、404、429、超时、非 JSON 错误响应、数据缺失和保存失败。
- 原生 List / NavigationStack / Picker；支持条件满足时采用 Liquid Glass 按钮和容器，系统语义颜色跟随深浅色。
- 常用玩家以堆叠卡片呈现，上下滑动换人，点击进入详情；卡片展示玩家 ID、军衔/等级、总击杀、KD、KPM、胜率。
- 真实 BF1 军衔徽章从本仓库 GitHub 图片地址加载，覆盖 0–150 级；加载失败显示等级占位，不放入安装包。
- 自定义 BF 图标已移除数字 6；首页查询按钮缩小并居中。

## 文件

```text
script.json          脚本元数据
index.tsx            运行入口
runtime.ts           Scripting fetch / Storage 适配
core/model.ts        校验、归一化、数值格式
core/api.ts          HTTP 状态、超时和 Retry-After
core/store.ts        私有存储、恢复与容量规则
core/controller.ts   玩家身份、选择、队列、缓存与收藏
ui/app.tsx           查询首页、战绩页及列表
ui/components.tsx    指标与装备统计
ui/details.tsx       玩家、对局、装备详情
```

## 运行与发布准备

从旧版“战地一战绩”更新且希望保留私有数据时，先在 Scripting 将已安装脚本重命名为“战地战绩查询”，再导入并选择覆盖同名脚本。直接创建另一份新脚本不会自动读取旧脚本的私有存储；本版保留原存储键和数据结构。

目标为 iPhone 上的 Scripting 主应用。使用原生 Liquid Glass 需要 iOS 26+ 和支持相关 API 的 Scripting 版本；实际安装版本的声明文件及真机行为尚未验证。

在 Scripting 中新建 TypeScript 脚本，将此目录内容按原结构放入脚本目录，以 `index.tsx` 为入口运行。若使用官方桌面 CLI，可连接 iPhone 同步源码及设备版本的 `.d.ts`，再运行编辑器诊断。本仓库不附带伪造的 Scripting 类型声明。

可点击“一键添加”在 Scripting 中导入，也可下载 `.scripting` 文件后交给 Scripting 打开。包使用与本仓库已有脚本一致的 ZIP 内容格式，包含全部运行源码。

仓库根目录执行 `npm run package:bf1` 会生成 `Battlefield1Stats/Battlefield1Stats.scripting` 及相同内容的 `dist/bf1.zip`，其顶层为 script.json、index.tsx、core/、ui/、assets/icon.png 等。`assets/ranks/` 整个目录排除在包外，徽章仅由 GitHub 在线加载。

也可在 Scripting 脚本的远程来源设置使用以下项目子目录：

```text
https://github.com/ayoaak/ScriptingScripts/tree/main/Battlefield1Stats
```

不要将整个多脚本仓库根目录作为这个脚本的来源。导入运行和原生视觉由用户自行验收，当前验证状态见验收清单。

## 数据和隐私

仅向 `https://stats.2788.pro/api/bf1/full?name=...` 发送查询的玩家 ID，不需要 EA 登录或 API Key。本脚本不设置站点追踪 UUID、不做遥测。实际访问仍会产生网络服务的正常请求日志。

本地数据使用当前脚本私有的 Storage，键为 `bf1.players.v1`。收藏、历史、上次成功选择、最多 50 份缓存和限流冷却存放在一个版本化快照中。`Storage.set` 返回失败时界面提供重试保存；按官方说明，持久化在后台完成，突然终止进程时不能承诺最新一笔已落盘。

“获取于”是本脚本收到数据的时间，不是战绩实际更新时间。第三方反作弊数据缺失时显示“暂无可用记录”，不据此断言账号无违规。平台覆盖、服务端更新周期、限流阈值、非空战队完整结构尚不明确。

## 验证情况

已完成核心逻辑严格 TypeScript 编译、TS/TSX 语法与本地导入检查，以及自动化测试：真实异步切换顺序、排队合并、缓存、历史、收藏、账号改名、限流、恢复、损坏数据和保存失败。

实现的解析器已实际解析 `konekoroku` 和 `jackfrags` 的线上响应，并用这两份实测响应验证多账号切换、收藏和快照恢复。不存在的 ID 实测返回 404。常规自动化测试的玩家均为本地合成数据，不向服务端发起请求。

尚待下一步在 iPhone 上验证：Scripting 版本对应的完整类型检查、导入运行、原生网络访问和 Storage 跨进程恢复、玻璃材质、系统辅助功能及实际页面布局。网页预览和本地逻辑测试不替代这些验证。

## 官方 API 依据

- [fetch](https://scriptingapp.github.io/guide/Utilities/Request/fetch)：原生选项 timeout 单位为秒。
- [官方文档索引](https://scriptingapp.github.io/llms.txt)：Storage、原生视图、生命周期及远程脚本源。
- [Liquid Glass](https://scriptingapp.github.io/guide/View%20Modifiers/Liquid%20Glass/Liquid%20Glass%20Effect/)。
