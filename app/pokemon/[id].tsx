import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type GameKey = 'home' | 'za' | 'go';
type DataType = 'owned' | 'shiny';
type PokemonData = Record<GameKey, { owned: boolean; shiny: boolean }>;

export default function PokemonScreen() {
  const params = useLocalSearchParams();
  const [currentId, setCurrentId] = useState(Number(params.id));
  const idRef = useRef(currentId);

  const [pokemonName, setPokemonName] = useState('');
  const [sprite, setSprite] = useState('');

  const slideX = useRef(new Animated.Value(0)).current;

  const [homeOwned, setHomeOwned] = useState(false);
  const [zaOwned, setZaOwned] = useState(false);
  const [goOwned, setGoOwned] = useState(false);
  const [homeShiny, setHomeShiny] = useState(false);
  const [zaShiny, setZaShiny] = useState(false);
  const [goShiny, setGoShiny] = useState(false);

  useEffect(() => {
    idRef.current = currentId;
    loadPokemon(currentId);
  }, [currentId]);

  const loadPokemon = async (id: number) => {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();

    const formattedName =
      data.name === 'nidoran-m'
        ? 'Nidoran ♂'
        : data.name === 'nidoran-f'
        ? 'Nidoran ♀'
        : data.name.charAt(0).toUpperCase() + data.name.slice(1);

    setPokemonName(formattedName);
    setSprite(data.sprites.front_default);

    const saved = await AsyncStorage.getItem(`pokemon_${id}`);
    if (!saved) return;

    const p: PokemonData = JSON.parse(saved);
    setHomeOwned(p.home.owned);
    setZaOwned(p.za.owned);
    setGoOwned(p.go.owned);
    setHomeShiny(p.home.shiny);
    setZaShiny(p.za.shiny);
    setGoShiny(p.go.shiny);
  };

  const animateSwitch = (direction: number, nextId: number) => {
    if (nextId === idRef.current) return;

    Animated.timing(slideX, {
      toValue: direction * -350,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideX.setValue(direction * 350);
      idRef.current = nextId;
      setCurrentId(nextId);

      Animated.timing(slideX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        const id = idRef.current;

        if (g.dx > 35 && id > 1) animateSwitch(-1, id - 1);
        else if (g.dx < -35 && id < 1025) animateSwitch(1, id + 1);
      },
    })
  ).current;

  const saveData = async (game: GameKey, type: DataType, value: boolean) => {
    const current: PokemonData = {
      home: { owned: homeOwned, shiny: homeShiny },
      za: { owned: zaOwned, shiny: zaShiny },
      go: { owned: goOwned, shiny: goShiny },
    };

    if (type === 'shiny' && value) current[game].owned = true;
    if (type === 'owned' && !value) current[game].shiny = false;

    current[game][type] = value;
    await AsyncStorage.setItem(`pokemon_${currentId}`, JSON.stringify(current));
  };

  const Toggle = ({ label, value, setValue, game, type }: any) => (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive]}
      onPress={() => {
        const newVal = !value;
        setValue(newVal);
        saveData(game, type, newVal);
      }}
    >
      <Text style={styles.toggleText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitle: '',
          headerShadowVisible: false,
        }}
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.wrapper, { transform: [{ translateX: slideX }] }]}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.header}>
            <Text style={styles.dexNumber}>#{currentId}</Text>
            <Text style={styles.title}>{pokemonName}</Text>
          </View>

          <View style={styles.screen}>
            {sprite && <Image source={{ uri: sprite }} style={styles.sprite} />}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Pokémon HOME</Text>
            <Toggle label="Registrato" value={homeOwned} setValue={setHomeOwned} game="home" type="owned" />
            <Toggle label="Shiny ✨" value={homeShiny} setValue={setHomeShiny} game="home" type="shiny" />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Leggende Z-A</Text>
            <Toggle label="Registrato" value={zaOwned} setValue={setZaOwned} game="za" type="owned" />
            <Toggle label="Shiny ✨" value={zaShiny} setValue={setZaShiny} game="za" type="shiny" />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Pokémon GO</Text>
            <Toggle label="Registrato" value={goOwned} setValue={setGoOwned} game="go" type="owned" />
            <Toggle label="Shiny ✨" value={goShiny} setValue={setGoShiny} game="go" type="shiny" />
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: '#d32f2f', padding: 15 },

  scrollContent: {
    paddingBottom: 50,
  },

  header: { alignItems: 'center', marginBottom: 10 },
  dexNumber: { color: 'white', fontSize: 18 },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold' },

  screen: {
    backgroundColor: '#000',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginVertical: 15,
  },

  sprite: { width: 160, height: 160 },

  panel: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },

  panelTitle: { fontWeight: 'bold', marginBottom: 8 },

  toggle: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },

  toggleActive: { backgroundColor: '#4caf50' },
  toggleText: { color: 'white', textAlign: 'center' },
});