import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../app/followup.tsx'), 'utf8')
const buttonSource = readFileSync(resolve(__dirname, '../components/AppButton.tsx'), 'utf8')

describe('follow-up screen handoff', () => {
  it('waits for the opening navigation transition and guards both check-work buttons', () => {
    expect(source).toContain('useNavigation<NativeStackNavigationProp')
    expect(source).toContain("navigation.addListener('transitionEnd'")
    expect(source).toContain("armOnFocus: Platform.OS === 'web'")
    expect(source.match(/routeGate\.current\.beginPress\(\)/g)).toHaveLength(2)
    expect(source.match(/routeGate\.current\.consumePress\(\)/g)).toHaveLength(2)
    expect(source.match(/routeGate\.current\.consumeNonPointerActivation\(\)/g)).toHaveLength(2)
    expect(source.match(/onNonPointerPress=/g)).toHaveLength(2)
    expect(source).not.toContain('InteractionManager')
    expect(source).not.toContain('ROUTE_ACTIVATION_DELAY_MS')
  })

  it('wires explicit accessibility, focus classification, and press cancellation paths', () => {
    expect(buttonSource).toContain('onNonPointerPress?: () => void')
    expect(buttonSource).toContain("accessibilityActions={props.onNonPointerPress ? [{ name: 'activate' }] : undefined}")
    expect(buttonSource).toContain('onAccessibilityAction=')
    expect(buttonSource).toContain('onAccessibilityTap=')
    expect(buttonSource).toContain('onFocus=')
    expect(buttonSource).toContain('onBlur=')
    expect(source.match(/routeGate\.current\.cancelPress\(\)/g)).toHaveLength(2)
    expect(source.match(/onPressOut=/g)).toHaveLength(2)
  })
})
