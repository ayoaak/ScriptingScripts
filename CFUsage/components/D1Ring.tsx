import { Text, VStack, ZStack } from 'scripting'
import { UsageRing } from './UsageRing'
import { compact, percent } from '../format'
import { i18n } from '../i18n'
import type { D1Meters } from '../d1'

/** Outer: rows read (blue). Inner: rows written (purple). */
export function D1Ring({ meters, size }: { meters: D1Meters | null; size: number }) {
  const lineWidth = size / 12
  const innerSize = size - lineWidth * 3
  return (
    <ZStack frame={{ width: size, height: size }}>
      <UsageRing ratio={meters?.read.ratio ?? 0} size={size} lineWidth={lineWidth} color="systemBlue" />
      <UsageRing ratio={meters?.write.ratio ?? 0} size={innerSize} lineWidth={lineWidth} color="systemPurple" />
      <Text font={size / 5} fontWeight="semibold" foregroundStyle="secondaryLabel">
        {meters == null ? '–' : 'D1'}
      </Text>
    </ZStack>
  )
}

export function D1Values({ meters, font = 10, detailed = false }: {
  meters: D1Meters | null; font?: number; detailed?: boolean
}) {
  const value = (kind: 'read' | 'write') => {
    if (meters == null) return '–'
    const m = meters[kind]
    return detailed
      ? `${compact(m.used)} / ${compact(m.limit)} · ${percent(m.ratio)}`
      : `${compact(m.used)} / ${compact(m.limit)}`
  }
  return (
    <VStack alignment="leading" spacing={1}>
      <Text font={font} monospacedDigit lineLimit={1} minScaleFactor={0.6} foregroundStyle="systemBlue">
        {i18n.d1Read} {value('read')}
      </Text>
      <Text font={font} monospacedDigit lineLimit={1} minScaleFactor={0.6} foregroundStyle="systemPurple">
        {i18n.d1Write} {value('write')}
      </Text>
    </VStack>
  )
}
