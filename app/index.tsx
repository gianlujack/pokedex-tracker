import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { Audio } from 'expo-av'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

type GameKey = 'home' | 'za' | 'go'
type GameState = { owned: boolean; shiny: boolean }
type FormState = Record<GameKey, GameState>
type PokemonData = { forms: Record<string, FormState> }

export default function PokedexScreen() {
  const [pokemonList, setPokemonList] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, PokemonData>>({})
  const [search, setSearch] = useState('')
  const [onlyOwned, setOnlyOwned] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchPokemon()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadProgress()
    }, [])
  )

  const playClick = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/click.mp3')
    )
    await sound.playAsync()
  }

  // 🔥 Nomi dove il trattino fa parte del nome vero
  const realHyphenNames = new Set([
    'mr-mime','mime-jr','ho-oh','porygon-z','mr-rime','type-null',
    'jangmo-o','hakamo-o','kommo-o',
    'tapu-koko','tapu-lele','tapu-bulu','tapu-fini',
    'great-tusk','scream-tail','brute-bonnet','flutter-mane','slither-wing','sandy-shocks',
    'iron-treads','iron-bundle','iron-hands','iron-jugulis','iron-moth','iron-thorns',
    'roaring-moon','walking-wake','iron-valiant',
    'wo-chien','chien-pao','ting-lu','chi-yu',
    'gouging-fire','raging-bolt','iron-boulder','iron-crown','iron-leaves',
  ])

  const fetchPokemon = async () => {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
    const data = await res.json()

    const formatted = data.results.map((p: any, index: number) => {
      const rawName = p.name
      let displayName = rawName

      // Nidoran simboli
      if (rawName === 'nidoran-m') displayName = 'Nidoran ♂'
      else if (rawName === 'nidoran-f') displayName = 'Nidoran ♀'

      // Nome con trattino ma fa parte del nome vero
      else if (realHyphenNames.has(rawName)) {
        displayName = rawName
          .split('-')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('-')
      }

      // Forme → togliamo il suffisso
      else if (rawName.includes('-')) {
        displayName = rawName.split('-')[0]
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
      }

      // Nome normale
      else {
        displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
      }

      return {
        id: index + 1,
        name: displayName,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${index + 1}.png`,
      }
    })

    setPokemonList(formatted)
  }

  const loadProgress = async () => {
    const keys = await AsyncStorage.getAllKeys()
    const pokemonKeys = keys.filter((k) => k.startsWith('pokemon_'))
    const stores = await AsyncStorage.multiGet(pokemonKeys)

    const map: Record<number, PokemonData> = {}

    stores.forEach(([key, value]) => {
      if (!value) return
      const id = Number(key.replace('pokemon_', ''))
      map[id] = JSON.parse(value)
    })

    setProgressMap(map)
  }

  const getBaseForm = (p?: PokemonData) => {
    if (!p?.forms) return undefined
    const firstKey = Object.keys(p.forms)[0]
    return p.forms[firstKey]
  }

  const checkOwned = (id: number) => {
    const form = getBaseForm(progressMap[id])
    return !!form && (form.home.owned || form.za.owned || form.go.owned)
  }

  const checkShiny = (id: number) => {
    const form = getBaseForm(progressMap[id])
    return !!form && (form.home.shiny || form.za.shiny || form.go.shiny)
  }

  const totalOwned = Object.values(progressMap).filter((p) => {
    const f = getBaseForm(p)
    return f && (f.home.owned || f.za.owned || f.go.owned)
  }).length

  const totalShiny = Object.values(progressMap).filter((p) => {
    const f = getBaseForm(p)
    return f && (f.home.shiny || f.za.shiny || f.go.shiny)
  }).length

  const completion = pokemonList.length
    ? Math.round((totalOwned / pokemonList.length) * 100)
    : 0

  const filteredList = pokemonList
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => (onlyOwned ? checkOwned(p.id) : true))

  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => router.push({ pathname: '/settings' })}
      >
        <Text style={styles.settingsText}>⚙️</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Cerca Pokémon..."
        placeholderTextColor="#888"
        style={styles.searchBar}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.progressBox}>
        <Text style={styles.progressText}>Pokédex {completion}%</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${completion}%` }]} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterText}>Mostra solo registrati</Text>
        <Switch value={onlyOwned} onValueChange={setOnlyOwned} />
      </View>

      <FlatList
        data={filteredList}
        numColumns={3}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 180 }}
        renderItem={({ item }) => {
          const owned = checkOwned(item.id)
          const shiny = checkShiny(item.id)

          return (
            <TouchableOpacity
              style={[styles.card, owned && styles.ownedCard]}
              onPress={async () => {
                await playClick()
                router.push(`/pokemon/${item.id}?name=${item.name}&sprite=${item.sprite}`)
              }}
            >
              <Image source={{ uri: item.sprite }} style={styles.image} />
              {shiny && <Text style={styles.shiny}>✨</Text>}
              <Text style={styles.name}>{item.name}</Text>
            </TouchableOpacity>
          )
        }}
      />

      <View style={styles.statsBar}>
        <Text style={styles.statText}>📊 {totalOwned} Registrati</Text>
        <Text style={styles.statText}>✨ {totalShiny} Shiny</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e2a38', paddingTop: 50 },
  settingsBtn: { position: 'absolute', top: 55, right: 18, zIndex: 10 },
  settingsText: { fontSize: 22, color: 'white' },
  searchBar: { backgroundColor: '#2b3a4d', marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 14, color: 'white', fontFamily: 'Nunito_400Regular' },
  progressBox: { marginHorizontal: 15, marginBottom: 12 },
  progressText: { color: 'white', marginBottom: 6, fontFamily: 'Nunito_700Bold' },
  progressBarBg: { height: 12, backgroundColor: '#333', borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4caf50' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 15, marginBottom: 10 },
  filterText: { color: 'white', fontFamily: 'Nunito_400Regular' },
  card: { flex: 1, alignItems: 'center', margin: 10, padding: 8, borderRadius: 16, backgroundColor: '#2a3747' },
  ownedCard: { borderWidth: 2, borderColor: '#4caf50' },
  image: { width: 72, height: 72 },
  name: { fontSize: 12, color: 'white', fontFamily: 'Nunito_400Regular' },
  shiny: { position: 'absolute', top: 2, right: 6, fontSize: 18 },
  statsBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 18, paddingBottom: 50 },
  statText: { color: '#90caf9', fontFamily: 'Nunito_700Bold' },
})