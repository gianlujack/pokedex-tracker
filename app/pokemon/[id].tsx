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

type GameState = { owned: boolean; shiny: boolean };
type PokemonData = { forms: Record<string, GameState> };

const emptyForm = (): GameState => ({ owned: false, shiny: false });

const typeIT: Record<string,string> = {
  normal:'Normale', fire:'Fuoco', water:'Acqua', electric:'Elettro', grass:'Erba',
  ice:'Ghiaccio', fighting:'Lotta', poison:'Veleno', ground:'Terra', flying:'Volante',
  psychic:'Psico', bug:'Coleottero', rock:'Roccia', ghost:'Spettro', dragon:'Drago',
  dark:'Buio', steel:'Acciaio', fairy:'Folletto'
};

const ALL_TYPES = Object.keys(typeIT);

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
  if (realHyphenNames.has(raw)) return raw.split('-').map(w => w[0].toUpperCase()+w.slice(1)).join('-');
  if (raw === 'nidoran-m') return 'Nidoran ♂';
  if (raw === 'nidoran-f') return 'Nidoran ♀';
  const base = raw.split('-')[0];
  return base[0].toUpperCase()+base.slice(1);
};

export default function PokemonScreen() {
  const params = useLocalSearchParams();
  const [currentId, setCurrentId] = useState(Number(params.id));
  const idRef = useRef(currentId);

  const [pokemonName, setPokemonName] = useState('');
  const [forms, setForms] = useState<{ name: string; sprite: string; shiny: string }[]>([]);
  const [currentForm, setCurrentForm] = useState('');

  const [owned, setOwned] = useState(false);
  const [shiny, setShiny] = useState(false);

  const [types, setTypes] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [resistances, setResistances] = useState<string[]>([]);

  const slideX = useRef(new Animated.Value(0)).current;

  const resetStates = () => { setOwned(false); setShiny(false); };

  useEffect(() => {
    idRef.current = currentId;
    resetStates();
    loadPokemon(currentId);
  }, [currentId]);

  useEffect(() => {
    if (currentForm) {
      resetStates();
      loadSavedState(currentId, currentForm);
      loadFormTypes(currentForm);
    }
  }, [currentForm]);

  const loadFormTypes = async (formName: string) => {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formName}`);
    const data = await res.json();

    const currentTypes: string[] = data.types.map((t:any)=>t.type.name);
    setTypes(currentTypes);

    const multipliers: Record<string,number> = {};
    ALL_TYPES.forEach(t=>multipliers[t]=1);

    const typeDatas = await Promise.all(
      currentTypes.map(async t=>{
        const r = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
        return await r.json();
      })
    );

    for(const td of typeDatas){
      td.damage_relations.double_damage_from.forEach((d:any)=>multipliers[d.name]*=2);
      td.damage_relations.half_damage_from.forEach((d:any)=>multipliers[d.name]*=0.5);
      td.damage_relations.no_damage_from.forEach((d:any)=>multipliers[d.name]=0);
    }

    setWeaknesses(ALL_TYPES.filter(t=>multipliers[t]>1));
    setResistances(ALL_TYPES.filter(t=>multipliers[t]<1));
  };

  const loadPokemon = async (id:number)=>{
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();
    setPokemonName(cleanPokemonName(data.name));

    const speciesRes = await fetch(data.species.url);
    const species = await speciesRes.json();

    const formList = await Promise.all(
      species.varieties.map(async(v:any)=>{
        const r = await fetch(v.pokemon.url);
        const d = await r.json();
        return {name:v.pokemon.name,sprite:d.sprites.front_default,shiny:d.sprites.front_shiny};
      })
    );

    setForms(formList);
    if(formList[0]) setCurrentForm(formList[0].name);
  };

  const loadSavedState = async(id:number,formName:string)=>{
    const saved = await AsyncStorage.getItem(`pokemon_${id}`);
    if(!saved) return;
    const parsed:PokemonData = JSON.parse(saved);
    const state = parsed.forms?.[formName]??emptyForm();
    setOwned(state.owned);
    setShiny(state.shiny);
  };

  const saveData = async(type:'owned'|'shiny',value:boolean)=>{
    if(!currentForm) return;
    const saved = await AsyncStorage.getItem(`pokemon_${currentId}`);
    const parsed:PokemonData = saved?JSON.parse(saved):{forms:{}};
    const formState = parsed.forms[currentForm]??emptyForm();
    if(type==='shiny'&&value) formState.owned=true;
    if(type==='owned'&&!value) formState.shiny=false;
    formState[type]=value;
    parsed.forms[currentForm]=formState;
    await AsyncStorage.setItem(`pokemon_${currentId}`,JSON.stringify(parsed));
  };

  const activeForm = forms.find(f=>f.name===currentForm);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>12&&Math.abs(g.dx)>Math.abs(g.dy),
      onPanResponderRelease:(_,g)=>{
        const id=idRef.current;
        if(g.dx>35&&id>1)setCurrentId(id-1);
        else if(g.dx<-35&&id<1025)setCurrentId(id+1);
      }
    })
  ).current;

  const Toggle=({label,value,setValue,type,disabled=false}:any)=>(
    <TouchableOpacity
      style={[styles.toggle,value&&styles.toggleActive,disabled&&styles.toggleDisabled]}
      disabled={disabled}
      onPress={()=>{const v=!value;setValue(v);saveData(type,v);}}
    >
      <Text style={styles.toggleText}>{label}</Text>
    </TouchableOpacity>
  );

  return(
    <>
      <Stack.Screen options={{headerStyle:{backgroundColor:'#000'},headerTintColor:'#fff',headerTitle:''}}/>
      <Animated.View {...panResponder.panHandlers} style={styles.wrapper}>
        <ScrollView style={styles.container} contentContainerStyle={{paddingBottom:80}}>

          <View style={styles.header}>
            <Text style={styles.dexNumber}>#{currentId}</Text>
            <Text style={styles.title}>{pokemonName}</Text>
          </View>

          <View style={styles.formSelector}>
            {forms.map(f=>(
              <TouchableOpacity key={f.name} onPress={()=>setCurrentForm(f.name)}>
                {f.sprite&&<Image source={{uri:f.sprite}} style={[styles.formIcon,currentForm===f.name&&styles.formActive]}/>}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.screen}>
            {activeForm?.sprite&&<Image source={{uri:shiny?activeForm.shiny:activeForm.sprite}} style={styles.sprite}/>}
          </View>

          <View style={styles.typesBox}>
            <Text style={styles.typeTitle}>Tipo</Text>
            {types.map(t=><Text key={t} style={styles.typeText}>{typeIT[t]}</Text>)}
          </View>

          <View style={styles.bottomBattleBox}>
            <View style={styles.bottomCol}>
              <Text style={styles.typeTitle}>Debolezza</Text>
              {weaknesses.map(w=><Text key={w} style={styles.weakText}>{typeIT[w]}</Text>)}
            </View>
            <View style={styles.bottomCol}>
              <Text style={styles.typeTitle}>Resistenza</Text>
              {resistances.map(r=><Text key={r} style={styles.resistText}>{typeIT[r]}</Text>)}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Pokémon GO</Text>
            <Toggle label="Registrato" value={owned} setValue={setOwned} type="owned"/>
            <Toggle label="Shiny ✨" value={shiny} setValue={setShiny} type="shiny" disabled={!owned}/>
          </View>

        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles=StyleSheet.create({
  wrapper:{flex:1},
  container:{flex:1,backgroundColor:'#d32f2f',padding:15},
  header:{alignItems:'center',marginBottom:10},
  dexNumber:{color:'white',fontSize:18,fontFamily:'Nunito_700Bold'},
  title:{color:'white',fontSize:26,fontFamily:'Nunito_700Bold'},
  screen:{backgroundColor:'#000',borderRadius:15,padding:15,alignItems:'center',marginVertical:15},
  sprite:{width:160,height:160},
  formSelector:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',marginVertical:10},
  formIcon:{width:54,height:54,margin:4},
  formActive:{borderWidth:2,borderColor:'#fff',borderRadius:8},
  typesBox:{alignItems:'center',marginVertical:6},
  typeTitle:{color:'white',fontWeight:'bold',fontFamily:'Nunito_700Bold'},
  typeText:{color:'#fff',fontFamily:'Nunito_400Regular'},
  weakText:{color:'#ffeb3b',fontFamily:'Nunito_400Regular'},
  resistText:{color:'#81d4fa',fontFamily:'Nunito_400Regular'},
  bottomBattleBox:{flexDirection:'row',justifyContent:'space-between',marginVertical:8},
  bottomCol:{flex:1,alignItems:'center'},
  panel:{backgroundColor:'white',borderRadius:12,padding:12,marginBottom:15},
  panelTitle:{fontWeight:'bold',marginBottom:8,fontFamily:'Nunito_700Bold'},
  toggle:{backgroundColor:'#333',padding:10,borderRadius:8,marginVertical:4},
  toggleActive:{backgroundColor:'#4caf50'},
  toggleDisabled:{backgroundColor:'#777',opacity:0.4},
  toggleText:{color:'white',textAlign:'center',fontFamily:'Nunito_400Regular'},
});