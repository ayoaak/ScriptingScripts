# ChinaTeleMonitor

面向 Scripting App 的中国电信用量小组件项目。

当前版本完成了中国电信接口兼容性检测、认证算法移植、安全凭据存储、原生设置页面、统一套餐数据模型和 Token 优先刷新。首次使用时运行 `index.tsx`，填写手机号与服务密码，然后点击“登录并保存”。

`0.5.1` 修正登录签名结构：登录使用真实秒级时间戳，稳定设备标识保持16位，并保证RSA明文中的设备段与请求字段一致。

`0.5.2` 将登录设备描述、系统版本和电信标识字段对齐到当前参考实现，并改为首次安全随机生成、后续持久复用同一个16位设备标识。

`0.5.3` 补齐参考客户端使用的 `user-agent: P216010901` 请求头，并确保自动生成的16位设备标识首位非零。

`0.7.0` 将接口数据统一转换为元、GB和分钟，加入 Token 优先查询、`X201` 后单次重登、5分钟登录冷却，以及请求失败时保留旧缓存。

## 文件

- `script.json`：项目元数据
- `index.tsx`：Apple 原生风格登录与设置页面
- `widget.tsx`：小组件入口
- `telecom.ts`：认证、查询、统一数据解析、缓存及刷新编排逻辑

## 当前限制

- 网络兼容性必须在 iPhone 的 Scripting App 中实测。
- 错误码 `3005` 只会提示需要验证码或二次校验，当前版本尚未实现验证码提交。
- 服务密码和 Token 仅保存于本机 iOS Keychain；普通设置和套餐数据使用项目私有 Storage。
- “手动刷新”会优先使用现有 Token，并显示标准化后的余额、消费、流量、语音和积分数据。
- 小组件样式和系统调度自动刷新将在后续阶段接入。
- iOS 控制桌面小组件的实际后台刷新时机，后续只能申请刷新，不能保证严格定时。

## 参考项目

- [Scripting App Development](https://github.com/ScriptingApp/scripting-app-development)
- [ChinaTelecom_2026.js](https://github.com/ayoaak/Scriptable/blob/main/ChinaTelecom_2026.js)
- [ha_china_comm](https://github.com/sfairy/ha_china_comm)
