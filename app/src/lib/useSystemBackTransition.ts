import { useEffect, useLayoutEffect, useRef } from 'react'
import { BackHandler } from 'react-native'
import { registerSystemBackTransition } from './routeNavigation'

export function useSystemBackTransition(transition: () => void): void {
  const latest = useRef(transition)

  useLayoutEffect(() => {
    latest.current = transition
  }, [transition])

  useEffect(() => {
    const subscription = registerSystemBackTransition(BackHandler, () => latest.current())
    return () => subscription.remove()
  }, [])
}
