import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { call, useSession } from '../backend/session';
import { Application, Listing, petStatus, useRecords } from '../backend/data';
import { colors, themedStyles, useTheme } from '../ui';
import { Feedback, useAction } from './components';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type StatusFilter = '' | Listing['status'];
const statuses: [Listing['status'], Icon, string][] = [
  ['available', 'heart-outline', 'Disponíveis'],
  ['in_process', 'progress-clock', 'Em processo'],
  ['adopted', 'home-heart', 'Adotados'],
  ['paused', 'pause-circle-outline', 'Pausados'],
];
const DAY = 86400000;

// Situação dos animais: contadores que filtram o carrossel.
export function StatusCounters({ pets, value, onChange }: { pets: Listing[]; value: StatusFilter; onChange: (status: StatusFilter) => void }) {
  const st = useSheet();
  const theme = useTheme();
  return <View style={{ gap: 8 }}>
    <View style={st.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>Situação dos animais</Text>
        <View style={[st.titleRow, { gap: 4 }]}><MaterialCommunityIcons name="gesture-tap" size={14} color={colors.muted} /><Text style={st.hint}>{value ? 'Filtro ativo no carrossel acima' : 'Toque para filtrar o carrossel'}</Text></View>
      </View>
      {!!value && <Pressable accessibilityRole="button" onPress={() => onChange('')} hitSlop={8} style={[st.clear, { backgroundColor: theme.mint }]}><MaterialCommunityIcons name="close" size={14} color={theme.primary} /><Text style={[st.link, { color: theme.primary, marginLeft: 0 }]}>Limpar</Text></Pressable>}
    </View>
    <View style={st.grid}>{statuses.map(([status, icon, label]) => {
      const active = value === status;
      const count = pets.filter(pet => pet.status === status).length;
      return <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${label}: ${count}. ${active ? 'Remover filtro' : 'Filtrar'}`} onPress={() => onChange(active ? '' : status)}
        style={({ pressed }) => [st.tile, active && { backgroundColor: theme.primary, borderColor: theme.primary }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}>
        <View style={[st.titleRow, { alignSelf: 'stretch', paddingHorizontal: 4 }]}>
          <MaterialCommunityIcons name={icon} size={18} color={active ? colors.white : theme.primary} />
          <MaterialCommunityIcons name={active ? 'filter-check' : 'filter-variant'} size={14} color={active ? colors.white : colors.muted} style={{ marginLeft: 'auto' }} />
        </View>
        <Text style={[st.tileValue, active && { color: colors.white }]}>{count}</Text>
        <View style={[st.titleRow, { gap: 2, justifyContent: 'center' }]}>
          <Text style={[st.tileLabel, { flexShrink: 1 }, active && { color: colors.white }]} numberOfLines={1}>{label}</Text>
          <MaterialCommunityIcons name="chevron-right" size={12} color={active ? colors.white : theme.primary} />
        </View>
      </Pressable>;
    })}</View>
  </View>;
}

// Mais procurados, esperando há mais tempo e responsáveis por animal.
export function PetInsights({ pets, onOpen }: { pets: Listing[]; onOpen: (pet: Listing) => void }) {
  const st = useSheet();
  const { user } = useSession();
  const applications = useRecords<Application>('applications', 'ongId', user?.uid ?? null);
  const [now] = useState(Date.now);
  const requests = applications.records.reduce<Record<string, number>>((all, item) => { all[item.petId] = (all[item.petId] || 0) + 1; return all; }, {});
  const wanted = pets.filter(pet => requests[pet.id]).sort((a, b) => requests[b.id] - requests[a.id]).slice(0, 3);
  const waiting = pets.filter(pet => pet.status === 'available' && !requests[pet.id] && (pet.createdAt || pet.updatedAt))
    .map(pet => ({ pet, days: Math.max(0, Math.floor((now - Date.parse((pet.createdAt || pet.updatedAt)!)) / DAY)) }))
    .sort((a, b) => b.days - a.days).slice(0, 3);
  return <>
    <View style={st.pair}>
    <Section half title="Mais procurados" icon="fire" empty="Nenhum animal recebeu candidaturas ainda.">
      {wanted.map((pet, index) => <PetRow key={pet.id} pet={pet} onPress={() => onOpen(pet)} rank={index + 1} detail={`${requests[pet.id]} ${requests[pet.id] === 1 ? 'candidatura' : 'candidaturas'}`} />)}
    </Section>
    <Section half title="Esperando há mais tempo" icon="timer-sand" empty="Todos os disponíveis já receberam pedidos. 🎉">
      {waiting.map(({ pet, days }) => <PetRow key={pet.id} pet={pet} onPress={() => onOpen(pet)} detail={days === 0 ? 'Novo, sem pedidos' : `${days} ${days === 1 ? 'dia' : 'dias'} sem pedidos`} />)}
    </Section>
    </View>
    <Caretakers pets={pets} />
    {!!applications.error && <Text style={st.hint}>{applications.error}</Text>}
  </>;
}

function Section({ title, icon, empty, half = false, children }: React.PropsWithChildren<{ title: string; icon: Icon; empty: string; half?: boolean }>) {
  const st = useSheet();
  const theme = useTheme();
  const items = React.Children.toArray(children);
  return <View style={[st.card, half && st.half]}>
    <View style={st.titleRow}><MaterialCommunityIcons name={icon} size={half ? 18 : 20} color={theme.primary} /><Text style={[st.title, half && st.halfTitle, { flex: 1 }]}>{title}</Text></View>
    {items.length ? items : <Text style={st.hint}>{empty}</Text>}
  </View>;
}

function PetRow({ pet, detail, rank, onPress }: { pet: Listing; detail: string; rank?: number; onPress: () => void }) {
  const st = useSheet();
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${pet.name}: ${detail}. Ver detalhes`} onPress={onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
    <View style={[st.avatar, { backgroundColor: theme.mint }]}>{rank ? <Text style={[st.rank, { color: theme.primary }]}>{rank}º</Text> : <MaterialCommunityIcons name={pet.species === 'Gato' ? 'cat' : pet.species === 'Cão' ? 'dog' : 'rabbit'} size={18} color={theme.primary} />}</View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={st.name} numberOfLines={1}>{pet.name}</Text><Text style={st.detail} numberOfLines={2}>{detail}</Text></View>
    <MaterialCommunityIcons name="chevron-right" size={16} color={theme.primary} />
  </Pressable>;
}

// Responsáveis: cada animal com um funcionário da equipe.
function Caretakers({ pets }: { pets: Listing[] }) {
  const st = useSheet();
  const theme = useTheme();
  const { profile } = useSession();
  const team = profile?.org?.team ?? [];
  const [editing, setEditing] = useState('');
  const action = useAction();
  const active = pets.filter(pet => pet.status !== 'adopted');
  const assign = (pet: Listing, caretaker: string) => void action.run(async () => { await call('setPetCaretaker', { petId: pet.id, caretaker }); setEditing(''); });
  return <View style={st.card}>
    <View style={st.titleRow}><MaterialCommunityIcons name="account-heart-outline" size={20} color={theme.primary} /><Text style={[st.title, { flex: 1 }]}>Responsáveis por animal</Text></View>
    {!team.length && <Text style={st.hint}>Cadastre a equipe na aba Abrigo → Equipe para definir quem cuida de cada animal.</Text>}
    {!!team.length && !active.length && <Text style={st.hint}>Nenhum animal sob cuidados no momento.</Text>}
    {!!team.length && active.map(pet => <View key={pet.id} style={{ gap: 6 }}>
      <View style={st.row}>
        <Text style={[st.name, { flex: 1 }]} numberOfLines={1}>{pet.name} <Text style={st.detail}>· {petStatus[pet.status]}</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Responsável por ${pet.name}: ${pet.caretaker || 'nenhum'}. Trocar`} disabled={action.busy} onPress={() => setEditing(editing === pet.id ? '' : pet.id)}
          style={[st.chip, pet.caretaker ? { backgroundColor: theme.primary } : { backgroundColor: theme.mint }]}>
          <MaterialCommunityIcons name={pet.caretaker ? 'account' : 'account-plus-outline'} size={15} color={pet.caretaker ? colors.white : theme.primary} />
          <Text style={[st.chipText, { color: pet.caretaker ? colors.white : theme.primary }]} numberOfLines={1}>{pet.caretaker || 'Definir'}</Text>
        </Pressable>
      </View>
      {editing === pet.id && <View style={st.options}>
        {team.map(member => <Pressable key={member.name} accessibilityRole="radio" accessibilityState={{ checked: pet.caretaker === member.name }} disabled={action.busy} onPress={() => assign(pet, member.name)} style={[st.option, pet.caretaker === member.name && { backgroundColor: theme.mint }]}>
          <Text style={st.name}>{member.name}</Text>{!!member.role && <Text style={st.detail}>{member.role}</Text>}
        </Pressable>)}
        {!!pet.caretaker && <Pressable accessibilityRole="button" disabled={action.busy} onPress={() => assign(pet, '')} style={st.option}><Text style={[st.name, { color: '#B3261E' }]}>Sem responsável</Text></Pressable>}
      </View>}
    </View>)}
    <Feedback message={action.message} />
  </View>;
}

const useSheet = themedStyles(t => StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.dark },
  link: { fontWeight: '700', marginLeft: 'auto' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tile: { flexGrow: 1, flexBasis: '22%', minWidth: 0, alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, gap: 2, borderWidth: 1, borderColor: t.soft, shadowColor: colors.dark, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tileValue: { fontSize: 24, fontWeight: '800', color: colors.dark, textAlign: 'center', marginTop: -4 },
  tileLabel: { fontSize: 10, color: colors.muted, letterSpacing: -0.1 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { flexGrow: 1, flexBasis: 150, minWidth: 0, padding: 12, gap: 8 },
  halfTitle: { fontSize: 15 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: t.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rank: { fontWeight: '800', fontSize: 13 },
  name: { fontSize: 15, fontWeight: '700', color: colors.dark },
  detail: { fontSize: 12, fontWeight: '400', color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 150, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  options: { backgroundColor: colors.bg, borderRadius: 14, padding: 4 },
  option: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
}));
