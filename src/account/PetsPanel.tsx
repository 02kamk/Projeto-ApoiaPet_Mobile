import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, colors, LinkButton, Segment, styles as s } from '../ui';
import { Listing, petStatus, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Photo, pickPhoto, uploadPhoto } from '../backend/photos';
import { Feedback, fetchPlace, Input, Place, StoredPhoto, useAction } from './components';
import { emptyHealth, Health, healthForEditing, testOptions, testResults } from '../../functions/health';
import { HealthFields } from './HealthFields';
const blank = { name: '', species: 'Gato', age: '', description: '' };
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
  const [fields, setFields] = useState(blank);
  const [health, setHealth] = useState<Health>(emptyHealth);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [openId, setOpenId] = useState('');
  const action = useAction();
  const visible = ong ? pets.records : pets.records
    .filter(pet => scope === 'near' || (scope === 'city' ? proximity(pet, place) === 0 : proximity(pet, place) <= 1))
    .sort((a, b) => proximity(a, place) - proximity(b, place));
  const opened = visible.find(pet => pet.id === openId) || null;
  function closeForm() { setFields(blank); setHealth(emptyHealth()); setPhoto(null); setEditing(null); setFormOpen(false); }
  function edit(pet: Listing) { setOpenId(''); setEditing(pet); setFields({ name: pet.name, species: pet.species, age: pet.age, description: pet.description }); setHealth(healthForEditing(pet)); setPhoto(null); setFormOpen(true); action.setMessage(''); }
  return <>
    {ong && !formOpen && <Button title="+ Cadastrar animal" onPress={() => { closeForm(); setFormOpen(true); action.setMessage(''); }} />}
    {ong && formOpen && <Card>
      <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}><Text style={s.subtitle}>{editing ? `Editar ${editing.name}` : 'Novo animal'}</Text><LinkButton disabled={action.busy} title="Fechar" onPress={closeForm} /></View>
      {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Foto selecionada do animal" style={{ width: '100%', height: 200, borderRadius: 18 }} /> : editing?.photoPath ? <StoredPhoto path={editing.photoPath} label={editing.name} /> : null}
      <Button disabled={action.busy} secondary title={photo || editing?.photoPath ? 'Trocar foto' : '+ Adicionar foto'} onPress={() => void action.run(async () => { const selectedPhoto = await pickPhoto(); if (selectedPhoto) setPhoto(selectedPhoto); })} />
      <Segment disabled={action.busy} options={['Gato', 'Cão', 'Outro']} value={fields.species} onChange={species => {
        if (species !== fields.species) {
          setFields(current => ({ ...current, species })); setHealth(current => ({ ...emptyHealth(), notes: current.notes }));
          action.setMessage('Espécie alterada: marque de novo vacinas e testes.');
        }
      }} />
      <Input label="Nome" placeholder="Mel" value={fields.name} onChange={value => setFields(current => ({ ...current, name: value }))} maxLength={120} />
      <Input label="Idade" placeholder="2 anos" value={fields.age} onChange={value => setFields(current => ({ ...current, age: value }))} maxLength={80} />
      <Input label="Sobre" placeholder="Temperamento e cuidados" value={fields.description} onChange={value => setFields(current => ({ ...current, description: value }))} multiline maxLength={3000} />
      <HealthFields species={fields.species} value={health} onChange={setHealth} disabled={action.busy} />
      <Feedback message={action.message} />
      <Button disabled={action.busy} title={action.busy ? 'Salvando…' : editing ? 'Salvar' : 'Publicar'} onPress={() => void action.run(async () => {
        if (Object.values(fields).some(value => !value.trim())) throw Error('Preencha nome, idade e descrição.');
        const photoPath = photo ? await uploadPhoto(photo, `pets/${user!.uid}`) : editing?.photoPath;
        if (!photoPath) throw Error('Adicione uma foto do animal.');
        await call('savePet', { ...fields, health, photoPath, ...(editing ? { id: editing.id } : {}) });
        closeForm(); action.setMessage('Animal salvo.');
      })} />
    </Card>}
    {!ong && <LocationFilter place={place} home={home} scope={scope} onPlace={setPlace} onScope={setScope} />}
    {!formOpen && <Feedback message={pets.error || action.message} />}
    {pets.loading && <ActivityIndicator accessibilityLabel="Carregando animais" />}
    {!pets.loading && !pets.error && !visible.length && <View style={{ alignItems: 'center', paddingVertical: 24, gap: 4 }}>
      <Text style={[s.muted, { textAlign: 'center' }]}>{ong ? 'Nenhum animal cadastrado ainda.' : `Nenhum animal ${scope === 'city' ? `em ${place.city}` : scope === 'state' ? `em ${place.state}` : 'disponível'} no momento.`}</Text>
      {!ong && scope !== 'near' && <LinkButton title="Ver os mais próximos" onPress={() => setScope('near')} />}
    </View>}
    {groups.map(group => {
      const list = visible.filter(pet => group.species === 'Outro' ? !['Cão', 'Gato'].includes(pet.species) : pet.species === group.species);
      return list.length > 0 && <Carousel key={group.species} title={group.title} pets={list} ong={ong} near={pet => !ong && proximity(pet, place) === 0} onOpen={pet => setOpenId(pet.id)} />;
    })}
    {opened && <PetDetails pet={opened} ong={ong} busy={action.busy} onClose={() => setOpenId('')} onEdit={() => edit(opened)} onToggle={() => void action.run(() => call('togglePet', { petId: opened.id }))} />}
  </>;
}
type Scope = 'near' | 'city' | 'state';
const nativeDriver = Platform.OS !== 'web';
function proximity(pet: Listing, place: Place) {
  if (place.cityCode && pet.cityCode === place.cityCode) return 0;
  if (pet.state === place.state) return 1;
  if (place.cityCode && pet.cityCode && pet.cityCode[0] === place.cityCode[0]) return 2;
  return 3;
}
function LocationFilter({ place, home, scope, onPlace, onScope }: { place: Place; home: Place; scope: Scope; onPlace: (place: Place) => void; onScope: (scope: Scope) => void }) {
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
      <Input label="CEP da região" placeholder="00000000" numeric maxLength={8} value={postalCode} onChange={value => { const digits = value.replace(/\D/g, '').slice(0, 8); setPostalCode(digits); setError(''); if (digits.length === 8) void search(digits); }} right={searching ? <ActivityIndicator style={{ paddingHorizontal: 14 }} color={colors.green} /> : null} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {custom && <LinkButton align="flex-start" title={`Usar meu endereço (${home.city})`} onPress={() => { onPlace(home); setEditing(false); }} />}
    </View>}
    <Segment compact options={['near', 'city', 'state']} labels={{ near: 'Mais próximos', city: 'Na cidade', state: 'No estado' }} value={scope} onChange={value => onScope(value as Scope)} />
  </View>;
}
function Carousel({ title, pets, ong, near, onOpen }: { title: string; pets: Listing[]; ong: boolean; near: (pet: Listing) => boolean; onOpen: (pet: Listing) => void }) {
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(Math.min(width, 650));
  const [scrollX] = useState(() => new Animated.Value(0));
  const cardWidth = Math.min(containerWidth * 0.74, 320);
  const gap = 6;
  const interval = cardWidth + gap;
  const end = Math.max(22, containerWidth - cardWidth - 22);
  return <View style={{ gap: 8 }}>
    <View style={styles.sectionHeader}><Text style={s.subtitle}>{title}</Text><Text style={s.muted}>{pets.length} {pets.length === 1 ? 'animal' : 'animais'}</Text></View>
    <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={interval} decelerationRate="fast" scrollEventThrottle={16}
      onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: nativeDriver })}
      style={styles.carousel} contentContainerStyle={{ paddingLeft: 22, paddingRight: end, gap, paddingVertical: 10 }}>
      {pets.map((pet, i) => {
        const range = [(i - 1) * interval, i * interval, (i + 1) * interval];
        const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
        return <Animated.View key={pet.id} style={{ width: cardWidth, height: cardWidth * 1.4, transform: [{ scale }], opacity }}>
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
  return <>
    <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
      <StoredPhoto path={path} label={label} style={StyleSheet.absoluteFill} />
    </BlurTargetView>
    {children}
    <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={20} tint="systemUltraThinMaterialDark" style={panelStyle}>{panel}</BlurView>
  </>;
}
function PetDetails({ pet, ong, busy, onClose, onEdit, onToggle }: { pet: Listing; ong: boolean; busy: boolean; onClose: () => void; onEdit: () => void; onToggle: () => void }) {
  const insets = useSafeAreaInsets();
  const [applying, setApplying] = useState(false);
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
        <Fact icon="home-heart" text={pet.ongName} />
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
      </View> : pet.status !== 'available' ? <Text style={s.notice}>Adoção em andamento.</Text> : applying ? <ApplicationForm pet={pet} onClose={() => setApplying(false)} onSent={onClose} /> : <Button title="Quero adotar ♥" onPress={() => setApplying(true)} />}
    </ScrollView>
  </Modal>;
}
function Fact({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return <View style={styles.fact}><View style={styles.factIcon}><MaterialCommunityIcons name={icon} size={18} color={colors.green} /></View><Text style={styles.factText} numberOfLines={1}>{text}</Text></View>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 2 }}><Text style={s.label}>{label}</Text><Text style={s.text}>{value}</Text></View>;
}
function ApplicationForm({ pet, onClose, onSent }: { pet: Listing; onClose: () => void; onSent: () => void }) {
  const { user } = useSession();
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
    <Text style={s.label}>Fotos do ambiente ({photos.length}/6)</Text>
    {photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={{ gap: 4 }}><Image source={{ uri: photo.uri }} accessibilityLabel={`Foto do ambiente ${index + 1}`} style={{ width: '100%', height: 170, borderRadius: 16 }} /><LinkButton align="flex-end" disabled={action.busy} title="Remover" onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} /></View>)}
    {photos.length < 6 && <Button disabled={action.busy} secondary title="+ Adicionar foto" onPress={() => void action.run(async () => { const photo = await pickPhoto(); if (photo) setPhotos(current => [...current, photo]); })} />}
    <View style={[s.row, { alignItems: 'center', flexWrap: 'nowrap' }]}><Switch accessibilityLabel="Autorizo compartilhar meus dados e fotos com esta ONG para análise da candidatura" value={consent} onValueChange={setConsent} /><Text style={[s.muted, { flex: 1 }]}>Autorizo compartilhar meus dados e fotos com a ONG.</Text></View>
    <Feedback message={action.message} />
    <Button disabled={action.busy} title={action.busy ? 'Enviando…' : 'Enviar candidatura'} onPress={() => void action.run(async () => {
      if (!consent || !photos.length || !safety.trim() || !routine.trim() || !motivation.trim()) throw Error('Preencha tudo, adicione fotos e autorize o compartilhamento.');
      const id = `${pet.id}_${user!.uid}`;
      const photoPaths = [];
      for (const photo of photos) photoPaths.push(await uploadPhoto(photo, `homes/${user!.uid}/${id}`));
      await call('submitApplication', { petId: pet.id, housing, safety, routine, motivation, photoPaths, consent });
      onSent(); router.setParams({ tab: 'applications' });
    })} />
    <LinkButton disabled={action.busy} title="Cancelar" onPress={onClose} />
  </View>;
}
const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  carousel: { marginHorizontal: -22 },
  slide: { borderRadius: 28, overflow: 'hidden', backgroundColor: colors.soft, shadowColor: colors.dark, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
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
  hero: { height: 440, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.soft, shadowColor: colors.dark, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  round: { position: 'absolute', top: 16, left: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(16, 46, 36, 0.55)', alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  factIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  factText: { flex: 1, color: colors.text, fontWeight: '600' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, shadowColor: colors.dark, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  locationIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#B3261E', fontWeight: '600', paddingLeft: 4 },
});
