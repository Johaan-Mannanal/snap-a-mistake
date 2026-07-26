import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { AppIcon } from './AppIcon'
import type { ScanItemPresentation } from '../ui/insightsPresentation'
import { colors, spacing, typeScale } from '../ui/theme'

export function ScanHistoryRow(props: { item: ScanItemPresentation; onPress: () => void }) {
  const [imageAvailable, setImageAvailable] = useState(true)
  const details = [props.item.statusLabel, props.item.tagLabel, props.item.followUpLabel].filter(Boolean)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.item.attemptLabel}, ${props.item.dateLabel}, ${details.join(', ')}`}
      accessibilityHint="Open this scan"
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}
    >
      <View accessibilityElementsHidden style={styles.thumbnail}>
        {imageAvailable ? (
          <Image source={{ uri: props.item.imageUri }} onError={() => setImageAvailable(false)} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <AppIcon name="photo" fallback="▧" color={colors.muted} />
          </View>
        )}
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{props.item.attemptLabel}</Text>
          <AppIcon name="chevron.right" fallback="›" color={colors.muted} size={18} />
        </View>
        <Text style={styles.date}>{props.item.dateLabel} · {props.item.timeLabel}</Text>
        <Text style={styles.meta}>{props.item.statusLabel} · {props.item.tagLabel}</Text>
        {props.item.followUpLabel ? <Text style={styles.followUp}>{props.item.followUpLabel}</Text> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.carbon, paddingVertical: spacing.md },
  thumbnail: { width: 72, height: 72, overflow: 'hidden', backgroundColor: colors.graphite },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.carbon },
  copy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  date: { color: colors.muted, fontSize: typeScale.caption, lineHeight: 17 },
  meta: { color: colors.chalk, fontSize: typeScale.caption, lineHeight: 17 },
  followUp: { color: colors.success, fontSize: typeScale.caption, fontWeight: '700', lineHeight: 17 },
})
