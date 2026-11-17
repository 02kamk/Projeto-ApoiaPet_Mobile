import React, { useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { call, useSession } from '../backend/session';
import { currency, Donation, Organization, parseAmount, paymentStatus, useRecords, brasilia } from '../backend/data';
import { uniqueId } from '../backend/photos';
import { usingEmulators } from '../backend/firebase';
import { Button, Card, styles as s } from '../ui';
import { Feedback, Input, useAction } from './components';
const realPaymentsEnabled = !usingEmulators && process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';
export function PaymentsPanel({ history = false }: { history?: boolean }) {
  const { user, profile } = useSession();
  const ong = profile!.role === 'ong';
  const organizations = useRecords<Organization>('profiles', 'role', ong || history ? null : 'ong');
  const donations = useRecords<Donation>('donations', ong ? 'ongId' : 'donorId', user!.uid);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('25');
  const [mode, setMode] = useState<'test' | 'mercadopago'>(realPaymentsEnabled ? 'mercadopago' : 'test');
  const [requestId, setRequestId] = useState(uniqueId);
  const action = useAction();
  const totals = (type: string) => donations.records.filter(record => record.mode === type && record.status === 'confirmed').reduce((total, record) => total + record.amountCents, 0);
  return <>
    <Text style={s.subtitle}>{history ? 'Histórico de doações' : ong ? 'Quem ajudou o abrigo' : 'Apoiar uma ONG'}</Text>
    {!history && <Card><Text style={s.label}>{ong ? 'Recebido e confirmado pelo provedor' : 'Doado e confirmado pelo provedor'}</Text><Text style={s.title}>{currency(totals('mercadopago'))}</Text><Text style={s.muted}>Simulações (sem valor financeiro): {currency(totals('test'))}</Text></Card>}
    {ong && !history && <Card><Text style={s.subtitle}>Conta para recebimento</Text><Text style={s.muted}>Conecte a conta Mercado Pago da própria ONG. As contribuições serão cobradas pelo checkout do provedor e recebidas nessa conta.</Text><Button disabled={action.busy || !realPaymentsEnabled} title="Conectar minha ONG ao Mercado Pago" onPress={() => void action.run(async () => { const result = await call<{ url: string }>('startMercadoPagoConnection', {}); await Linking.openURL(result.url); })} />{!realPaymentsEnabled && <Text style={s.notice}>O recebimento real ainda não foi ativado. Por enquanto, apenas contribuições de teste.</Text>}</Card>}
    {!ong && !history && <Card><Text style={s.text}>Você pode ajudar ONGs de todo o Brasil, independentemente da sua cidade.</Text>
      {organizations.loading && <ActivityIndicator />}
      {organizations.records.map(organization => <Button key={organization.id} disabled={action.busy} secondary={recipient !== organization.id} title={`${organization.name} · ${organization.city} / ${organization.state}`} onPress={() => { setRecipient(organization.id); setRequestId(uniqueId()); }} />)}
      {!organizations.loading && !organizations.error && !organizations.records.length && <Text style={s.muted}>Nenhuma ONG cadastrada ainda.</Text>}
      <Input label="Valor em reais" value={amount} onChange={value => { setAmount(value); setRequestId(uniqueId()); }} maxLength={8} />
      <View style={s.row}><Button disabled={action.busy} secondary={mode !== 'test'} title="Simulação" onPress={() => { setMode('test'); setRequestId(uniqueId()); }} /><Button disabled={action.busy || !realPaymentsEnabled} secondary={mode !== 'mercadopago'} title="Mercado Pago · Pix / cartão" onPress={() => { setMode('mercadopago'); setRequestId(uniqueId()); }} /></View>
      <Text style={s.notice}>{mode === 'test' ? 'Modo de teste: nenhum dinheiro é cobrado ou transferido.' : 'Pagamento real no ambiente do Mercado Pago. Pix/cartão dependem da disponibilidade da conta recebedora. O histórico só confirma após a notificação do provedor.'}</Text>
      <Button disabled={action.busy || !recipient} title={action.busy ? 'Preparando…' : mode === 'test' ? 'Criar contribuição de teste' : 'Ir para pagamento no Mercado Pago'} onPress={() => void action.run(async () => {
        const result = await call<{ id: string; url: string }>('createDonation', { ongId: recipient, amountCents: parseAmount(amount), mode, requestId });
        setRequestId(uniqueId());
        if (result.url) await Linking.openURL(result.url);
        action.setMessage(mode === 'test' ? 'Registro criado. Simule a aprovação no histórico abaixo.' : 'Checkout criado. Acompanhe o resultado no histórico.');
      })} />
    </Card>}
    <Feedback message={action.message || organizations.error || donations.error} />{donations.loading && <ActivityIndicator accessibilityLabel="Carregando doações" />}
    {!donations.loading && !donations.error && !donations.records.length && <Text style={s.muted}>Nenhuma doação registrada nesta conta.</Text>}
    {[...donations.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(record => <Card key={record.id}><Text style={s.subtitle}>{currency(record.amountCents)} · {ong ? record.donorName : record.ongName}</Text><Text style={s.notice}>{record.mode === 'test' ? 'SIMULAÇÃO · ' : 'Mercado Pago · '}{paymentStatus[record.status] || record.status}</Text><Text style={s.muted}>{brasilia(record.createdAt)}</Text><Text selectable style={s.muted}>Registro: {record.id}</Text>
      {!ong && record.mode === 'test' && record.status === 'pending' && <><Button disabled={action.busy} title="Simular pagamento aprovado" onPress={() => void action.run(() => call('simulateDonation', { id: record.id, status: 'confirmed' }))} /><Button disabled={action.busy} secondary title="Cancelar simulação" onPress={() => void action.run(() => call('simulateDonation', { id: record.id, status: 'cancelled' }))} /></>}
      {!ong && record.mode === 'mercadopago' && record.status === 'pending' && record.checkoutUrl && <Button secondary title="Continuar no Mercado Pago" onPress={() => void action.run(() => Linking.openURL(record.checkoutUrl))} />}
    </Card>)}
  </>;
}
