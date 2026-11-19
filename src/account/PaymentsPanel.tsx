import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { call, useSession } from '../backend/session';
import { currency, Donation, Organization, parseAmount, paymentStatus, useRecords, brasilia } from '../backend/data';
import { uniqueId } from '../backend/photos';
import { usingEmulators } from '../backend/firebase';
import { Badge, Button, Card, colors, Segment, styles as s } from '../ui';
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
    {(history || ong) && <Text style={s.subtitle}>{history ? 'Doações' : 'Quem ajudou'}</Text>}
    {!history && <View style={styles.total}><Text style={styles.totalLabel}>{ong ? 'Total recebido' : 'Total doado'}</Text><Text style={styles.totalValue}>{currency(totals('mercadopago'))}</Text><Text style={styles.totalLabel}>Testes: {currency(totals('test'))}</Text></View>}
    {ong && !history && <Card><Text style={s.label}>Receber pelo Mercado Pago</Text><Button disabled={action.busy || !realPaymentsEnabled} title={realPaymentsEnabled ? 'Conectar conta' : 'Disponível em breve'} onPress={() => void action.run(async () => { const result = await call<{ url: string }>('startMercadoPagoConnection', {}); await Linking.openURL(result.url); })} /></Card>}
    {!ong && !history && <Card>
      <Text style={s.label}>Escolha a ONG</Text>
      {organizations.loading && <ActivityIndicator />}
      {organizations.records.map(organization => <Pressable key={organization.id} accessibilityRole="radio" accessibilityState={{ checked: recipient === organization.id, disabled: action.busy }} disabled={action.busy} onPress={() => { setRecipient(organization.id); setRequestId(uniqueId()); }} style={[styles.option, recipient === organization.id && styles.optionActive]}><Text style={[s.label, recipient === organization.id && { color: colors.white }]}>{organization.name}</Text><Text style={[s.muted, recipient === organization.id && { color: colors.mint }]}>{organization.city} / {organization.state}</Text></Pressable>)}
      {!organizations.loading && !organizations.error && !organizations.records.length && <Text style={s.muted}>Nenhuma ONG cadastrada ainda.</Text>}
      <Input label="Valor (R$)" placeholder="25" value={amount} onChange={value => { setAmount(value); setRequestId(uniqueId()); }} maxLength={8} />
      {realPaymentsEnabled && <Segment disabled={action.busy} options={['test', 'mercadopago']} labels={{ test: 'Teste', mercadopago: 'Pix / cartão' }} value={mode} onChange={value => { setMode(value as 'test' | 'mercadopago'); setRequestId(uniqueId()); }} />}
      {mode === 'test' && <Text style={s.muted}>Modo de teste: nada é cobrado.</Text>}
      <Button disabled={action.busy || !recipient} title={action.busy ? 'Preparando…' : 'Doar'} onPress={() => void action.run(async () => {
        const result = await call<{ id: string; url: string }>('createDonation', { ongId: recipient, amountCents: parseAmount(amount), mode, requestId });
        setRequestId(uniqueId());
        if (result.url) await Linking.openURL(result.url);
        action.setMessage(mode === 'test' ? 'Doação de teste criada. Aprove-a abaixo.' : 'Pagamento iniciado. Acompanhe abaixo.');
      })} />
    </Card>}
    <Feedback message={action.message || organizations.error || donations.error} />{donations.loading && <ActivityIndicator accessibilityLabel="Carregando doações" />}
    {!donations.loading && !donations.error && !donations.records.length && <Text style={[s.muted, { textAlign: 'center', paddingVertical: 16 }]}>Nenhuma doação ainda.</Text>}
    {[...donations.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(record => <Card key={record.id}>
      <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}><Text style={s.subtitle}>{currency(record.amountCents)}</Text><Badge text={`${record.mode === 'test' ? 'Teste · ' : ''}${paymentStatus[record.status] || record.status}`} /></View>
      <Text style={s.muted}>{ong ? record.donorName : record.ongName} · {brasilia(record.createdAt)}</Text>
      {!ong && record.mode === 'test' && record.status === 'pending' && <View style={s.row}><Button disabled={action.busy} title="Aprovar teste" onPress={() => void action.run(() => call('simulateDonation', { id: record.id, status: 'confirmed' }))} /><Button disabled={action.busy} secondary title="Cancelar" onPress={() => void action.run(() => call('simulateDonation', { id: record.id, status: 'cancelled' }))} /></View>}
      {!ong && record.mode === 'mercadopago' && record.status === 'pending' && record.checkoutUrl && <Button secondary title="Continuar pagamento" onPress={() => void action.run(() => Linking.openURL(record.checkoutUrl))} />}
    </Card>)}
  </>;
}
const styles = StyleSheet.create({
  total: { backgroundColor: colors.green, borderRadius: 24, padding: 22, gap: 4 },
  totalLabel: { color: colors.mint, fontWeight: '600' },
  totalValue: { color: colors.white, fontSize: 34, fontWeight: '800' },
  option: { backgroundColor: colors.mint, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
  optionActive: { backgroundColor: colors.green },
});
