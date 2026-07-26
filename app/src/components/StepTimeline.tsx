import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Step } from '@snap/shared'
import { focusedStepIndexes } from '../lib/resultFocus'
import { colors, spacing } from '../ui/theme'
import { StepCard } from './StepCard'

export type StepTimelineProps = {
  steps: Step[]
  errorStepIndex: number | null
  selectedStepIndex: number | null
  showAll: boolean
  onSelectStep: (index: number) => void
  onShowAll: () => void
  expandedStepIndexes: ReadonlySet<number>
  onToggleStepExpanded: (index: number) => void
  onStepLayout?: (index: number, y: number) => void
  misconceptionLabel: string | null
  explanation: string | null
}

export type StepTimelineHandle = { getStepNode: (index: number) => View | null }

export const StepTimeline = forwardRef<StepTimelineHandle, StepTimelineProps>(function StepTimeline(props, ref) {
  const stepNodes = useRef(new Map<number, View | null>())
  useImperativeHandle(ref, () => ({
    getStepNode: (index) => stepNodes.current.get(index) ?? null,
  }), [])
  const focused = focusedStepIndexes(props.steps, props.errorStepIndex)
  const focusedSet = new Set(focused)
  const visibleSteps = props.steps
    .map((step, position) => ({ step, ordinal: position + 1 }))
    .filter(({ step }) => props.showAll || focusedSet.has(step.index))
  const canToggle = focused.length < props.steps.length

  return (
    <View accessibilityRole="list" accessibilityLabel="Solution steps" style={styles.root}>
      {visibleSteps.map(({ step, ordinal }) => (
        <StepCard
          key={step.index}
          step={step}
          ordinal={ordinal}
          misconceptionLabel={step.index === props.errorStepIndex ? props.misconceptionLabel : null}
          explanation={step.index === props.errorStepIndex ? props.explanation : null}
          expanded={props.expandedStepIndexes.has(step.index)}
          selected={step.index === props.selectedStepIndex}
          onPress={() => {
            props.onSelectStep(step.index)
            props.onToggleStepExpanded(step.index)
          }}
          onLayout={(event) => props.onStepLayout?.(step.index, event.nativeEvent.layout.y)}
          ref={(node) => {
            if (node) stepNodes.current.set(step.index, node)
            else stepNodes.current.delete(step.index)
          }}
        />
      ))}
      {canToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.showAll ? 'Show focused steps' : 'Show all steps'}
          accessibilityHint={props.showAll ? 'Shows the steps around the first break.' : 'Shows every recognized step.'}
          accessibilityState={{ expanded: props.showAll }}
          onPress={props.onShowAll}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Text style={styles.toggleLabel}>{props.showAll ? 'Show focused steps' : `Show all ${props.steps.length} steps`}</Text>
        </Pressable>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  root: { marginTop: spacing.xs },
  toggle: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: spacing.sm },
  toggleLabel: { color: colors.chalk, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  pressed: { opacity: 0.68 },
})
