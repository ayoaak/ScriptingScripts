# ChinaBroadnetMonitor

面向 Scripting App 的中国广电套餐用量小组件项目。

当前版本为 `0.3.1`，完成独立项目、无凭据网络检测、Loon/Surge自动读取重写、原生安装助手、重写状态检测和统一数据模型，并修复代理软件继续使用旧版远程JS缓存时误报“未安装重写”的问题。运行 `index.tsx` 后可选择代理软件安装模块；原有网络检测仍只发送空 `data`，不会发送 `access`、手机号、Cookie或其他会话数据。

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

其他代理软件可在设置页分别复制共享JS链接和MITM主机。共享脚本兼容使用`$persistentStore`的代理脚本环境及Quantumult X的`$prefs`；该脚本属于HTTP请求脚本，需要读取请求体，匹配地址为`https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo`，MITM主机为`wx.10099.com.cn`。

## 状态检测

- 未安装重写：未收到重写本地握手响应。
- 已安装但未捕获：重写生效，但代理软件中还没有授权请求。
- 已捕获，可以自动读取：重写成功注入并取得`000000`响应。
- 凭据已经失效：已有捕获，但查询返回`000001`或认证失效提示。
- 网络或接口异常：请求失败、非JSON响应或其他业务错误。

`0.3.1`为插件、模块和共享JS地址加入版本参数，状态握手同时使用请求头与`cbm_status=1`查询参数，并保留旧版注入读取回退。由`0.2.0/0.3.0`升级时请重新点击“安装/更新重写模块”；如代理软件仍显示旧脚本，先删除旧模块后重新安装。

统一数据模型包括余额、套餐总流量、已用/剩余流量、流量剩余比例、语音总量、已用/剩余语音、语音剩余比例和更新时间。缺失字段使用`null`，不会误显示为零。

## 检测说明

- 接口：`https://wx.10099.com.cn/contact-web/api/busi/qryUserInfo`
- 请求：`POST application/json`
- 请求体：`{"data":""}`
- 超时：12秒
- 收到HTTP响应且内容为JSON，说明TLS、POST和JSON响应通道可以使用；业务错误码是无凭据检测的预期结果。

## 参考

- [Scripting App Development](https://github.com/ScriptingApp/scripting-app-development)
- [ChinaBroadnet_2026.js](https://github.com/ayoaak/Scriptable/blob/main/ChinaBroadnet_2026.js)
