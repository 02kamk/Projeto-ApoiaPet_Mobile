import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, colors, LinkButton, Segment, styles as s, themedStyles, useTheme, useSharedSheet } from '../ui';
import { Listing, petStatus, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Photo, pickPhoto, uploadPhoto } from '../backend/photos';
import { PetInsights, StatusCounters, StatusFilter } from './PetInsights';
import { OngPublicProfile } from './OngPublicProfile';
import { Feedback, fetchPlace, Input, Place, proximity, StoredPhoto, useAction } from './components';
import { testOptions, testResults } from '../../backend/lib/health';
const groups = [
  { species: 'Cão', title: 'Cães' },
  { species: 'Gato', title: 'Gatos' },
  { species: 'Outro', title: 'Outros' },
];
export function PetsPanel() {
  const { user, profile } = useSession();
  const ong = profile!.role === 'ong';
  const pets = useRecords<Listing>('pets', ong ? 'ongId' : 'listed', ong ? user!.uid : true);
  const home: Place = { city: profile!.city, state: profile!.state, cityCode: profile!.cityCode };
  const [place, setPlace] = useState<Place>(home);
  const [scope, setScope] = useState<Scope>('near');
  const [openId, setOpenId] = useState('');
  const [species, setSpecies] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const action = useAction();
  const visible = ong ? pets.records : pets.records
    .filter(pet => scope === 'near' || (scope === 'city' ? proximity(pet, place) === 0 : proximity(pet, place) <= 1))
    .sort((a, b) => proximity(a, place) - proximity(b, place));
  const opened = visible.find(pet => pet.id === openId) || null;
  return <>
    {ong && <Button title="+ Cadastrar animal" onPress={() => router.push('/pet-form')} />}
    {!ong && <LocationFilter place={place} home={home} scope={scope} cities={citiesWithPets(pets.records, home)} onPlace={setPlace} onScope={setScope} />}
    <Feedback message={pets.error || action.message} />
    {pets.loading && <ActivityIndicator accessibilityLabel="Carregando animais" />}
    {!pets.loading && !pets.error && !visible.length && <View style={{ alignItems: 'center', paddingVertical: 24, gap: 4 }}>
      <Text style={[s.muted, { textAlign: 'center' }]}>{ong ? 'Nenhum animal cadastrado ainda.' : `Nenhum animal ${scope === 'city' ? `em ${place.city}` : scope === 'state' ? `em ${place.state}` : 'disponível'} no momento.`}</Text>
      {!ong && scope !== 'near' && <LinkButton title="Ver os mais próximos" onPress={() => setScope('near')} />}
    </View>}
    {!ong && groups.map(group => {
      const list = visible.filter(pet => inGroup(pet, group.species));
      return list.length > 0 && <Carousel key={group.species} title={group.title} pets={list} ong={ong} near={pet => proximity(pet, place) === 0} onOpen={pet => setOpenId(pet.id)} />;
    })}
    {ong && visible.length > 0 && (() => {
      // ONG: um carrossel só, com o título virando seletor de espécie; a situação filtra a lista.
      const filtered = status ? visible.filter(pet => pet.status === status) : visible;
      const counts = Object.fromEntries(groups.map(group => [group.species, filtered.filter(pet => inGroup(pet, group.species)).length]));
      const current = species || groups.find(group => counts[group.species] > 0)?.species || groups[0].species;
      const list = filtered.filter(pet => inGroup(pet, current));
      return <>
        <StatusCounters pets={visible} value={status} onChange={setStatus} />
        {list.length > 0 ? <Carousel compact title={groups.find(group => group.species === current)!.title} pets={list} ong near={() => false} onOpen={pet => setOpenId(pet.id)}
          header={<SpeciesSelector value={current} counts={counts} onChange={setSpecies} />} />
          : <View style={{ gap: 8 }}><SpeciesSelector value={current} counts={counts} onChange={setSpecies} /><Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>Nenhum animal {status ? 'nesta situação' : 'desta espécie'}.</Text></View>}
        <PetInsights pets={visible} onOpen={pet => setOpenId(pet.id)} />
      </>;
    })()}
    {opened && <PetDetails pet={opened} ong={ong} busy={action.busy} onClose={() => setOpenId('')} onEdit={() => { setOpenId(''); router.push({ pathname: '/pet-form', params: { id: opened.id } }); }} onToggle={() => void action.run(() => call('togglePet', { petId: opened.id }))} />}
  </>;
}
type Scope = 'near' | 'city' | 'state';
type CityCount = Place & { count: number };
// Cidades que têm animais no catálogo: as do estado da pessoa primeiro, depois as com mais animais.
function citiesWithPets(pets: Listing[], home: Place): CityCount[] {
  const byCity = new Map<string, CityCount>();
  for (const pet of pets) {
    if (!pet.cityCode) continue;
    const current = byCity.get(pet.cityCode);
    if (current) current.count++;
    else byCity.set(pet.cityCode, { city: pet.city, state: pet.state, cityCode: pet.cityCode, count: 1 });
  }
  return [...byCity.values()].sort((a, b) => proximity(a, home) - proximity(b, home) || b.count - a.count || a.city.localeCompare(b.city));
}
const nativeDriver = Platform.OS !== 'web';
function CityShortcuts({ cities, place, home, scope, onPlace, onScope }: { cities: CityCount[]; place: Place; home: Place; scope: Scope; onPlace: (place: Place) => void; onScope: (scope: Scope) => void }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  if (!cities.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
    {cities.map(item => {
      const active = scope === 'city' && item.cityCode === place.cityCode;
      return <Pressable key={item.cityCode} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Ver animais em ${item.city}, ${item.count} disponíveis`}
        onPress={() => { if (active) { onPlace(home); onScope('near'); } else { onPlace(item); onScope('city'); } }}
        style={[styles.cityChip, { backgroundColor: active ? theme.primary : theme.mint }]}>
        <Text style={[styles.cityChipText, { color: active ? colors.white : theme.primary }]}>{item.city}</Text>
        <Text style={[styles.cityChipCount, { color: active ? colors.white : theme.primary }]}>{item.count}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}
function LocationFilter({ place, home, scope, cities, onPlace, onScope }: { place: Place; home: Place; scope: Scope; cities: CityCount[]; onPlace: (place: Place) => void; onScope: (scope: Scope) => void }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [postalCode, setPostalCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const custom = place.cityCode !== home.cityCode;
  async function search(value: string) {
    setSearching(true); setError('');
    try { onPlace(await fetchPlace(value)); setEditing(false); setPostalCode(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível consultar o CEP.'); }
    finally { setSearching(false); }
  }
  return <View style={{ gap: 12 }}>
    <View style={styles.location}>
      <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.white} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.muted}>Buscando perto de</Text>
        <Text style={s.label} numberOfLines={1}>{place.city}, {place.state}</Text>
      </View>
      <LinkButton title={editing ? 'Cancelar' : 'Alterar'} onPress={() => { setEditing(!editing); setError(''); setPostalCode(''); }} />
    </View>
    {editing && <View style={{ gap: 6 }}>
      <Input label="CEP da região" placeholder="00000000" numeric maxLength={8} value={postalCode} onChange={value => { const digits = value.replace(/\D/g, '').slice(0, 8); setPostalCode(digits); setError(''); if (digits.length === 8) void search(digits); }} right={searching ? <ActivityIndicator style={{ paddingHorizontal: 14 }} color={theme.primary} /> : null} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {custom && <LinkButton align="flex-start" title={`Usar meu endereço (${home.city})`} onPress={() => { onPlace(home); setEditing(false); }} />}
    </View>}
    <CityShortcuts cities={cities} place={place} home={home} scope={scope} onPlace={onPlace} onScope={onScope} />
    <Segment compact options={['near', 'city', 'state']} labels={{ near: 'Mais próximos', city: 'Na cidade', state: 'No estado' }} value={scope} onChange={value => onScope(value as Scope)} />
  </View>;
}
const SWITCH_AT = 0.7; // fraction of the gap between photos needed to move to the next one
const MARGIN = 22; // page side margin, so the first photo lines up with the section title
// Fractional photo index for a scroll offset: 1.5 = halfway between photos 1 and 2.
function photoPosition(x: number, offsets: number[]) {
  let i = 0;
  while (i < offsets.length - 2 && x >= offsets[i + 1]) i++;
  const span = (offsets[i + 1] ?? offsets[i] + 1) - offsets[i];
  return i + (x - offsets[i]) / span;
}
const inGroup = (pet: Listing, species: string) => species === 'Outro' ? !['Cão', 'Gato'].includes(pet.species) : pet.species === species;
// Título do carrossel como seletor de espécie (com a quantidade de cada uma).
function SpeciesSelector({ value, counts, onChange }: { value: string; counts: Record<string, number>; onChange: (species: string) => void }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = groups.find(group => group.species === value)!;
  return <View style={{ gap: 8, zIndex: 2 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Espécie: ${current.title}. Trocar`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={({ pressed }) => [styles.speciesButton, pressed && { opacity: 0.8 }]}>
      <Text style={s.subtitle}>{current.title}</Text>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={theme.primary} />
      <Text style={[s.muted, { marginLeft: 'auto' }]}>{counts[value]} {counts[value] === 1 ? 'animal' : 'animais'}</Text>
    </Pressable>
    {open && <View style={styles.speciesMenu} accessibilityRole="radiogroup">{groups.map(group => {
      const active = group.species === value;
      return <Pressable key={group.species} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => { onChange(group.species); setOpen(false); }} style={[styles.speciesOption, active && { backgroundColor: theme.mint }]}>
        <MaterialCommunityIcons name={group.species === 'Cão' ? 'dog' : group.species === 'Gato' ? 'cat' : 'rabbit'} size={20} color={theme.primary} />
        <Text style={[styles.speciesText, active && { color: theme.primary }]}>{group.title}</Text>
        <Text style={s.muted}>{counts[group.species]}</Text>
        {active && <MaterialCommunityIcons name="check" size={18} color={theme.primary} />}
      </Pressable>;
    })}</View>}
  </View>;
}
function Carousel({ title, pets, ong, near, onOpen, header, compact = false }: { title: string; pets: Listing[]; ong: boolean; near: (pet: Listing) => boolean; onOpen: (pet: Listing) => void; header?: React.ReactNode; compact?: boolean }) {
  const styles = useStylesSheet();
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(Math.min(width, 650));
  const [scrollX] = useState(() => new Animated.Value(0));
  const cardWidth = compact ? Math.min(containerWidth * 0.5, 210) : Math.min(containerWidth * 0.74, 320);
  const gap = 6;
  const interval = cardWidth + gap;
  // The first photo rests aligned with the page margin; every other one rests centered.
  const side = Math.max(MARGIN, (containerWidth - cardWidth) / 2);
  const count = pets.length;
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => i === 0 ? 0 : Math.max(0, MARGIN + i * interval - side)), [count, interval, side]);
  // react-native-web ignores snapToOffsets: once scrolling stops between two
  // photos, glide to one of them (native already snaps on its own).
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let current = 0; // photo the carousel last settled on
    const id = scrollX.addListener(({ value: x }) => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        // Only change photo after dragging SWITCH_AT of the way from the current one.
        const position = photoPosition(x, offsets);
        const target = position > current ? Math.floor(position + 1 - SWITCH_AT) : Math.ceil(position - 1 + SWITCH_AT);
        current = Math.min(Math.max(target, 0), count - 1);
        if (Math.abs(offsets[current] - x) > 2) scroller.current?.scrollTo({ x: offsets[current], animated: true });
      }, 140);
    });
    return () => { clearTimeout(settle); scrollX.removeListener(id); };
  }, [scrollX, offsets, count]);
  return <View style={{ gap: 8 }}>
    {header ?? <View style={styles.sectionHeader}><Text style={s.subtitle}>{title}</Text><Text style={s.muted}>{pets.length} {pets.length === 1 ? 'animal' : 'animais'}</Text></View>}
    <Animated.ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} snapToOffsets={offsets} decelerationRate="fast" scrollEventThrottle={16}
      onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: nativeDriver })}
      style={styles.carousel} contentContainerStyle={{ paddingLeft: MARGIN, paddingRight: side, gap, paddingVertical: 10 }}>
      {pets.map((pet, i) => {
        const range = [offsets[i - 1] ?? offsets[i] - interval, offsets[i], offsets[i + 1] ?? offsets[i] + interval];
        const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
        return <Animated.View key={pet.id} style={{ width: cardWidth, height: cardWidth * (compact ? 1.25 : 1.4), transform: [{ scale }], opacity }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${pet.name}, ${pet.age}, ${pet.city}. Ver detalhes`} onPress={() => onOpen(pet)} style={({ pressed }) => [styles.slide, { flex: 1 }, pressed && { transform: [{ scale: 0.98 }] }]}>
        <GlassPhoto path={pet.photoPath} label={`Foto de ${pet.name}`} panelStyle={[styles.glass, styles.glassSplit]} panel={<>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.glassTitle} numberOfLines={1}>{pet.name}<Text style={styles.glassAge}>, {pet.age}</Text></Text>
            <View style={styles.glassRow}><MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.white} /><Text style={styles.glassText} numberOfLines={1}>{ong ? pet.city : `${pet.city} · ${pet.ongName}`}</Text></View>
          </View>
          <View style={styles.arrow}><MaterialCommunityIcons name="chevron-right" size={22} color="rgba(37, 37, 37, 0.38)" /></View>
        </>}>
          {pet.status !== 'available' ? <View style={styles.slideBadge}><Badge text={petStatus[pet.status]} /></View> : near(pet) && <Text style={[styles.slideBadge, styles.nearTag]}>Perto de você</Text>}
        </GlassPhoto>
      </Pressable>
        </Animated.View>;
      })}
    </Animated.ScrollView>
  </View>;
}
function GlassPhoto({ path, label, panel, panelStyle, children }: React.PropsWithChildren<{ path: string; label: string; panel: React.ReactNode; panelStyle: StyleProp<ViewStyle> }>) {
  const target = useRef<React.ComponentRef<typeof View>>(null);
  // Android: a live blur per card is re-rendered every frame while the carousel animates, which
  // made scrolling stutter on phones. A translucent panel looks close and costs nothing.
  if (Platform.OS === 'android') return <>
    <StoredPhoto path={path} label={label} style={StyleSheet.absoluteFill} />
    {children}
    <View style={[panelStyle, { backgroundColor: 'rgba(28, 28, 28, 0.55)' }]}>{panel}</View>
  </>;
  return <>
    <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
      <StoredPhoto path={path} label={label} style={StyleSheet.absoluteFill} />
    </BlurTargetView>
    {children}
    <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={20} tint="systemUltraThinMaterialDark" style={panelStyle}>{panel}</BlurView>
  </>;
}
function PetDetails({ pet, ong, busy, onClose, onEdit, onToggle }: { pet: Listing; ong: boolean; busy: boolean; onClose: () => void; onEdit: () => void; onToggle: () => void }) {
  const sh = useSharedSheet();
  const styles = useStylesSheet();
  const insets = useSafeAreaInsets();
  const [applying, setApplying] = useState(false);
  const [ongOpen, setOngOpen] = useState(false);
  const tests = pet.health?.tests.map(test => `${testOptions[pet.species]?.find(option => option.id === test.id)?.label || test.id}: ${testResults[test.result] || 'Não informado'}`).join('\n');
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.details, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <GlassPhoto path={pet.photoPath} label={`Foto de ${pet.name}`} panelStyle={[styles.glass, styles.glassLarge]} panel={<>
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}><Text style={[styles.glassTitle, { fontSize: 22, flex: 1 }]} numberOfLines={1}>{pet.name}</Text><Badge text={petStatus[pet.status]} /></View>
          <View style={styles.glassRow}><MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.white} /><Text style={[styles.glassText, { fontSize: 14 }]}>{pet.city} / {pet.state}</Text></View>
        </>}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onClose} hitSlop={8} style={styles.round}><MaterialCommunityIcons name="chevron-left" size={28} color={colors.white} /></Pressable>
        </GlassPhoto>
      </View>
      <View style={styles.facts}>
        <Fact icon="cake-variant-outline" text={pet.age} />
        <Fact icon="paw" text={pet.species} />
        {ong ? <Fact icon="home-heart" text={pet.ongName} /> : <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil da ONG ${pet.ongName}`} onPress={() => setOngOpen(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' }, pressed && { opacity: 0.7 }]}><Fact icon="home-heart" text={pet.ongName} /><MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} /></Pressable>}
      </View>
      <Text style={s.subtitle}>Sobre</Text>
      <Text style={s.text}>{pet.description}</Text>
      {!!pet.vaccinesDone && <Info label="Vacinas aplicadas" value={pet.vaccinesDone} />}
      {!!pet.vaccinesNeeded && <Info label="Vacinas pendentes" value={pet.vaccinesNeeded} />}
      {!!tests && <Info label="Testes" value={tests} />}
      {!!pet.health?.notes && <Info label="Observações" value={pet.health.notes} />}
      {ong ? <View style={s.row}>
        <Button disabled={busy} title="Editar" onPress={onEdit} />
        {['available', 'paused'].includes(pet.status) && <Button disabled={busy} secondary title={pet.status === 'available' ? 'Pausar' : 'Reativar'} onPress={onToggle} />}
      </View> : pet.status !== 'available' ? <Text style={sh.notice}>Adoção em andamento.</Text> : applying ? <ApplicationForm pet={pet} onClose={() => setApplying(false)} onSent={onClose} /> : <Button title="Quero adotar ♥" onPress={() => setApplying(true)} />}
    </ScrollView>
    {ongOpen && <OngPublicProfile ongId={pet.ongId} onClose={() => setOngOpen(false)} onDonate={id => { setOngOpen(false); onClose(); router.setParams({ tab: 'payments', ong: id }); }} />}
  </Modal>;
}
function Fact({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  return <View style={styles.fact}><View style={styles.factIcon}><MaterialCommunityIcons name={icon} size={18} color={theme.primary} /></View><Text style={styles.factText} numberOfLines={1}>{text}</Text></View>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 2 }}><Text style={s.label}>{label}</Text><Text style={s.text}>{value}</Text></View>;
}
function ApplicationForm({ pet, onClose, onSent }: { pet: Listing; onClose: () => void; onSent: () => void }) {
  const [housing, setHousing] = useState('Casa');
  const [safety, setSafety] = useState('');
  const [routine, setRoutine] = useState('');
  const [motivation, setMotivation] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [consent, setConsent] = useState(false);
  const action = useAction();
  return <View style={{ gap: 14 }}>
    <Text style={s.subtitle}>Adotar {pet.name}</Text>
    <Segment options={['Casa', 'Apartamento', 'Outro']} value={housing} onChange={setHousing} />
    <Input label={housing === 'Apartamento' ? 'Telas e proteções' : 'Segurança do ambiente'} placeholder={housing === 'Apartamento' ? 'Janelas, varanda, saídas' : 'Muros, portões, saídas'} value={safety} onChange={setSafety} multiline maxLength={2000} />
    <Input label="Rotina de cuidados" placeholder="Quem cuida e como" value={routine} onChange={setRoutine} multiline maxLength={2000} />
    <Input label="Por que adotar?" value={motivation} onChange={setMotivation} multiline maxLength={2000} />
    <Text style={s.label}>Fotos do ambiente (opcional, {photos.length}/6)</Text>
    <Text style={s.muted}>Ajudam a ONG a conhecer onde o animal vai morar. Ela também pode pedir pelo chat.</Text>
    {photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={{ gap: 4 }}><Image source={{ uri: photo.uri }} accessibilityLabel={`Foto do ambiente ${index + 1}`} style={{ width: '100%', height: 170, borderRadius: 16 }} /><LinkButton align="flex-end" disabled={action.busy} title="Remover" onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} /></View>)}
    {photos.length < 6 && <Button disabled={action.busy} secondary title="+ Adicionar foto" onPress={() => void action.run(async () => { const photo = await pickPhoto(); if (photo) setPhotos(current => [...current, photo]); })} />}
    <View style={[s.row, { alignItems: 'center', flexWrap: 'nowrap' }]}><Switch accessibilityLabel="Autorizo compartilhar meus dados e fotos com esta ONG para análise da candidatura" value={consent} onValueChange={setConsent} /><Text style={[s.muted, { flex: 1 }]}>Autorizo compartilhar meus dados e fotos com a ONG.</Text></View>
    <Feedback message={action.message} />
    <Button disabled={action.busy} title={action.busy ? 'Enviando…' : 'Enviar candidatura'} onPress={() => void action.run(async () => {
      if (!safety.trim() || !routine.trim() || !motivation.trim()) throw Error('Responda todas as perguntas.');
      if (!consent) throw Error('Autorize o compartilhamento dos seus dados com a ONG.');
      const photoPaths = [];
      for (const photo of photos) photoPaths.push(await uploadPhoto(photo, 'home', pet.id));
      await call('submitApplication', { petId: pet.id, housing, safety, routine, motivation, photoPaths, consent });
      onSent(); router.setParams({ tab: 'applications' });
    })} />
    <LinkButton disabled={action.busy} title="Cancelar" onPress={onClose} />
  </View>;
}
const useStylesSheet = themedStyles(t => StyleSheet.create({
  speciesButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'stretch', minHeight: 40 },
  speciesMenu: { backgroundColor: colors.white, borderRadius: 18, padding: 6, gap: 2, borderWidth: 1, borderColor: t.soft },
  speciesOption: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 12 },
  speciesText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.dark },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  carousel: { marginHorizontal: -22 },
  slide: { borderRadius: 28, overflow: 'hidden', backgroundColor: t.soft, shadowColor: colors.dark, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  slideBadge: { position: 'absolute', top: 14, left: 14 },
  nearTag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.82)', color: colors.dark, fontSize: 11, fontWeight: '700', letterSpacing: 0.2, overflow: 'hidden' },
  glass: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, gap: 2, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.35)' },
  glassSplit: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255, 255, 255, 0.92)', alignItems: 'center', justifyContent: 'center' },
  glassLarge: { left: 14, right: 14, bottom: 14, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  glassTitle: { color: colors.white, fontSize: 16, fontWeight: '800', textShadowColor: 'rgba(0, 0, 0, 0.25)', textShadowRadius: 4 },
  glassAge: { fontSize: 13, fontWeight: '500', color: colors.white },
  glassRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  glassText: { color: colors.white, fontSize: 12, flexShrink: 1, opacity: 0.9 },
  details: { padding: 16, gap: 16, width: '100%', maxWidth: 650, alignSelf: 'center' },
  hero: { height: 440, borderRadius: 32, overflow: 'hidden', backgroundColor: t.soft, shadowColor: colors.dark, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  round: { position: 'absolute', top: 16, left: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(16, 46, 36, 0.55)', alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: 16, rowGap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  factIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
  factText: { flexShrink: 1, color: colors.text, fontWeight: '600' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, shadowColor: colors.dark, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  locationIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#B3261E', fontWeight: '600', paddingLeft: 4 },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 14, borderRadius: 17 },
  cityChipText: { fontSize: 13, fontWeight: '700' },
  cityChipCount: { fontSize: 12, fontWeight: '600', opacity: 0.75 },
}));
