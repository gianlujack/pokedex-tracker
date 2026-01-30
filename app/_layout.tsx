import { Nunito_400Regular, Nunito_700Bold, useFonts } from '@expo-google-fonts/nunito'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Audio } from 'expo-av'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'

export let globalSound: Audio.Sound | null = null

export default function RootLayout() {
  const soundRef = useRef<Audio.Sound | null>(null)

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
  })

  useEffect(() => {
    const startMusic = async () => {
      const savedVolume = await AsyncStorage.getItem('music_volume')
      const volume = savedVolume ? Number(savedVolume) : 0.35

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/pokemon_theme.mp3'),
        {
          isLooping: true,
          volume,
          shouldPlay: true,
        }
      )

      soundRef.current = sound
      globalSound = sound
    }

    startMusic()

    return () => {
      soundRef.current?.unloadAsync()
    }
  }, [])

  if (!fontsLoaded) return null

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </>
  )
}