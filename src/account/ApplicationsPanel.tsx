import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { applicationStatus, Application, brasilia, Message, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Button, Card, styles as s } from '../ui';
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
    <Text style={s.subtitle}>{calendar ? 'Agenda de retiradas' : history ? 'Histórico de adoções' : ong ? 'Candidaturas recebidas' : 'Minhas candidaturas'}</Text>
    {!calendar && upcoming.length > 0 && <Text style={s.notice}>🔔 {upcoming.length} retirada(s) nos próximos 7 dias. Confira os horários na agenda.</Text>}
    {calendar && <><Text style={s.muted}>Horários de Brasília (UTC−3). Os avisos aparecem dentro do aplicativo; não são notificações push.</Text><Calendar records={scheduled} onSelect={setSelectedDay} selected={selectedDay} /><Button secondary title="Ver todas as retiradas" onPress={() => setSelectedDay('')} /></>}
    <Feedback message={applications.error} />{applications.loading && <ActivityIndicator accessibilityLabel="Carregando candidaturas" />}
    {!applications.loading && !applications.error && visible.length === 0 && <Card><Text style={s.text}>{calendar ? 'Nenhuma retirada agendada nesta seleção.' : 'Nenhuma candidatura registrada nesta conta.'}</Text></Card>}
    {visible.map(record => <Card key={record.id}><Text style={s.subtitle}>{record.petName} · {applicationStatus[record.status]}</Text><Text style={s.text}>{ong ? record.applicantName : record.ongName}</Text><Text style={s.muted}>Enviada em {brasilia(record.createdAt)}</Text>
      {record.pickupAt && <Text style={s.notice}>{record.status === 'adopted' ? 'Retirada concluída' : 'Retirada'}: {brasilia(record.pickupAt)} (Brasília){'\n'}Local: {record.pickupPlace}</Text>}
      <Button secondary title={openId === record.id ? 'Fechar detalhes' : 'Ver detalhes, histórico e mensagens'} onPress={() => setOpenId(openId === record.id ? '' : record.id)} />
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
    <Text style={s.label}>Candidato: {record.applicantName}</Text><Text selectable style={s.text}>Telefone: {record.phone}</Text><Text style={s.muted}>{record.city} / {record.state}</Text>
    {Object.entries(record.answers).map(([key, value]) => <View key={key}><Text style={s.label}>{{ housing: 'Moradia', safety: 'Proteção do ambiente', routine: 'Rotina de cuidados', motivation: 'Motivação' }[key]}</Text><Text style={s.text}>{value}</Text></View>)}
    <Text style={s.label}>Fotos do ambiente · acesso restrito à candidatura</Text>{record.photoPaths.map(path => <StoredPhoto key={path} path={path} label="Foto do ambiente onde o animal ficará" />)}
    <Text style={s.subtitle}>Histórico da candidatura</Text>{record.history.map((item, index) => <View key={`${item.at}-${index}`}><Text style={s.muted}>{brasilia(item.at)}</Text><Text style={s.text}>{item.message}</Text></View>)}
    {active && <>
      <Input label={ong ? 'Mensagem / justificativa (obrigatória ao solicitar complementação ou recusar)' : 'Complementação solicitada pela ONG'} value={note} onChange={setNote} multiline maxLength={2000} />
      {ong && record.status === 'sent' && <Button disabled={action.busy} title="Iniciar análise" onPress={() => change('review')} />}
      {ong && ['sent', 'in_review'].includes(record.status) && <Button disabled={action.busy} title="Aprovar candidatura após análise humana" onPress={() => change('approve')} />}
      {ong && record.status === 'in_review' && <Button disabled={action.busy} secondary title="Solicitar complementação" onPress={() => change('request_info')} />}
      {ong && ['sent', 'in_review', 'needs_info', 'approved'].includes(record.status) && <Button disabled={action.busy} secondary title="Não aprovar candidatura" onPress={() => change('reject')} />}
      {!ong && record.status === 'needs_info' && <Button disabled={action.busy} title="Enviar complementação para análise" onPress={() => change('review')} />}
      {ong && ['approved', 'scheduled'].includes(record.status) && <Card><Text style={s.subtitle}>{record.status === 'scheduled' ? 'Reagendar retirada' : 'Agendar retirada'}</Text><Text style={s.muted}>Combine primeiro pelo chat. Ao agendar, o animal aparecerá em processo de adoção.</Text><Input label="Data (AAAA-MM-DD)" value={date} onChange={setDate} maxLength={10} /><Input label="Horário de Brasília (HH:MM)" value={time} onChange={setTime} maxLength={5} /><Input label="Local combinado para retirada" value={place} onChange={setPlace} multiline maxLength={500} /><Button disabled={action.busy} title="Confirmar agendamento" onPress={() => change('schedule')} /></Card>}
      {ong && record.status === 'scheduled' && <>{!confirmPickup ? <Button disabled={action.busy} title="Registrar que o animal foi retirado" onPress={() => setConfirmPickup(true)} /> : <Card><Text style={s.notice}>Confirme apenas após a entrega do animal. Isso conclui a adoção, retira o animal do catálogo e encerra as outras candidaturas ativas.</Text><Button disabled={action.busy} title="Confirmar retirada realizada" onPress={() => change('complete')} /><Button secondary title="Voltar sem confirmar" onPress={() => setConfirmPickup(false)} /></Card>}</>}
      <Button disabled={action.busy} secondary title={ong ? 'Cancelar processo e liberar o animal' : 'Desistir da candidatura'} onPress={() => change('cancel')} />
    </>}
    <Feedback message={action.message} />
    {['approved', 'scheduled', 'adopted'].includes(record.status) && <Chat record={record} />}
  </>;
}
function Chat({ record }: { record: Application }) {
  const messages = useRecords<Message>(`applications/${record.id}/messages`, '', true);
  const [body, setBody] = useState('');
  const action = useAction();
  return <Card><Text style={s.subtitle}>Conversa sobre a adoção</Text><Feedback message={messages.error || action.message} />{messages.loading && <ActivityIndicator />}
    {[...messages.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(message => <View key={message.id}><Text style={s.label}>{message.senderName}</Text><Text style={s.text}>{message.body}</Text><Text style={s.muted}>{brasilia(message.createdAt)}</Text></View>)}
    {record.status !== 'adopted' ? <><Input label="Mensagem para combinar a retirada" value={body} onChange={setBody} multiline maxLength={2000} /><Button disabled={action.busy || !body.trim()} title="Enviar mensagem" onPress={() => void action.run(async () => { await call('sendMessage', { id: record.id, body }); setBody(''); })} /></> : <Text style={s.muted}>Conversa arquivada após a adoção.</Text>}
  </Card>;
}
function Calendar({ records, onSelect, selected }: { records: Application[]; onSelect: (day: string) => void; selected: string }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); });
  const year = month.getUTCFullYear(); const index = month.getUTCMonth();
  const total = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const prefix = `${year}-${String(index + 1).padStart(2, '0')}`;
  const counts = records.reduce<Record<string, number>>((all, record) => { const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.pickupAt!)); all[day] = (all[day] || 0) + 1; return all; }, {});
  return <Card><View style={s.row}><Button secondary title="← Mês" onPress={() => setMonth(new Date(Date.UTC(year, index - 1, 1)))} /><Text style={s.label}>{month.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' })}</Text><Button secondary title="Mês →" onPress={() => setMonth(new Date(Date.UTC(year, index + 1, 1)))} /></View><View style={s.row}>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(label => <Text key={label} style={[s.muted, { width: '12%', textAlign: 'center' }]}>{label}</Text>)}</View><View style={[s.row, { gap: 4 }]}>{Array.from({ length: month.getUTCDay() }, (_, i) => <View key={`blank-${i}`} style={{ width: '13%', minHeight: 48 }} />)}{Array.from({ length: total }, (_, i) => { const day = `${prefix}-${String(i + 1).padStart(2, '0')}`; return <View key={day} style={{ width: '13%' }}><Button secondary={selected !== day} title={`${i + 1}${counts[day] ? ' ●' : ''}`} onPress={() => onSelect(day)} /></View>; })}</View><Text style={s.muted}>● Há retirada(s) agendada(s). Selecione o dia para ver os detalhes.</Text></Card>;
}
