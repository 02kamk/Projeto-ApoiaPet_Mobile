import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { applicationStatus, Application, brasilia, Message, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Badge, Button, Card, colors, LinkButton, styles as s, themedStyles, useSharedSheet, useTheme } from '../ui';
import { Feedback, Input, StoredPhoto, useAction } from './components';
import { PickupFields, splitPickup } from './SchedulePicker';

export function ApplicationsPanel({ history = false, calendar = false }: { history?: boolean; calendar?: boolean }) {
  const sh = useSharedSheet();
  const { user, profile } = useSession();
  const ong = profile!.role === 'ong';
  const applications = useRecords<Application>('applications', ong ? 'ongId' : 'applicantId', user!.uid);
  const [openId, setOpenId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const records = [...applications.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const scheduled = records.filter(record => record.status === 'scheduled' && record.pickupAt);
  const day = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const visible = calendar ? scheduled.filter(record => !selectedDay || day(record.pickupAt!) === selectedDay).sort((a, b) => a.pickupAt!.localeCompare(b.pickupAt!)) : records;
  const upcoming = scheduled.filter(record => Date.parse(record.pickupAt!) < now + 7 * 86400000 && Date.parse(record.pickupAt!) >= now);
  return <>
    {history && <Text style={s.subtitle}>Adoções</Text>}
    {!calendar && upcoming.length > 0 && <IconLine box icon="bell-ring-outline" text={`${upcoming.length} retirada(s) nos próximos 7 dias`} />}
    {calendar && <><Calendar records={scheduled} onSelect={setSelectedDay} selected={selectedDay} />{!!selectedDay && <LinkButton title="Ver todas" onPress={() => setSelectedDay('')} />}</>}
    <Feedback message={applications.error} />{applications.loading && <ActivityIndicator accessibilityLabel="Carregando candidaturas" />}
    {!applications.loading && !applications.error && visible.length === 0 && <Text style={[s.muted, { textAlign: 'center', paddingVertical: 16 }]}>{calendar ? 'Nenhuma retirada agendada.' : 'Nenhuma candidatura ainda.'}</Text>}
    {calendar && visible.map(record => <PickupCard key={record.id} record={record} ong={ong} />)}
    {!calendar && visible.map(record => <Card key={record.id}>
      <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}><Text style={s.subtitle}>{record.petName}</Text><Badge text={applicationStatus[record.status]} /></View>
      <Text style={s.muted}>{ong ? record.applicantName : record.ongName} · {brasilia(record.createdAt)}</Text>
      {record.pickupAt && <View style={[sh.notice, { gap: 6 }]}><IconLine icon="calendar-month-outline" text={brasilia(record.pickupAt).slice(0, 17)} /><IconLine icon="map-marker-outline" text={record.pickupPlace || 'Local a combinar'} /></View>}
      <LinkButton align="flex-start" title={openId === record.id ? 'Ver menos' : 'Ver detalhes'} onPress={() => setOpenId(openId === record.id ? '' : record.id)} />
      {openId === record.id && <ApplicationDetails key={record.id} record={record} />}
    </Card>)}
  </>;
}
// Agenda: só quem retira, o animal, a data e o local.
function PickupCard({ record, ong }: { record: Application; ong: boolean }) {
  const theme = useTheme();
  const rows: [React.ComponentProps<typeof MaterialCommunityIcons>['name'], string, string][] = [
    ['account-outline', ong ? 'Adotante' : 'ONG', ong ? record.applicantName : record.ongName],
    ['paw', 'Animal', record.petName],
    ['calendar-clock', 'Data', brasilia(record.pickupAt!).slice(0, 17)],
    ['map-marker-outline', 'Local', record.pickupPlace || 'A combinar'],
  ];
  return <Card>{rows.map(([icon, label, value]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={icon} size={18} color={colors.white} /></View>
    <View style={{ flex: 1 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{label}</Text><Text style={{ fontSize: 15, fontWeight: '700', color: colors.dark }}>{value}</Text></View>
  </View>)}</Card>;
}
// Histórico em linha do tempo: mais recente primeiro, com autor, data e mensagem.
function Timeline({ record }: { record: Application }) {
  const theme = useTheme();
  const items = record.history.map((item, index) => ({ ...item, index })).reverse();
  return <View>
    {items.map((item, position) => {
      const first = position === 0; const last = position === items.length - 1;
      const who = item.actorId === record.ongId ? 'ONG' : item.actorId === record.applicantId ? 'Adotante' : 'Sistema';
      return <View key={`${item.at}-${item.index}`} style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 16, alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: first ? theme.primary : colors.white, borderWidth: 2, borderColor: theme.primary }} />
          {!last && <View style={{ flex: 1, width: 2, marginVertical: 2, backgroundColor: theme.soft }} />}
        </View>
        <View style={{ flex: 1, paddingBottom: last ? 0 : 16, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.primary, backgroundColor: theme.mint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{who}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '400' }}>{brasilia(item.at).slice(0, 17)}</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.text, fontWeight: first ? '500' : '400' }}>{item.message}</Text>
        </View>
      </View>;
    })}
  </View>;
}
function ApplicationDetails({ record }: { record: Application }) {
  const sh = useSharedSheet();
  const { profile } = useSession();
  const ong = profile!.role === 'ong';
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => splitPickup(record.pickupAt).date);
  const [time, setTime] = useState(() => splitPickup(record.pickupAt).time || '14:00');
  const [place, setPlace] = useState(record.pickupPlace || '');
  const [confirmPickup, setConfirmPickup] = useState(false);
  const action = useAction();
  function change(value: string) {
    void action.run(async () => {
      let pickupAt: string | undefined;
      if (value === 'schedule') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Escolha o dia no calendário e o horário.');
        pickupAt = new Date(`${date}T${time}:00-03:00`).toISOString();
        if (new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(pickupAt)) !== date) throw Error('Data inválida.');
      }
      await call('changeApplication', { id: record.id, action: value, message: note, ...(pickupAt ? { pickupAt, pickupPlace: place } : {}) });
      setNote(''); setConfirmPickup(false); action.setMessage('Candidatura atualizada.');
    });
  }
  const active = !['adopted', 'rejected', 'cancelled', 'closed'].includes(record.status);
  return <>
    {ong && <><Text style={s.label}>{record.applicantName}</Text><Text selectable style={s.muted}>{record.phone} · {record.city} / {record.state}</Text></>}
    {Object.entries(record.answers).map(([key, value]) => <View key={key}><Text style={s.label}>{{ housing: 'Moradia', safety: 'Segurança', routine: 'Rotina', motivation: 'Motivação' }[key]}</Text><Text style={s.text}>{value}</Text></View>)}
    {record.photoPaths?.length > 0 && <Text style={s.label}>Fotos do ambiente</Text>}{(record.photoPaths || []).map(path => <StoredPhoto key={path} path={path} label="Foto do ambiente onde o animal ficará" />)}
    <Text style={s.label}>Histórico</Text><Timeline record={record} />
    {active && <>
      {(ong || record.status === 'needs_info') && <Input label="Mensagem" placeholder={ong ? 'Obrigatória para recusar ou pedir complemento' : 'Responda ao pedido da ONG'} value={note} onChange={setNote} multiline maxLength={2000} />}
      <View style={s.row}>
        {ong && record.status === 'sent' && <Button disabled={action.busy} title="Iniciar análise" onPress={() => change('review')} />}
        {ong && ['sent', 'in_review'].includes(record.status) && <Button disabled={action.busy} title="Aprovar" onPress={() => change('approve')} />}
        {ong && record.status === 'in_review' && <Button disabled={action.busy} secondary title="Pedir complemento" onPress={() => change('request_info')} />}
        {ong && ['sent', 'in_review', 'needs_info', 'approved'].includes(record.status) && <Button disabled={action.busy} secondary title="Recusar" onPress={() => change('reject')} />}
        {!ong && record.status === 'needs_info' && <Button disabled={action.busy} title="Enviar resposta" onPress={() => change('review')} />}
      </View>
      {ong && ['approved', 'scheduled'].includes(record.status) && <Card><Text style={s.subtitle}>{record.status === 'scheduled' ? 'Reagendar retirada' : 'Agendar retirada'}</Text><PickupFields date={date} time={time} onDate={setDate} onTime={setTime} /><Input label="Local" placeholder="Endereço da retirada" value={place} onChange={setPlace} multiline maxLength={500} /><Button disabled={action.busy} title="Agendar" onPress={() => change('schedule')} /></Card>}
      {ong && record.status === 'scheduled' && <>{!confirmPickup ? <Button disabled={action.busy} title="Animal retirado" onPress={() => setConfirmPickup(true)} /> : <Card><Text style={sh.notice}>Isso conclui a adoção e encerra as outras candidaturas deste animal.</Text><Button disabled={action.busy} title="Confirmar retirada" onPress={() => change('complete')} /><LinkButton title="Voltar" onPress={() => setConfirmPickup(false)} /></Card>}</>}
      <LinkButton disabled={action.busy} title={ong ? 'Cancelar processo' : 'Desistir da candidatura'} onPress={() => change('cancel')} />
    </>}
    <Feedback message={action.message} />
    {['approved', 'scheduled', 'adopted'].includes(record.status) && <Chat record={record} />}
  </>;
}
function Chat({ record }: { record: Application }) {
  const messages = useRecords<Message>(`applications/${record.id}/messages`, '', true);
  const [body, setBody] = useState('');
  const action = useAction();
  return <Card><Text style={s.subtitle}>Conversa</Text><Feedback message={messages.error || action.message} />{messages.loading && <ActivityIndicator />}
    {[...messages.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(message => <View key={message.id}><Text style={s.label}>{message.senderName} <Text style={[s.muted, { fontWeight: '400', fontSize: 12 }]}>{brasilia(message.createdAt)}</Text></Text><Text style={s.text}>{message.body}</Text></View>)}
    {record.status !== 'adopted' ? <><Input label="Mensagem" placeholder="Escreva aqui…" value={body} onChange={setBody} multiline maxLength={2000} /><Button disabled={action.busy || !body.trim()} title="Enviar" onPress={() => void action.run(async () => { await call('sendMessage', { id: record.id, body }); setBody(''); })} /></> : <Text style={s.muted}>Conversa arquivada.</Text>}
  </Card>;
}
function Calendar({ records, onSelect, selected }: { records: Application[]; onSelect: (day: string) => void; selected: string }) {
  const calendarStyles = useCalendarStylesSheet();
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); });
  const year = month.getUTCFullYear(); const index = month.getUTCMonth();
  const total = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const prefix = `${year}-${String(index + 1).padStart(2, '0')}`;
  const counts = records.reduce<Record<string, number>>((all, record) => { const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.pickupAt!)); all[day] = (all[day] || 0) + 1; return all; }, {});
  return <Card>
    <View style={calendarStyles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setMonth(new Date(Date.UTC(year, index - 1, 1)))} style={calendarStyles.nav}><Text style={calendarStyles.navText}>‹</Text></Pressable>
      <Text style={[s.subtitle, calendarStyles.month]}>{month.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).replace(/^./, letter => letter.toUpperCase())}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setMonth(new Date(Date.UTC(year, index + 1, 1)))} style={calendarStyles.nav}><Text style={calendarStyles.navText}>›</Text></Pressable>
    </View>
    <View style={calendarStyles.grid}>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(label => <Text key={label} style={[s.muted, calendarStyles.cell, { textAlign: 'center' }]}>{label}</Text>)}</View>
    <View style={calendarStyles.grid}>
      {Array.from({ length: month.getUTCDay() }, (_, i) => <View key={`blank-${i}`} style={calendarStyles.cell} />)}
      {Array.from({ length: total }, (_, i) => {
        const day = `${prefix}-${String(i + 1).padStart(2, '0')}`;
        const active = selected === day;
        return <View key={day} style={calendarStyles.cell}><Pressable accessibilityRole="button" accessibilityLabel={`Dia ${i + 1}${counts[day] ? `, ${counts[day]} retirada(s)` : ''}`} accessibilityState={{ selected: active }} onPress={() => onSelect(day)} style={[calendarStyles.day, active && calendarStyles.dayActive]}>
          <Text style={[calendarStyles.dayText, active && { color: colors.white }]}>{i + 1}</Text>
          {!!counts[day] && <View style={[calendarStyles.dot, active && { backgroundColor: colors.white }]} />}
        </Pressable></View>;
      })}
    </View>
  </Card>;
}
const useCalendarStylesSheet = themedStyles(t => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { flex: 1, textAlign: 'center' },
  nav: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, lineHeight: 30, color: t.primary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
  day: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: t.primary },
  dayText: { color: colors.dark, fontWeight: '700' },
  dot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: t.primary },
}));
// Linha com ícone desenhado (no lugar de emoji), na cor da conta.
function IconLine({ icon, text, box = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string; box?: boolean }) {
  const sh = useSharedSheet();
  const theme = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, box && sh.notice]}>
    <MaterialCommunityIcons name={icon} size={18} color={theme.primary} />
    <Text style={{ flex: 1, color: colors.dark, fontSize: 14 }}>{text}</Text>
  </View>;
}
