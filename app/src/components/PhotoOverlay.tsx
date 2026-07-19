import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import type { Step } from '@snap/shared'
import { bandStyle } from '../lib/overlay'

export function PhotoOverlay(props: { uri: string; steps: Step[] }) {
  const [aspect, setAspect] = useState(4 / 3)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    Image.getSize(props.uri, (w, h) => setAspect(w / h), () => {})
  }, [props.uri])

  const flagged = props.steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'suspect')
  return (
    <View
      style={{ width: '100%', aspectRatio: aspect, borderRadius: 12, overflow: 'hidden' }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <Image source={{ uri: props.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {height > 0 &&
        flagged.map((s) => {
          const b = bandStyle(s, height)
          const color = s.verdict === 'wrong' ? '#ef4444' : '#f59e0b'
          return (
            <View
              key={s.index}
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0, top: b.top, height: b.height,
                borderColor: color, borderWidth: 3, borderRadius: 8, backgroundColor: `${color}22`,
              }}
            />
          )
        })}
    </View>
  )
}
