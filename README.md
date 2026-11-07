# ScriptingScripts

用于集中保存 Scripting App 脚本项目，每个项目使用独立子目录，避免文件名和配置互相冲突。

## 项目

- [`ChinaTeleMonitor`](./ChinaTeleMonitor)：中国电信用量小组件与原生风格设置页面。[[一键添加到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2Fayoaak%2FScriptingScripts%2Fmain%2FChinaTeleMonitor%2FChinaTeleMonitor.scripting%22%5D)]
- [`ChinaBroadnetMonitor`](./ChinaBroadnetMonitor)：中国广电用量小组件与原生风格设置页面。[[一键添加到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2Fayoaak%2FScriptingScripts%2Fmain%2FChinaBroadnetMonitor%2FChinaBroadnetMonitor.scripting%22%5D)]
- [`Battlefield1Stats`](./Battlefield1Stats)：战地战绩查询：多玩家堆叠卡片、在线军衔徽章、收藏、历史与独立缓存，原生 Liquid Glass 操作界面。[[一键添加到 Scripting](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fraw.githubusercontent.com%2Fayoaak%2FScriptingScripts%2Fmain%2FBattlefield1Stats%2FBattlefield1Stats.scripting%22%5D)] **0.4.0 待用户真机验收**；[验证报告](./docs/bf1-validation.md)。

一键添加链接会唤起 Scripting 导入项目；如果系统没有跳转，可进入对应项目页面直接下载 `.scripting` 安装包。

## 战地一脚本开发

```sh
npm ci
npm test
npm run package:bf1
```

测试严格编译平台无关核心，检查 TSX 语法和本地导入，运行行为测试。目标 Scripting 版本的完整类型诊断、界面和持久化真机验收另行验证，详见[验收清单](./docs/bf1-validation.md)。

打包生成 `Battlefield1Stats/Battlefield1Stats.scripting` 及相同内容的 `dist/bf1.zip`。包只包含此脚本的源码和使用说明，不包含其他项目、node_modules、测试或查询样本。设计和接口调查见 [docs](./docs)。
