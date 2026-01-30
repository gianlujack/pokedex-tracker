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

type GameState = { owned: boolean; shiny: boolean }
type FormState = { go: GameState }
type PokemonData = { forms: Record<string, FormState> }

const typeMapITtoEN: Record<string,string> = {
  normale:'normal', fuoco:'fire', acqua:'water', elettro:'electric', erba:'grass',
  ghiaccio:'ice', lotta:'fighting', veleno:'poison', terra:'ground', volante:'flying',
  psico:'psychic', coleottero:'bug', roccia:'rock', spettro:'ghost', drago:'dragon',
  buio:'dark', acciaio:'steel', folletto:'fairy'
}

export default function PokedexScreen() {
  const [pokemonList, setPokemonList] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, PokemonData>>({})
  const [search, setSearch] = useState('')
  const [onlyOwned, setOnlyOwned] = useState(false)
  const router = useRouter()

  useEffect(() => { fetchPokemon() }, [])
  useFocusEffect(useCallback(() => { loadProgress() }, []))

  const playClick = async () => {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/click.mp3'))
    await sound.playAsync()
  }

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

    const detailed = await Promise.all(
      data.results.map(async (p: any, index: number) => {
        const pokeRes = await fetch(p.url)
        const poke = await pokeRes.json()

        const rawName = p.name
        let displayName = rawName

        if (rawName === 'nidoran-m') displayName = 'Nidoran ♂'
        else if (rawName === 'nidoran-f') displayName = 'Nidoran ♀'
        else if (realHyphenNames.has(rawName)) {
          displayName = rawName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
        } else if (rawName.includes('-')) {
          displayName = rawName.split('-')[0]
          displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
        } else {
          displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
        }

        return {
          id: index + 1,
          name: displayName,
          sprite: poke.sprites.front_default,
          types: poke.types.map((t: any) => t.type.name)
        }
      })
    )

    setPokemonList(detailed)
  }

  const loadProgress = async () => {
    const keys = await AsyncStorage.getAllKeys()
    const pokemonKeys = keys.filter(k => k.startsWith('pokemon_'))
    const stores = await AsyncStorage.multiGet(pokemonKeys)
    const map: Record<number, PokemonData> = {}

    stores.forEach(([key, value]) => {
      if (!value) return
      const id = Number(key.replace('pokemon_', ''))
      map[id] = JSON.parse(value)
    })

    setProgressMap(map)
  }

  const checkOwned = (id: number) => {
    const data = progressMap[id]
    if (!data?.forms) return false
    return Object.values(data.forms).some(form => form.go?.owned)
  }

  const checkShiny = (id: number) => {
    const data = progressMap[id]
    if (!data?.forms) return false
    return Object.values(data.forms).some(form => form.go?.shiny)
  }

  const totalOwned = Object.values(progressMap).filter(p =>
    p.forms && Object.values(p.forms).some(f => f.go?.owned)
  ).length

  const totalShiny = Object.values(progressMap).filter(p =>
    p.forms && Object.values(p.forms).some(f => f.go?.shiny)
  ).length

  const completion = pokemonList.length ? Math.round((totalOwned / pokemonList.length) * 100) : 0

  const filteredList = pokemonList.filter(p => {
    const q = search.toLowerCase().trim()
    if (!q) return true

    const parts = q.split(',').map(s => s.trim())

    const wantsShiny = parts.includes('cromatico')
    const notShiny = parts.includes('!cromatico')
    const wantsMissing = parts.includes('mancanti')

    const owned = checkOwned(p.id)
    const shiny = checkShiny(p.id)

    if (wantsShiny && !shiny) return false
    if (notShiny && shiny) return false
    if (wantsMissing && owned) return false

    const specialOnly = wantsShiny || notShiny || wantsMissing
    if (specialOnly && parts.length === 1) return true

    const nameMatch = p.name.toLowerCase().startsWith(parts[0])
    const typeMatch = parts.some(part => {
      const en = typeMapITtoEN[part]
      return en && p.types.includes(en)
    })

    return nameMatch || typeMatch
  })
  .filter(p => (onlyOwned ? checkOwned(p.id) : true))

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
        <Text style={styles.settingsText}>⚙️</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Cerca Pokémon..."
        placeholderTextColor="#888"
        style={styles.searchBar}
        value={search}
        onChangeText={setSearch}
      />

      {search.length > 0 && (
        <Text style={styles.resultsText}>Risultati trovati: {filteredList.length}</Text>
      )}

      <View style={styles.progressBox}>
        <Text style={styles.progressText}>Pokédex GO {completion}%</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${completion}%` }]} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterText}>Mostra solo registrati </Text>
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
        <Text style={styles.statText}>📊 {totalOwned} Registrati </Text>
        <Text style={styles.statText}>✨ {totalShiny} Cromatici </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#1e2a38',paddingTop:50},
  settingsBtn:{position:'absolute',top:55,right:18,zIndex:10},
  settingsText:{fontSize:22,color:'white'},
  searchBar:{backgroundColor:'#2b3a4d',marginHorizontal:12,marginBottom:6,padding:12,borderRadius:14,color:'white',fontFamily:'Nunito_400Regular'},
  resultsText:{color:'#ccc',textAlign:'center',marginBottom:6},
  progressBox:{marginHorizontal:15,marginBottom:12},
  progressText:{color:'white',marginBottom:6,fontFamily:'Nunito_700Bold'},
  progressBarBg:{height:12,backgroundColor:'#333',borderRadius:10,overflow:'hidden'},
  progressBarFill:{height:'100%',backgroundColor:'#4caf50'},
  filterRow:{flexDirection:'row',justifyContent:'space-between',marginHorizontal:15,marginBottom:10},
  filterText:{color:'white',fontFamily:'Nunito_400Regular'},
  card:{flex:1,alignItems:'center',margin:10,padding:8,borderRadius:16,backgroundColor:'#2a3747'},
  ownedCard:{borderWidth:2,borderColor:'#4caf50'},
  image:{width:72,height:72},
  name:{fontSize:12,color:'white',fontFamily:'Nunito_400Regular'},
  shiny:{position:'absolute',top:2,right:6,fontSize:18},
  statsBar:{position:'absolute',bottom:0,width:'100%',backgroundColor:'#000',flexDirection:'row',justifyContent:'space-around',paddingTop:18,paddingBottom:50},
  statText:{color:'#90caf9',fontFamily:'Nunito_700Bold'},
})