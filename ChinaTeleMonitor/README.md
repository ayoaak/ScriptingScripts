# ChinaTeleMonitor

面向 Scripting App 的中国电信用量小组件项目。

当前版本完成了中国电信接口兼容性检测和认证算法移植。首次使用时先运行 `index.tsx`，确认登录接口及套餐查询接口在 iPhone 上能够完成 TLS 握手并返回响应。

## 文件

- `script.json`：项目元数据
- `index.tsx`：网络与 RSA 兼容性测试页面
- `widget.tsx`：小组件入口
- `telecom.ts`：认证、查询及通用数据逻辑

## 当前限制

- 网络兼容性必须在 iPhone 的 Scripting App 中实测。
- 错误码 `3005` 只会提示需要验证码或二次校验，当前版本尚未实现验证码提交。
- 正式登录设置、凭据安全保存、缓存和自动刷新界面将在后续阶段接入。

## 参考项目

- [Scripting App Development](https://github.com/ScriptingApp/scripting-app-development)
- [ChinaTelecom_2026.js](https://github.com/ayoaak/Scriptable/blob/main/ChinaTelecom_2026.js)
- [ha_china_comm](https://github.com/sfairy/ha_china_comm)
