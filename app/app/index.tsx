import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getSession, setPhoto } from '../src/lib/session'

export default function Home() {
  const camera = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const isRetry = getSession().isRetry

  const usePhoto = (uri: string) => {
    setPhoto(uri)
    router.push('/analyze')
  }

  const snap = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.7 })
    if (photo?.uri) usePhoto(photo.uri)
  }

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    const uri = res.assets?.[0]?.uri
    if (uri) usePhoto(uri)
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 17, textAlign: 'center' }}>
          Snap-a-Mistake needs the camera to photograph your work.
        </Text>
        <Pressable onPress={requestPermission} style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={pick}><Text style={{ color: '#94a3b8' }}>Or pick from your photos</Text></Pressable>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <CameraView ref={camera} style={{ flex: 1 }} />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        {isRetry && (
          <View style={{ backgroundColor: '#6366f1', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, marginTop: 8 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Follow-up: snap your new attempt</Text>
          </View>
        )}
        <View style={{ backgroundColor: '#00000088', borderRadius: 10, padding: 10, marginTop: 8 }}>
          <Text style={{ color: 'white', fontSize: 13 }}>💡 Good light · page flat · one problem per shot</Text>
        </View>
      </SafeAreaView>
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 16 }}>
          <Pressable onPress={pick}><Text style={{ color: 'white', fontSize: 15 }}>🖼️ Gallery</Text></Pressable>
          <Pressable
            onPress={snap}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'white', borderWidth: 5, borderColor: '#6366f1' }}
          />
          <Pressable onPress={() => router.push('/insights')}><Text style={{ color: 'white', fontSize: 15 }}>📊 Insights</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}
