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

type GameState = { owned: boolean; shiny: boolean };
type FormState = Record<GameKey, GameState>;
type PokemonData = { forms: Record<string, FormState> };

const emptyForm = (): FormState => ({
  home: { owned: false, shiny: false },
  za: { owned: false, shiny: false },
  go: { owned: false, shiny: false },
});

const realHyphenNames = new Set([
  'mr-mime','mime-jr','ho-oh','porygon-z','mr-rime','type-null',
  'jangmo-o','hakamo-o','kommo-o',
  'tapu-koko','tapu-lele','tapu-bulu','tapu-fini',
  'great-tusk','scream-tail','brute-bonnet','flutter-mane','slither-wing','sandy-shocks',
  'iron-treads','iron-bundle','iron-hands','iron-jugulis','iron-moth','iron-thorns',
  'roaring-moon','walking-wake','iron-valiant',
  'wo-chien','chien-pao','ting-lu','chi-yu',
  'gouging-fire','raging-bolt','iron-boulder','iron-crown','iron-leaves',
]);

const cleanPokemonName = (raw: string) => {
  if (realHyphenNames.has(raw)) {
    return raw
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('-');
  }

  if (raw === 'nidoran-m') return 'Nidoran ♂';
  if (raw === 'nidoran-f') return 'Nidoran ♀';

  const base = raw.split('-')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
};

export default function PokemonScreen() {
  const params = useLocalSearchParams();
  const [currentId, setCurrentId] = useState(Number(params.id));
  const idRef = useRef(currentId);

  const [pokemonName, setPokemonName] = useState('');
  const [forms, setForms] = useState<{ name: string; sprite: string; shiny: string }[]>([]);
  const [currentForm, setCurrentForm] = useState<string>('');

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
    resetStates();

    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();

    setPokemonName(cleanPokemonName(data.name));

    const speciesRes = await fetch(data.species.url);
    const species = await speciesRes.json();

    const formList = await Promise.all(
      species.varieties.map(async (v: any) => {
        const r = await fetch(v.pokemon.url);
        const d = await r.json();
        return {
          name: v.pokemon.name,
          sprite: d.sprites.front_default,
          shiny: d.sprites.front_shiny,
        };
      })
    );

    setForms(formList);

    const firstForm = formList[0]?.name;
    if (firstForm) {
      setCurrentForm(firstForm);
      await loadSavedState(id, firstForm);
    }
  };

  const resetStates = () => {
    setHomeOwned(false);
    setZaOwned(false);
    setGoOwned(false);
    setHomeShiny(false);
    setZaShiny(false);
    setGoShiny(false);
  };

  const loadSavedState = async (id: number, formName: string) => {
    const saved = await AsyncStorage.getItem(`pokemon_${id}`);
    if (!saved) return;

    const parsed: PokemonData = JSON.parse(saved);
    const state = parsed.forms?.[formName] ?? emptyForm();

    setHomeOwned(state.home.owned);
    setZaOwned(state.za.owned);
    setGoOwned(state.go.owned);
    setHomeShiny(state.home.shiny);
    setZaShiny(state.za.shiny);
    setGoShiny(state.go.shiny);
  };

  useEffect(() => {
    if (currentForm) {
      resetStates();
      loadSavedState(currentId, currentForm);
    }
  }, [currentForm]);

  const saveData = async (game: GameKey, type: DataType, value: boolean) => {
    if (!currentForm) return;

    const saved = await AsyncStorage.getItem(`pokemon_${currentId}`);
    const parsed: PokemonData = saved ? JSON.parse(saved) : { forms: {} };

    const formState = parsed.forms[currentForm] ?? emptyForm();

    if (type === 'shiny' && value) formState[game].owned = true;
    if (type === 'owned' && !value) formState[game].shiny = false;

    formState[game][type] = value;
    parsed.forms[currentForm] = formState;

    await AsyncStorage.setItem(`pokemon_${currentId}`, JSON.stringify(parsed));
  };

  const activeForm = forms.find((f) => f.name === currentForm);
  const isShiny = homeShiny || zaShiny || goShiny;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        const id = idRef.current;
        if (g.dx > 35 && id > 1) setCurrentId(id - 1);
        else if (g.dx < -35 && id < 1025) setCurrentId(id + 1);
      },
    })
  ).current;

  const Toggle = ({ label, value, setValue, game, type, disabled = false }: any) => (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive, disabled && styles.toggleDisabled]}
      disabled={disabled}
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
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', headerTitle: '' }} />

      <Animated.View {...panResponder.panHandlers} style={[styles.wrapper, { transform: [{ translateX: slideX }] }]}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>

          <View style={styles.header}>
            <Text style={styles.dexNumber}>#{currentId}</Text>
            <Text style={styles.title}>{pokemonName}</Text>
          </View>

          <View style={styles.formSelector}>
            {forms.map((f) => (
              <TouchableOpacity key={f.name} onPress={() => setCurrentForm(f.name)}>
                {f.sprite && (
                  <Image source={{ uri: f.sprite }} style={[styles.formIcon, currentForm === f.name && styles.formActive]} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.screen}>
            {activeForm?.sprite && (
              <Image source={{ uri: isShiny ? activeForm.shiny : activeForm.sprite }} style={styles.sprite} />
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Pokémon HOME</Text>
            <Toggle label="Registrato" value={homeOwned} setValue={setHomeOwned} game="home" type="owned" />
            <Toggle label="Shiny ✨" value={homeShiny} setValue={setHomeShiny} game="home" type="shiny" disabled={!homeOwned} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Leggende Z-A</Text>
            <Toggle label="Registrato" value={zaOwned} setValue={setZaOwned} game="za" type="owned" />
            <Toggle label="Shiny ✨" value={zaShiny} setValue={setZaShiny} game="za" type="shiny" disabled={!zaOwned} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Pokémon GO</Text>
            <Toggle label="Registrato" value={goOwned} setValue={setGoOwned} game="go" type="owned" />
            <Toggle label="Shiny ✨" value={goShiny} setValue={setGoShiny} game="go" type="shiny" disabled={!goOwned} />
          </View>

        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: '#d32f2f', padding: 15 },
  header: { alignItems: 'center', marginBottom: 10 },
  dexNumber: { color: 'white', fontSize: 18 },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  screen: { backgroundColor: '#000', borderRadius: 15, padding: 15, alignItems: 'center', marginVertical: 15 },
  sprite: { width: 160, height: 160 },
  formSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 10 },
  formIcon: { width: 54, height: 54, margin: 4 },
  formActive: { borderWidth: 2, borderColor: '#fff', borderRadius: 8 },
  panel: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 15 },
  panelTitle: { fontWeight: 'bold', marginBottom: 8 },
  toggle: { backgroundColor: '#333', padding: 10, borderRadius: 8, marginVertical: 4 },
  toggleActive: { backgroundColor: '#4caf50' },
  toggleDisabled: { backgroundColor: '#777', opacity: 0.4 },
  toggleText: { color: 'white', textAlign: 'center' },
});