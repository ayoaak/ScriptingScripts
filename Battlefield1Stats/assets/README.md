# 图像来源

## BF 图标

用户指定的原始图像：

https://static.wikia.nocookie.net/battlefield/images/e/e6/Site-logo.png/revision/latest?cb=20251007190756

`icon.png` 根据该参考移除了数字 6 区域，并将 BF/准星标识重新整理为正方形，用于脚本图标和查询首页。通过 imagegen 编辑生成。Battlefield 标识的相关权利属于原权利人。

## BF1 军衔徽章

来源页面：https://battlefield.fandom.com/wiki/Battlefield_1_online_ranks

`ranks/sources.json` 保存每个等级范围、原图片名及图片 URL。17 个原始徽章对应等级 0–150；只下载原始 PNG 格式，不重绘军衔图像。中文军衔名是展示译名，英语军衔及等级范围来自该页面。

当前普通列表不加载徽章。以下在线加载说明供 0.2.0–0.4.1 历史卡片版本参考：徽章 PNG 只存于 GitHub 仓库，安装包排除整个 `assets/ranks/` 目录，历史版本运行时通过 `raw.githubusercontent.com/ayoaak/ScriptingScripts/main/Battlefield1Stats/assets/ranks/` 获取。加载失败时界面显示带等级的盾牌占位，不将占位符称为真实军衔徽章。

军衔图像及 Battlefield 商标的相关权利属于原权利人；项目为个人查询脚本，不代表官方产品。

素材获取工具：`tools/sync-rank-assets.py`，输入该页面公开 MediaWiki parse API 的 JSON 响应。
