import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { applicationStatus, Application, brasilia, Message, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Badge, Button, Card, colors, LinkButton, styles as s } from '../ui';
import { Feedback, Input, StoredPhoto, useAction } from './components';

export function ApplicationsPanel({ history = false, calendar = false }: { history?: boolean; calendar?: boolean }) {
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
    {!calendar && upcoming.length > 0 && <Text style={s.notice}>🔔 {upcoming.length} retirada(s) nos próximos 7 dias</Text>}
    {calendar && <><Calendar records={scheduled} onSelect={setSelectedDay} selected={selectedDay} />{!!selectedDay && <LinkButton title="Ver todas" onPress={() => setSelectedDay('')} />}</>}
    <Feedback message={applications.error} />{applications.loading && <ActivityIndicator accessibilityLabel="Carregando candidaturas" />}
    {!applications.loading && !applications.error && visible.length === 0 && <Text style={[s.muted, { textAlign: 'center', paddingVertical: 16 }]}>{calendar ? 'Nenhuma retirada agendada.' : 'Nenhuma candidatura ainda.'}</Text>}
    {visible.map(record => <Card key={record.id}>
      <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}><Text style={s.subtitle}>{record.petName}</Text><Badge text={applicationStatus[record.status]} /></View>
      <Text style={s.muted}>{ong ? record.applicantName : record.ongName} · {brasilia(record.createdAt)}</Text>
      {record.pickupAt && <Text style={s.notice}>📅 {brasilia(record.pickupAt)}{'\n'}📍 {record.pickupPlace}</Text>}
      <LinkButton align="flex-start" title={openId === record.id ? 'Ver menos' : 'Ver detalhes'} onPress={() => setOpenId(openId === record.id ? '' : record.id)} />
      {openId === record.id && <ApplicationDetails key={record.id} record={record} />}
    </Card>)}
  </>;
}
function ApplicationDetails({ record }: { record: Application }) {
  const { profile } = useSession();
  const ong = profile!.role === 'ong';
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState(record.pickupPlace || '');
  const [confirmPickup, setConfirmPickup] = useState(false);
  const action = useAction();
  function change(value: string) {
    void action.run(async () => {
      let pickupAt: string | undefined;
      if (value === 'schedule') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Informe data AAAA-MM-DD e horário HH:MM válidos.');
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
    <Text style={s.label}>Fotos do ambiente</Text>{record.photoPaths.map(path => <StoredPhoto key={path} path={path} label="Foto do ambiente onde o animal ficará" />)}
    <Text style={s.label}>Histórico</Text>{record.history.map((item, index) => <View key={`${item.at}-${index}`}><Text style={s.muted}>{brasilia(item.at)}</Text><Text style={s.text}>{item.message}</Text></View>)}
    {active && <>
      {(ong || record.status === 'needs_info') && <Input label="Mensagem" placeholder={ong ? 'Obrigatória para recusar ou pedir complemento' : 'Responda ao pedido da ONG'} value={note} onChange={setNote} multiline maxLength={2000} />}
      <View style={s.row}>
        {ong && record.status === 'sent' && <Button disabled={action.busy} title="Iniciar análise" onPress={() => change('review')} />}
        {ong && ['sent', 'in_review'].includes(record.status) && <Button disabled={action.busy} title="Aprovar" onPress={() => change('approve')} />}
        {ong && record.status === 'in_review' && <Button disabled={action.busy} secondary title="Pedir complemento" onPress={() => change('request_info')} />}
        {ong && ['sent', 'in_review', 'needs_info', 'approved'].includes(record.status) && <Button disabled={action.busy} secondary title="Recusar" onPress={() => change('reject')} />}
        {!ong && record.status === 'needs_info' && <Button disabled={action.busy} title="Enviar resposta" onPress={() => change('review')} />}
      </View>
      {ong && ['approved', 'scheduled'].includes(record.status) && <Card><Text style={s.subtitle}>{record.status === 'scheduled' ? 'Reagendar retirada' : 'Agendar retirada'}</Text><View style={[s.row, { flexWrap: 'nowrap' }]}><View style={{ flex: 1 }}><Input label="Data" placeholder="2026-12-01" value={date} onChange={setDate} maxLength={10} /></View><View style={{ flex: 1 }}><Input label="Horário" placeholder="14:30" value={time} onChange={setTime} maxLength={5} /></View></View><Input label="Local" placeholder="Endereço da retirada" value={place} onChange={setPlace} multiline maxLength={500} /><Button disabled={action.busy} title="Agendar" onPress={() => change('schedule')} /></Card>}
      {ong && record.status === 'scheduled' && <>{!confirmPickup ? <Button disabled={action.busy} title="Animal retirado" onPress={() => setConfirmPickup(true)} /> : <Card><Text style={s.notice}>Isso conclui a adoção e encerra as outras candidaturas deste animal.</Text><Button disabled={action.busy} title="Confirmar retirada" onPress={() => change('complete')} /><LinkButton title="Voltar" onPress={() => setConfirmPickup(false)} /></Card>}</>}
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
const calendarStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { flex: 1, textAlign: 'center' },
  nav: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, lineHeight: 30, color: colors.green, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
  day: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: colors.green },
  dayText: { color: colors.dark, fontWeight: '700' },
  dot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.green },
});
