# 0.4.1：修正展开卡组无法滑动

历史版本。用户随后要求恢复卡片之前的列表，当前使用 [0.4.2](bf1-v0.4.2.md)。

0.4.0 用户真机反馈“划不动”。旧版在首页 List 中依靠自定义 DragGesture 驱动固定高度 ZStack 的 offset，自定义手势与 List 的纵向滚动可能竞争；本地组件桥接测试直接调用 onChanged，绕过了原生手势识别，不能据此确认真机能滑动。

本版移除卡组的 DragGesture、highPriorityGesture、手算拖动距离、速度预测和五张卡片窗口。展开后使用真正的原生 ScrollView，所有收藏卡片放在正常 VStack 布局流中，按实际文字高度形成滚动内容；不再依靠 offset 模拟滚动，也不等待松手动画才能恢复浏览。

收起时仍是旋转错位的三张真实卡片，点击后排卡片展开。展开后通过正间距散开，滚动由系统处理；只有收起状态禁止卡组内部滚动。展开状态不因动画锁而禁用 ScrollView。

点击目标时使用 ScrollViewReader.scrollTo(玩家 ID, "center")，同一动画内将该卡片转正、其他卡片淡出。其他行保持布局高度，首尾留出居中空间；等待原生动画完成后再进入战绩。仅用可见目标回调更新当前玩家，不同时绑定 scrollPosition，避免两种定位机制互相争用。可见回调为 iOS 18+ 能力，较老系统按官方桥接行为跳过；滚动和点选由基础 ScrollView/ScrollViewReader 完成。

本版 34 项自动化测试通过，覆盖正常流布局包含全部 50 个玩家、展开时原生滚动启用、无自定义拖动拦截、按稳定 key 请求中心定位、动画完成后进入和失效回调隔离。测试只检查组件配置与控制流程，不合成 iPhone 触摸事件；真机滚动、动画和手势竞争仍待用户验收。

名称字号、左对齐、查询按钮、自定义图标、在线军衔徽章和私有存储格式保留。安装包不含徽章目录。

依据：[Scripting Scroll views](https://scriptingapp.github.io/guide/Views/Scroll%20views/)、[ScrollViewReader](https://scriptingapp.github.io/guide/Views/ScrollViewReader)。
