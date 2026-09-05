import { Text, VStack, Widget } from "scripting"

function ChinaBroadnetWidget() {
  return (
    <VStack
      spacing={4}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      widgetBackground={{ light: "#FFFFFF", dark: "#000000" }}
    >
      <Text
        font={17}
        fontWeight="semibold"
        foregroundStyle={{ light: "#111111", dark: "#FFFFFF" }}
      >
        中国广电
      </Text>
      <Text font={12} foregroundStyle="secondary">
        等待配置
      </Text>
    </VStack>
  )
}

Widget.present(<ChinaBroadnetWidget />)
