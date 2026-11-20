import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { call, useSession } from '../backend/session';
import { currency, Donation, donationCounts, Organization, parseAmount, paymentStatus, useRecords, brasilia } from '../backend/data';
import { uniqueId } from '../backend/photos';
import { usingEmulators } from '../backend/firebase';
import { Button, Card, colors, styles as s, themedStyles, useTheme } from '../ui';
import { Feedback, Input, Place, proximity, StoredPhoto, useAction } from './components';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DonationRing } from './DonationRing';
import { OngPublicProfile } from './OngPublicProfile';
import { useLocalSearchParams } from 'expo-router';
import { useDonorLevel } from './donationLevel';
const realPaymentsEnabled = !usingEmulators && process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';
export function PaymentsPanel({ history = false }: { history?: boolean }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  const { user, profile } = useSession();
  const ong = profile!.role === 'ong';
  const organizations = useRecords<Organization>('profiles', 'role', ong || history ? null : 'ong');
  const donations = useRecords<Donation>('donations', ong ? 'ongId' : 'donorId', user!.uid);
  const params = useLocalSearchParams<{ ong?: string }>();
  const [recipient, setRecipient] = useState(() => (typeof params.ong === 'string' ? params.ong : ''));
  const [viewing, setViewing] = useState('');
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState(String(PRESETS[2]));
  const [customAmount, setCustomAmount] = useState(false);
  const mode = realPaymentsEnabled ? 'mercadopago' : 'test';
  const [requestId, setRequestId] = useState(uniqueId);
  const action = useAction();
  const home: Place = { city: profile!.city, state: profile!.state, cityCode: profile!.cityCode };
  const byDistance = [...organizations.records].sort((a, b) => proximity(a, home) - proximity(b, home) || a.name.localeCompare(b.name));
  const query = normalize(search);
  const matches = query ? byDistance.filter(organization => normalize(organization.name).includes(query)).slice(0, 8) : [];
  const suggestions = byDistance.slice(0, 8);
  const selected = organizations.records.find(organization => organization.id === recipient);
  const choose = (id: string) => { setRecipient(id); setSearch(''); setRequestId(uniqueId()); };
  const changeAmount = (value: string, custom: boolean) => { setAmount(value); setCustomAmount(custom); setRequestId(uniqueId()); };
  const confirmedTotal = donations.records.filter(donationCounts).reduce((total, record) => total + record.amountCents, 0);
  return <>
    {(history || ong) && <Text style={s.subtitle}>{history ? 'Doações' : 'Quem ajudou'}</Text>}
    {!history && !ong && <LevelHeader />}
    {!history && ong && <View style={styles.total}><Text style={styles.totalLabel}>Total recebido</Text><Text style={styles.totalValue}>{currency(confirmedTotal)}</Text></View>}
    {ong && !history && <Card><Text style={s.label}>Receber pelo Mercado Pago</Text><Button disabled={action.busy || !realPaymentsEnabled} title={realPaymentsEnabled ? 'Conectar conta' : 'Disponível em breve'} onPress={() => void action.run(async () => { const result = await call<{ url: string }>('startMercadoPagoConnection', {}); await Linking.openURL(result.url); })} /></Card>}
    {!ong && !history && <Card>
      {selected ? <View style={[styles.option, styles.optionActive, styles.selected]}>
        <Initials name={selected.name} photoPath={selected.photoPath} light />
        <View style={{ flex: 1 }}><Text style={[s.muted, { color: theme.mint }]}>Doando para</Text><Text style={[s.label, { color: colors.white }]}>{selected.name}</Text><Text style={[s.muted, { color: theme.mint }]}>{selected.city} / {selected.state}</Text></View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Pressable accessibilityRole="button" disabled={action.busy} onPress={() => { setRecipient(''); setRequestId(uniqueId()); }} hitSlop={8} style={styles.change}><Text style={styles.changeText}>Trocar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setViewing(selected.id)} hitSlop={8}><Text style={[styles.changeText, { color: colors.white, textDecorationLine: 'underline' }]}>Ver perfil</Text></Pressable>
        </View>
      </View> : <>
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
          <TextInput accessibilityLabel="Buscar ONG" placeholder="Buscar ONG pelo nome" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} maxLength={80} style={styles.searchInput} />
          {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch('')} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable>}
        </View>
        {organizations.loading && <ActivityIndicator />}
        {!!query && matches.length > 0 && <Carousel organizations={matches} home={home} disabled={action.busy} onChoose={choose} />}
        {!!query && !organizations.loading && !matches.length && <Text style={s.muted}>Nenhuma ONG encontrada com esse nome.</Text>}
        {!query && suggestions.length > 0 && <>
          <Text style={s.label}>Perto de você</Text>
          <Carousel organizations={suggestions} home={home} disabled={action.busy} onChoose={choose} />
        </>}
        {!organizations.loading && !organizations.error && !organizations.records.length && <Text style={s.muted}>Nenhuma ONG cadastrada ainda.</Text>}
      </>}
      <Text style={s.label}>Valor da doação</Text>
      <View style={styles.amounts}>
        {PRESETS.map(value => { const active = !customAmount && amount === String(value); return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: active, disabled: action.busy }} disabled={action.busy} onPress={() => changeAmount(String(value), false)} style={[styles.amount, active && styles.optionActive]}><Text style={[styles.amountText, active && { color: colors.white }]}>R$ {value}</Text></Pressable>; })}
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: customAmount, disabled: action.busy }} disabled={action.busy} onPress={() => changeAmount('', true)} style={[styles.amount, styles.amountWide, customAmount && styles.optionActive]}><Text style={[styles.amountText, customAmount && { color: colors.white }]}>Outro valor</Text></Pressable>
      </View>
      {customAmount && <Input label="Valor (R$)" placeholder={`Mínimo R$ ${MIN_REAIS}`} value={amount} onChange={value => changeAmount(value, true)} maxLength={8} />}
      {mode === 'test' && <Text style={s.muted}>Modo de teste: nada é cobrado.</Text>}
      <Button disabled={action.busy || !recipient} title={action.busy ? 'Preparando…' : 'Doar'} onPress={() => void action.run(async () => {
        const amountCents = parseAmount(amount);
        if (amountCents < MIN_REAIS * 100) throw Error(`O valor mínimo é R$ ${MIN_REAIS},00.`);
        const result = await call<{ id: string; url: string }>('createDonation', { ongId: recipient, amountCents, mode, requestId });
        setRequestId(uniqueId());
        if (result.url) await Linking.openURL(result.url);
        action.setMessage(mode === 'test' ? 'Doação realizada! Obrigado por apoiar. ♥' : 'Pagamento iniciado. Acompanhe abaixo.');
      })} />
    </Card>}
    {!!viewing && <OngPublicProfile ongId={viewing} onClose={() => setViewing('')} />}
    <Feedback message={action.message || organizations.error || donations.error} />{donations.loading && <ActivityIndicator accessibilityLabel="Carregando doações" />}
    <View style={styles.panel}>
      <Text style={s.subtitle}>{ong ? 'Doações recebidas' : 'Histórico de transações'}</Text>
      {!donations.loading && !donations.error && !donations.records.length && <Text style={[s.muted, { textAlign: 'center', paddingVertical: 16 }]}>Nenhuma doação ainda.</Text>}
      {[...donations.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(record => <View key={record.id} style={styles.tx}>
        <View style={styles.txIcon}><MaterialCommunityIcons name="paw" size={18} color={colors.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txName} numberOfLines={1}>{ong ? record.donorName : record.ongName}</Text>
          <Text style={styles.txDate}>{brasilia(record.createdAt)}</Text>
          {!donationCounts(record) && <Text style={s.muted}>{paymentStatus[record.status] || record.status}</Text>}
          {!ong && record.mode === 'mercadopago' && record.status === 'pending' && record.checkoutUrl && <Text accessibilityRole="link" style={styles.txLink} onPress={() => void action.run(() => Linking.openURL(record.checkoutUrl))}>Continuar pagamento</Text>}
        </View>
        <View style={styles.txDivider} />
        <Text style={[styles.txValue, !donationCounts(record) && { color: colors.muted }]}>{currency(record.amountCents)}</Text>
      </View>)}
    </View>
  </>;
}
function LevelHeader() {
  const styles = useStylesSheet();
  const { totalCents, next, progress, missingCents, loading } = useDonorLevel();
  return <View style={styles.header}>
    {loading ? <View style={{ width: 168, height: 168, justifyContent: 'center' }}><ActivityIndicator color={colors.white} accessibilityLabel="Carregando total doado" /></View>
      : <DonationRing progress={progress} from="#D7F5E3" to="#3FCB8B" value={currency(totalCents)} />}
    <View style={{ flex: 1, minWidth: 130, gap: 14 }}>
      <View><Text style={styles.totalLabel}>Próxima meta</Text><Text style={styles.big}>{next ? next.name : '—'}</Text><Text style={styles.totalLabel}>{next ? `Faltam ${currency(missingCents)}` : 'Você chegou ao Diamante.'}</Text></View>
    </View>
  </View>;
}
const MIN_REAIS = 5;
const PRESETS = [5, 10, 20, 50, 100, 200];
// Case- and accent-insensitive, so "esperanca" finds "Abrigo Esperança".
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const distanceLabel = ['Na sua cidade', 'No seu estado', 'Na sua região', ''];
function Initials({ name, photoPath, light = false, small = false }: { name: string; photoPath?: string; light?: boolean; small?: boolean }) {
  const styles = useStylesSheet();
  const theme = useTheme();
  if (photoPath) return <StoredPhoto path={photoPath} label={`Foto de ${name}`} style={[styles.initials, small && styles.initialsSmall]} />;
  const text = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
  return <View style={[styles.initials, small && styles.initialsSmall, light && { backgroundColor: colors.white }]}><Text style={[styles.initialsText, small && { fontSize: 11 }, light && { color: theme.primary }]}>{text || '?'}</Text></View>;
}
function OrganizationCard({ organization, home, disabled, onPress }: { organization: Organization; home: Place; disabled: boolean; onPress: () => void }) {
  const styles = useStylesSheet();
  const label = distanceLabel[proximity(organization, home)];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${organization.name}, ${organization.city}. Ver perfil da ONG`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
    <Initials name={organization.name} photoPath={organization.photoPath} small />
    <Text style={styles.cardName} numberOfLines={2}>{organization.name}</Text>
    <Text style={styles.cardCity} numberOfLines={1}>{organization.city} / {organization.state}</Text>
    {!!label && <Text style={styles.cardTag} numberOfLines={1}>{label}</Text>}
  </Pressable>;
}
function Carousel({ organizations, home, disabled, onChoose }: { organizations: Organization[]; home: Place; disabled: boolean; onChoose: (id: string) => void }) {
  const [viewing, setViewing] = useState('');
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
    {organizations.map(organization => <OrganizationCard key={organization.id} organization={organization} home={home} disabled={disabled} onPress={() => setViewing(organization.id)} />)}
    {!!viewing && <OngPublicProfile ongId={viewing} onClose={() => setViewing('')} onDonate={id => { setViewing(''); onChoose(id); }} />}
  </ScrollView>;
}
const useStylesSheet = themedStyles(t => StyleSheet.create({
  total: { backgroundColor: t.primary, borderRadius: 24, padding: 22, gap: 4 },
  totalLabel: { color: t.mint, fontWeight: '600' },
  totalValue: { color: colors.white, fontSize: 34, fontWeight: '800' },
  option: { backgroundColor: t.mint, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
  optionActive: { backgroundColor: t.primary },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  change: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white },
  changeText: { color: t.primary, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, alignSelf: 'stretch', fontSize: 16, color: colors.text, paddingVertical: 10, outlineWidth: 0 },
  initials: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  initialsSmall: { width: 28, height: 28, borderRadius: 14 },
  card: { width: 118, backgroundColor: t.mint, borderRadius: 14, padding: 8, gap: 2 },
  cardName: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },
  cardCity: { fontSize: 11, color: colors.muted },
  cardTag: { alignSelf: 'flex-start', marginTop: 2, fontSize: 10, fontWeight: '700', color: t.primary, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amount: { flexGrow: 1, flexBasis: '30%', minHeight: 48, borderRadius: 14, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
  amountWide: { flexBasis: '100%' },
  amountText: { color: t.primary, fontWeight: '800', fontSize: 16 },
  header: { backgroundColor: t.primary, borderRadius: 28, padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18 },
  big: { color: colors.white, fontSize: 22, fontWeight: '800' },
  panel: { backgroundColor: t.mint, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  txIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14, fontWeight: '700', color: colors.text },
  txDate: { fontSize: 11, color: t.primary, fontWeight: '600' },
  txLink: { color: t.primary, fontWeight: '700', textDecorationLine: 'underline' },
  txDivider: { width: 1, alignSelf: 'stretch', backgroundColor: t.primary, opacity: 0.4 },
  txValue: { fontSize: 14, fontWeight: '800', color: colors.dark, minWidth: 80, textAlign: 'right' },
}));
