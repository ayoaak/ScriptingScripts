import { Text, VStack, Widget } from "scripting"

function ChinaTelecomWidget() {
  return (
    <VStack>
      <Text>中国电信</Text>
      <Text>等待配置</Text>
    </VStack>
  )
}

Widget.present(<ChinaTelecomWidget />)
