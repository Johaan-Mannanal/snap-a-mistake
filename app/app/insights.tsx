import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppIcon } from '../src/components/AppIcon'
import { AppScreen } from '../src/components/AppScreen'
import { loadHistory } from '../src/lib/history'
import { tagLabel } from '../src/lib/labels'
import { summarize, type TagSummary } from '../src/lib/trends'
import { trendPresentation } from '../src/ui/presentation'
import { colors, spacing, typeScale } from '../src/ui/theme'

export default function Insights() {
  const [rows, setRows] = useState<TagSummary[] | null>(null)

  useEffect(() => {
    loadHistory().then((records) => setRows(summarize(records, new Date()))).catch(() => setRows([]))
  }, [])

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppIcon name="chevron.left" fallback="‹" size={22} />
        </Pressable>
      </View>
      <Text style={styles.title}>Patterns</Text>
      {rows === null ? (
        <Text style={styles.loading}>Loading patterns…</Text>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No patterns yet</Text>
            <Text style={styles.emptyDetail}>Patterns appear after analyses.</Text>
          </View>
          <AppButton label="Back to camera" onPress={() => router.dismissTo('/')} variant="secondary" />
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const trend = trendPresentation(row.trend)
            return (
              <View key={row.tag} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.label}>{tagLabel(row.tag)}</Text>
                  <Text style={styles.count}>{row.thisWeek} this week</Text>
                </View>
                <Text style={[styles.trend, { color: trend.color }]}>{trend.symbol} {trend.label}</Text>
              </View>
            )
          })}
        </View>
      )}
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xs },
  topBar: { height: 44, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38 },
  loading: { color: colors.muted, fontSize: typeScale.body, lineHeight: 22, marginTop: spacing.md },
  empty: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.xxl },
  emptyCopy: { gap: spacing.sm },
  emptyTitle: { color: colors.chalk, fontSize: typeScale.title, fontWeight: '700', letterSpacing: -0.5, lineHeight: 30 },
  emptyDetail: { color: colors.muted, fontSize: typeScale.body, lineHeight: 22 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.carbon },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.carbon },
  rowCopy: { flex: 1, gap: spacing.xs },
  label: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  count: { color: colors.muted, fontSize: typeScale.caption },
  trend: { flexShrink: 0, fontSize: typeScale.caption, fontWeight: '700' },
})
