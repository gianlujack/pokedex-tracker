import AsyncStorage from '@react-native-async-storage/async-storage'
import Slider from '@react-native-community/slider'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { globalSound } from './_layout'

export default function SettingsScreen() {
  const [volume, setVolume] = useState(0.35)

  useEffect(() => {
    const loadVolume = async () => {
      const saved = await AsyncStorage.getItem('music_volume')
      if (saved) setVolume(Number(saved))
    }
    loadVolume()
  }, [])

  const changeVolume = async (value: number) => {
    setVolume(value)
    await AsyncStorage.setItem('music_volume', value.toString())

    if (globalSound) {
      await globalSound.setVolumeAsync(value)
    }
  }

  const resetPokedex = async () => {
    Alert.alert(
      'Reset Pokédex',
      'Vuoi cancellare TUTTI i dati salvati?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'RESET',
          style: 'destructive',
          onPress: async () => {
            const keys = await AsyncStorage.getAllKeys()
            const pokemonKeys = keys.filter((k) => k.startsWith('pokemon_'))
            await AsyncStorage.multiRemove(pokemonKeys)
            Alert.alert('Fatto', 'Pokédex resettato!')
          },
        },
      ]
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitle: 'Impostazioni',
        }}
      />

      <View style={styles.container}>
        <TouchableOpacity style={styles.resetBtn} onPress={resetPokedex}>
          <Text style={styles.resetText}>RESETTA POKÉDEX</Text>
        </TouchableOpacity>

        {/* 🎵 CONTROLLO VOLUME */}
        <View style={styles.musicBox}>
          <Text style={styles.musicTitle}>Volume musica</Text>

          <Slider
            style={{ width: 260 }}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={changeVolume}
            minimumTrackTintColor="#4caf50"
            maximumTrackTintColor="#555"
          />

          <Text style={styles.percent}>{Math.round(volume * 100)}%</Text>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e2a38',
    justifyContent: 'center',
    alignItems: 'center',
  },

  resetBtn: {
    backgroundColor: '#c62828',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },

  resetText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Nunito_700Bold',
  },

  musicBox: {
    alignItems: 'center',
  },

  musicTitle: {
    color: 'white',
    marginBottom: 10,
    fontFamily: 'Nunito_700Bold',
  },

  percent: {
    color: '#4caf50',
    marginTop: 6,
    fontFamily: 'Nunito_700Bold',
  },
})