import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type GameKey = 'home' | 'za' | 'go';
type DataType = 'owned' | 'shiny';
type PokemonData = Record<GameKey, { owned: boolean; shiny: boolean }>;

export default function PokedexScreen() {
  const [pokemonList, setPokemonList] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, PokemonData>>({});
  const [search, setSearch] = useState('');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchPokemon();
    loadProgress();
  }, []);

  const playClick = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/click.mp3')
    );
    await sound.playAsync();
  };

  const fetchPokemon = async () => {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
    const data = await res.json();

    const formatted = data.results.map((p: any, index: number) => {
      let name = p.name;
      if (name === 'nidoran-m') name = 'Nidoran ♂';
      else if (name === 'nidoran-f') name = 'Nidoran ♀';
      else name = name.charAt(0).toUpperCase() + name.slice(1);

      return {
        id: index + 1,
        name,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${index + 1}.png`,
      };
    });

    setPokemonList(formatted);
  };

  const loadProgress = async () => {
    const keys = await AsyncStorage.getAllKeys();
    const pokemonKeys = keys.filter((k) => k.startsWith('pokemon_'));
    const stores = await AsyncStorage.multiGet(pokemonKeys);
    const map: Record<number, PokemonData> = {};
    stores.forEach(([key, value]) => {
      if (!value) return;
      const id = Number(key.replace('pokemon_', ''));
      map[id] = JSON.parse(value);
    });
    setProgressMap(map);
  };

  const checkOwned = (id: number) =>
    progressMap[id]?.home.owned ||
    progressMap[id]?.za.owned ||
    progressMap[id]?.go.owned;

  const checkShiny = (id: number) =>
    progressMap[id]?.home.shiny ||
    progressMap[id]?.za.shiny ||
    progressMap[id]?.go.shiny;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const applyBulk = async (game: GameKey, type: DataType) => {
    const entries: [string, string][] = [];

    for (const id of selectedIds) {
      const existing: PokemonData = progressMap[id] ?? {
        home: { owned: false, shiny: false },
        za: { owned: false, shiny: false },
        go: { owned: false, shiny: false },
      };

      const updated: PokemonData = {
        home: { ...existing.home },
        za: { ...existing.za },
        go: { ...existing.go },
      };

      if (type === 'shiny') {
        updated[game].owned = true;
        updated[game].shiny = true;
      } else {
        updated[game].owned = true;
      }

      entries.push([`pokemon_${id}`, JSON.stringify(updated)]);
    }

    await AsyncStorage.multiSet(entries);
    await loadProgress();
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const BulkButton = ({ label, onPress }: any) => (
    <TouchableOpacity style={styles.bulkBtn} onPress={onPress}>
      <Text style={styles.bulkText}>{label}</Text>
    </TouchableOpacity>
  );

  const totalOwned = Object.values(progressMap).filter(
    (p) => p.home.owned || p.za.owned || p.go.owned
  ).length;

  const totalShiny = Object.values(progressMap).filter(
    (p) => p.home.shiny || p.za.shiny || p.go.shiny
  ).length;

  const completion = pokemonList.length
    ? Math.round((totalOwned / pokemonList.length) * 100)
    : 0;

  const filteredList = pokemonList
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => (onlyOwned ? checkOwned(p.id) : true));

  return (
    <View style={styles.container}>
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedIds.length} selezionati</Text>
          <View style={styles.bulkRow}>
            <BulkButton label="HOME" onPress={() => applyBulk('home', 'owned')} />
            <BulkButton label="✨ HOME" onPress={() => applyBulk('home', 'shiny')} />
            <BulkButton label="ZA" onPress={() => applyBulk('za', 'owned')} />
            <BulkButton label="✨ ZA" onPress={() => applyBulk('za', 'shiny')} />
            <BulkButton label="GO" onPress={() => applyBulk('go', 'owned')} />
            <BulkButton label="✨ GO" onPress={() => applyBulk('go', 'shiny')} />
            <BulkButton label="❌" onPress={() => { setSelectedIds([]); setSelectionMode(false); }} />
          </View>
        </View>
      )}

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
          const owned = checkOwned(item.id);
          const shiny = checkShiny(item.id);

          return (
            <TouchableOpacity
              style={[
                styles.card,
                owned && styles.ownedCard,
                selectedIds.includes(item.id) && styles.selectedCard,
              ]}
              onLongPress={() => {
                setSelectionMode(true);
                toggleSelect(item.id);
              }}
              onPress={async () => {
                if (selectionMode) toggleSelect(item.id);
                else {
                  await playClick();
                  router.push(`/pokemon/${item.id}?name=${item.name}&sprite=${item.sprite}`);
                }
              }}
            >
              <Image source={{ uri: item.sprite }} style={styles.image} />
              {shiny && <Text style={styles.shiny}>✨</Text>}
              <Text style={styles.name}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.statsBar}>
        <Text style={styles.statText}>📊 {totalOwned} Registrati</Text>
        <Text style={styles.statText}>✨ {totalShiny} Shiny</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e2a38', paddingTop: 50 },
  searchBar: { backgroundColor: '#2b3a4d', marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 14, color: 'white', fontFamily: 'Nunito_400Regular' },
  progressBox: { marginHorizontal: 15, marginBottom: 12 },
  progressText: { color: 'white', marginBottom: 6, fontFamily: 'Nunito_700Bold' },
  progressBarBg: { height: 12, backgroundColor: '#333', borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4caf50' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginBottom: 10 },
  filterText: { color: 'white', fontFamily: 'Nunito_400Regular' },
  card: { flex: 1, alignItems: 'center', margin: 10, padding: 8, borderRadius: 16, backgroundColor: '#2a3747' },
  ownedCard: { borderWidth: 2, borderColor: '#4caf50' },
  selectedCard: { borderWidth: 3, borderColor: '#ffd600' },
  image: { width: 72, height: 72 },
  name: { fontSize: 12, color: 'white', fontFamily: 'Nunito_400Regular' },
  shiny: { position: 'absolute', top: 2, right: 6, fontSize: 18 },
  statsBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 18, paddingBottom: 50 },
  statText: { color: '#90caf9', fontFamily: 'Nunito_700Bold' },
  selectionBar: { backgroundColor: '#000', paddingTop: 10, paddingBottom: 10, alignItems: 'center' },
  selectionText: { color: 'white', fontFamily: 'Nunito_700Bold' },
  bulkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  bulkBtn: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, margin: 4 },
  bulkText: { color: 'white', fontFamily: 'Nunito_700Bold' },
});