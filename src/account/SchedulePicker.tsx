import React, { useEffect, useRef, useState } from 'react';
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, colors, styles as s, themedStyles, useTheme } from '../ui';

const ZONE = 'America/Sao_Paulo';
export const todayInBrazil = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// Data (AAAA-MM-DD) e horário (HH:MM) de um instante, no fuso de Brasília.
export function splitPickup(iso: string | null | undefined) {
  if (!iso) return { date: '', time: '' };
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return { date, time };
}

// Calendário mensal para escolher o dia (dias passados ficam bloqueados).
export function DatePicker({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const st = useSheet();
  const theme = useTheme();
  const today = todayInBrazil();
  const [month, setMonth] = useState(() => { const [y, m] = (value || today).split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)); });
  const year = month.getUTCFullYear(); const index = month.getUTCMonth();
  const total = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const prefix = `${year}-${String(index + 1).padStart(2, '0')}`;
  const canGoBack = prefix > today.slice(0, 7);
  return <View style={{ gap: 8 }}>
    <View style={st.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" disabled={!canGoBack} onPress={() => setMonth(new Date(Date.UTC(year, index - 1, 1)))} style={[st.nav, !canGoBack && { opacity: 0.35 }]}><MaterialCommunityIcons name="chevron-left" size={24} color={theme.primary} /></Pressable>
      <Text style={st.month}>{month.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).replace(/^./, letter => letter.toUpperCase())}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setMonth(new Date(Date.UTC(year, index + 1, 1)))} style={st.nav}><MaterialCommunityIcons name="chevron-right" size={24} color={theme.primary} /></Pressable>
    </View>
    <View style={st.grid}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, i) => <Text key={i} style={[s.muted, st.cell, st.weekday]}>{label}</Text>)}</View>
    <View style={st.grid}>
      {Array.from({ length: month.getUTCDay() }, (_, i) => <View key={`blank-${i}`} style={st.cell} />)}
      {Array.from({ length: total }, (_, i) => {
        const day = `${prefix}-${String(i + 1).padStart(2, '0')}`;
        const active = value === day; const past = day < today; const isToday = day === today;
        return <View key={day} style={st.cell}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Dia ${i + 1}`} accessibilityState={{ selected: active, disabled: past }} disabled={past} onPress={() => onChange(day)} style={[st.day, isToday && st.today, active && st.dayActive, past && { opacity: 0.3 }]}>
            <Text style={[st.dayText, active && { color: colors.white }]}>{i + 1}</Text>
          </Pressable>
        </View>;
      })}
    </View>
  </View>;
}

const ITEM = 44; const VISIBLE = 5; const PAD = Math.floor(VISIBLE / 2);
// Coluna giratória (estilo alarme): rola e encaixa no item do meio.
function Wheel({ values, value, onChange, label }: { values: string[]; value: string; onChange: (value: string) => void; label: string }) {
  const st = useSheet();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initial = Math.max(0, values.indexOf(value));
  const [current, setCurrent] = useState(initial);
  useEffect(() => { const id = setTimeout(() => ref.current?.scrollTo({ y: initial * ITEM, animated: false }), 0); return () => clearTimeout(id); }, [initial]);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  const choose = (i: number, animated = true) => {
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    ref.current?.scrollTo({ y: clamped * ITEM, animated });
    setCurrent(clamped);
    if (values[clamped] !== value) onChange(values[clamped]);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setCurrent(Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM))));
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => choose(Math.round(y / ITEM)), 140);
  };
  return <View style={st.wheel} accessibilityLabel={`${label}: ${values[current]}`} accessibilityRole="adjustable"
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => choose(current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
    <View pointerEvents="none" style={st.band} />
    <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ITEM} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} nestedScrollEnabled style={{ height: ITEM * VISIBLE }}>
      <View style={{ height: ITEM * PAD }} />
      {values.map((item, i) => {
        const distance = Math.abs(i - current);
        return <Pressable key={item} onPress={() => choose(i)} style={st.item}>
          <Text style={[st.itemText, distance === 0 && st.itemActive, { opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : 0.25 }]}>{item}</Text>
        </Pressable>;
      })}
      <View style={{ height: ITEM * PAD }} />
    </ScrollView>
  </View>;
}
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
// Horário em duas rodas: horas e minutos (de 5 em 5).
export function TimeWheel({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const st = useSheet();
  const [hour, minute] = (value || '14:00').split(':');
  const roundedMinute = minutes.includes(minute) ? minute : String(Math.min(55, Math.round(Number(minute) / 5) * 5)).padStart(2, '0');
  return <View style={st.time}>
    <Wheel label="Hora" values={hours} value={hour} onChange={h => onChange(`${h}:${roundedMinute}`)} />
    <Text style={st.colon}>:</Text>
    <Wheel label="Minuto" values={minutes} value={roundedMinute} onChange={m => onChange(`${hour}:${m}`)} />
  </View>;
}

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function PickerButton({ icon, label, value, placeholder, onPress }: { icon: Icon; label: string; value: string; placeholder: string; onPress: () => void }) {
  const st = useSheet();
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`} onPress={onPress} style={({ pressed }) => [st.field, pressed && { opacity: 0.8 }]}>
    <View style={st.fieldIcon}><MaterialCommunityIcons name={icon} size={17} color={colors.white} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={[st.fieldValue, !value && { color: colors.muted, fontWeight: '600' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{value || placeholder}</Text>
    </View>
    <MaterialCommunityIcons name="chevron-down" size={18} color={theme.primary} />
  </Pressable>;
}
function Sheet({ visible, title, onClose, children }: React.PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const st = useSheet();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable accessibilityLabel="Fechar" style={st.backdrop} onPress={onClose} />
    <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
      <View style={st.grabber} />
      <View style={st.sheetHeader}>
        <Text style={st.sheetTitle}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} hitSlop={10}><MaterialCommunityIcons name="close" size={24} color={colors.dark} /></Pressable>
      </View>
      {children}
    </View>
  </Modal>;
}
// Data e horário da retirada como botões; cada um abre seu seletor numa janela.
export function PickupFields({ date, time, onDate, onTime }: { date: string; time: string; onDate: (day: string) => void; onTime: (time: string) => void }) {
  const st = useSheet();
  const [open, setOpen] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(time);
  const weekday = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace(/\./g, '') : '';
  const shown = date ? `${weekday}, ${date.slice(8, 10)}/${date.slice(5, 7)}` : '';
  return <>
    <View style={st.fields}>
      <View style={st.fieldWrap}><PickerButton icon="calendar-month" label="Data" value={shown} placeholder="Escolher dia" onPress={() => setOpen('date')} /></View>
      <View style={st.fieldWrap}><PickerButton icon="clock-outline" label="Horário" value={time} placeholder="--:--" onPress={() => { setDraft(time || '14:00'); setOpen('time'); }} /></View>
    </View>
    <Sheet visible={open === 'date'} title="Dia da retirada" onClose={() => setOpen(null)}>
      <DatePicker value={date} onChange={day => { onDate(day); setOpen(null); }} />
    </Sheet>
    <Sheet visible={open === 'time'} title="Horário da retirada" onClose={() => setOpen(null)}>
      <TimeWheel value={draft} onChange={setDraft} />
      <Button title={`Confirmar ${draft}`} onPress={() => { onTime(draft); setOpen(null); }} />
    </Sheet>
  </>;
}

const useSheet = themedStyles(t => StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldWrap: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.mint, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, minHeight: 54 },
  fieldIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  fieldValue: { fontSize: 15, fontWeight: '800', color: colors.dark },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.dark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.dark },
  nav: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 2 },
  weekday: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: t.primary },
  dayActive: { backgroundColor: t.primary },
  dayText: { color: colors.dark, fontWeight: '700' },
  time: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.mint, borderRadius: 20, paddingVertical: 6 },
  wheel: { width: 74, height: ITEM * VISIBLE, overflow: 'hidden' },
  band: { position: 'absolute', left: 4, right: 4, top: ITEM * PAD, height: ITEM, borderRadius: 12, backgroundColor: colors.white },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 22, fontWeight: '600', color: colors.dark, fontVariant: ['tabular-nums'] },
  itemActive: { fontSize: 26, fontWeight: '800', color: t.primary },
  colon: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 2 },
}));
