# ChinaBroadnetMonitor

面向 Scripting App 的中国广电套餐用量小组件项目。

当前版本为 `0.1.0`，完成独立项目结构和无凭据网络兼容性测试。运行 `index.tsx` 后点击“运行网络兼容性测试”，脚本只向中国广电查询接口发送空 `data`，不会发送 `access`、手机号、Cookie或其他会话数据。

## 文件

- `script.json`：项目元数据
- `index.tsx`：Apple 原生风格检测页面
- `widget.tsx`：小组件占位入口
- `broadnet.ts`：中国广电接口常量和网络检测逻辑

## 检测说明

- 接口：`https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo`
- 请求：`POST application/json`
- 请求体：`{"data":""}`
- 超时：12秒
- 收到HTTP响应且内容为JSON，说明TLS、POST和JSON响应通道可以使用；业务错误码是无凭据检测的预期结果。

## 参考

- [Scripting App Development](https://github.com/ScriptingApp/scripting-app-development)
- [ChinaBroadnet_2026.js](https://github.com/ayoaak/Scriptable/blob/main/ChinaBroadnet_2026.js)
