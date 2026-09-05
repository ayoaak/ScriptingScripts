# ChinaBroadnetMonitor

面向 Scripting App 的中国广电套餐用量小组件项目。

当前版本为 `0.2.0`，完成独立项目、无凭据网络检测、Loon/Surge自动读取重写和原生安装助手。运行 `index.tsx` 后可选择代理软件安装模块；原有网络检测仍只发送空 `data`，不会发送 `access`、手机号、Cookie或其他会话数据。

## 文件

- `script.json`：项目元数据
- `index.tsx`：Apple 原生风格检测页面
- `widget.tsx`：小组件占位入口
- `broadnet.ts`：中国广电接口常量和网络检测逻辑
- `rewrite/broadnet-capture.js`：代理侧授权请求捕获和自动注入脚本
- `rewrite/ChinaBroadnet.plugin`：Loon插件
- `rewrite/ChinaBroadnet.sgmodule`：Surge模块

## 自动读取

1. 在设置页点击“安装/更新重写模块”，选择Loon或Surge。
2. 在代理软件中启用插件或模块，并开启脚本、重写和MITM。
3. 安装并信任代理软件的HTTPS证书。
4. 打开中国广电App或小程序，进入套餐页面并完成一次正常查询。
5. 重写把该请求的`access`和加密后的`body.data`保存于代理软件本地；后续只对带`X-ChinaBroadnet-Scripting: 1`标记的Scripting请求注入。

捕获值不会写入Scripting的Storage、Keychain、缓存、日志或剪贴板。安装助手复制的只有公开模块地址。

## 检测说明

- 接口：`https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo`
- 请求：`POST application/json`
- 请求体：`{"data":""}`
- 超时：12秒
- 收到HTTP响应且内容为JSON，说明TLS、POST和JSON响应通道可以使用；业务错误码是无凭据检测的预期结果。

## 参考

- [Scripting App Development](https://github.com/ScriptingApp/scripting-app-development)
- [ChinaBroadnet_2026.js](https://github.com/ayoaak/Scriptable/blob/main/ChinaBroadnet_2026.js)
