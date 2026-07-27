import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LocalStorageBootstrapState } from '../lib/startup'

const state = vi.hoisted(() => ({
  startup: null as LocalStorageBootstrapState | null,
}))

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>()
  return {
    ...original,
    useState: () => [state.startup, vi.fn()],
  }
})

vi.mock('expo-router', async () => {
  const React = await import('react')
  const Stack = Object.assign(
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('route-stack', null, children),
    { Screen: () => null },
  )
  return {
    router: { replace: vi.fn() },
    Stack,
    useRootNavigationState: () => null,
  }
})

vi.mock('expo-status-bar', () => ({ StatusBar: () => null }))

vi.mock('react-native', async () => {
  const React = await import('react')
  const Element = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('native-view', null, children)
  return {
    Pressable: Element,
    Text: Element,
    View: Element,
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})

vi.mock('react-native-gesture-handler', async () => {
  const React = await import('react')
  return {
    GestureHandlerRootView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('gesture-root', props, children),
  }
})

vi.mock('../lib/history', () => ({
  getLocalScanRepository: vi.fn(),
  initLocalScanStorage: vi.fn(),
}))
vi.mock('../lib/scanFiles', () => ({ flushCleanupQueue: vi.fn() }))
vi.mock('../lib/session', () => ({
  hydrateSession: vi.fn(),
  takeHydratedRouteIntent: vi.fn(),
}))
vi.mock('../lib/startup', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/startup')>()
  return { ...original, bootstrapLocalStorage: vi.fn() }
})
vi.mock('./theme', () => ({ colors: { ink: '#000', chalk: '#fff', muted: '#888' } }))
vi.mock('../lib/routeNavigation', () => ({ statefulRouteScreenOptions: vi.fn(() => ({})) }))

describe('RootLayout', () => {
  it('keeps launch and routed screens inside a full-screen native gesture root', async () => {
    const { default: RootLayout } = await import('../../app/_layout')

    state.startup = null
    const launch = renderToStaticMarkup(createElement(RootLayout))
    expect(launch).toBe(
      '<gesture-root style="flex:1"><native-view></native-view></gesture-root>',
    )

    state.startup = { kind: 'ready' }
    const routed = renderToStaticMarkup(createElement(RootLayout))
    expect(routed).toBe(
      '<gesture-root style="flex:1"><route-stack></route-stack></gesture-root>',
    )
  })
})
