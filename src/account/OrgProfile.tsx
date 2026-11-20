import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import type { OrgInfo } from '../../backend/lib/core';
import { cnpj as validCnpj } from '../../backend/lib/core';
import { db, usingEmulators } from '../backend/firebase';
import { call, useSession } from '../backend/session';
import { Application, currency, Donation, donationCounts, Listing, useRecords } from '../backend/data';
import { pickPhoto, uploadPhoto } from '../backend/photos';
import { Button, colors, styles as s, themedStyles, useTheme } from '../ui';
import { Feedback, Input, StoredPhoto, useAction } from './components';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const realPaymentsEnabled = !usingEmulators && process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';
const emptyOrg: OrgInfo = { cnpj: '', legalName: '', about: '', foundedYear: null, whatsapp: '', publicEmail: '', instagram: '', website: '', address: '', hours: '', team: [] };
export const formatCnpj = (value: string) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const formatPhone = (value: string) => value.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

// Foto de capa (banner) da ONG, com botão para trocar.
export function OrgCover() {
  const st = useSheet();
  const theme = useTheme();
  const { profile, user } = useSession();
  const action = useAction();
  return <View style={st.cover}>
    {profile?.coverPath ? <StoredPhoto path={profile.coverPath} label="Foto de capa da ONG" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.headerDeep, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 22 }]}><MaterialCommunityIcons name="image-plus" size={26} color={colors.white} /><Text style={st.coverHint}>Adicione uma foto de capa</Text></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={profile?.coverPath ? 'Trocar foto de capa' : 'Adicionar foto de capa'} disabled={action.busy} hitSlop={8} style={st.coverButton} onPress={() => void action.run(async () => {
      const picked = await pickPhoto();
      if (!picked || !user) return;
      const path = await uploadPhoto(picked, 'avatar');
      await call('setProfilePhoto', { photoPath: path, kind: 'cover' });
    })}>{action.busy ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="camera" size={18} color={colors.white} />}</Pressable>
    {!!action.message && <Text style={st.coverError}>{action.message}</Text>}
  </View>;
}

// Painel de impacto com dados que o app já registra.
export function ImpactPanel() {
  const st = useSheet();
  const theme = useTheme();
  const { user } = useSession();
  const uid = user?.uid ?? null;
  const pets = useRecords<Listing>('pets', 'ongId', uid);
  const applications = useRecords<Application>('applications', 'ongId', uid);
  const donations = useRecords<Donation>('donations', 'ongId', uid);
  const received = donations.records.filter(donationCounts);
  const stats: [Icon, string, string][] = [
    ['paw', String(pets.records.length), 'Animais cadastrados'],
    ['home-heart', String(pets.records.filter(pet => pet.status === 'adopted').length), 'Adotados'],
    ['hand-heart', currency(received.reduce((sum, item) => sum + item.amountCents, 0)), 'Recebido em doações'],
    ['account-group', String(new Set(received.map(item => item.donorId)).size), 'Doadores'],
    ['clipboard-text-clock', String(applications.records.filter(item => ['sent', 'in_review', 'needs_info', 'approved'].includes(item.status)).length), 'Candidaturas em andamento'],
    ['calendar-check', String(applications.records.filter(item => item.status === 'scheduled').length), 'Retiradas agendadas'],
  ];
  const loading = pets.loading || applications.loading || donations.loading;
  return <View style={{ gap: 10 }}>
    <Text style={st.sectionTitle}>Nosso impacto</Text>
    <View style={st.grid}>
      {stats.map(([icon, value, label]) => <View key={label} style={st.stat}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primary} />
        {loading ? <ActivityIndicator size="small" color={theme.primary} style={{ alignSelf: 'flex-start' }} /> : <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>}
        <Text style={st.statLabel} numberOfLines={2}>{label}</Text>
      </View>)}
    </View>
  </View>;
}

// Cartão público com os dados da instituição.
export function OrgInfoCard({ onEdit }: { onEdit: () => void }) {
  const st = useSheet();
  const theme = useTheme();
  const { profile } = useSession();
  const org = { ...emptyOrg, ...profile?.org };
  const lines: [Icon, string][] = [
    org.foundedYear ? ['calendar-star', `Fundada em ${org.foundedYear}`] : null,
    org.address ? ['map-marker-outline', org.address] : null,
    org.hours ? ['clock-outline', org.hours] : null,
  ].filter(Boolean) as [Icon, string][];
  const contacts: [Icon, string, string][] = [
    org.whatsapp ? ['whatsapp', 'WhatsApp', `https://wa.me/55${org.whatsapp}`] : null,
    org.publicEmail ? ['email-outline', 'E-mail', `mailto:${org.publicEmail}`] : null,
    org.instagram ? ['instagram', 'Instagram', `https://instagram.com/${org.instagram}`] : null,
    org.website ? ['web', 'Site', org.website] : null,
  ].filter(Boolean) as [Icon, string, string][];
  const empty = !org.about && !lines.length && !contacts.length;
  return <View style={st.card}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[st.sectionTitle, { flex: 1 }]}>Sobre a instituição</Text>
      <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}><Text style={[st.link, { color: theme.primary }]}>Editar</Text></Pressable>
    </View>
    {empty ? <Text style={s.muted}>Conte quem vocês são, como falar com vocês e quando atendem. Toque em “Editar” para preencher.</Text> : <>
      {!!org.about && <Text style={st.about}>{org.about}</Text>}
      {lines.map(([icon, text]) => <View key={text} style={st.line}><MaterialCommunityIcons name={icon} size={18} color={theme.primary} /><Text style={st.lineText}>{text}</Text></View>)}
      {contacts.length > 0 && <View style={st.contacts}>{contacts.map(([icon, label, url]) => <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} style={({ pressed }) => [st.contact, { backgroundColor: theme.primary }, pressed && { opacity: 0.8 }]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.white} />
      </Pressable>)}</View>}
    </>}
  </View>;
}

// Formulário "Dados da instituição": responsável e endereço + ficha pública.
export function OrgForm({ onDone }: { onDone: () => void }) {
  const st = useSheet();
  const { profile, user, saveProfile } = useSession();
  const org = { ...emptyOrg, ...profile?.org };
  const [fullName, setFullName] = useState(profile!.fullName);
  const [ongName, setOngName] = useState(profile!.name);
  const [phone, setPhone] = useState(profile!.phone);
  const [postalCode, setPostalCode] = useState(profile!.cep);
  const [form, setForm] = useState({ ...org, foundedYear: org.foundedYear ? String(org.foundedYear) : '' });
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const action = useAction();
  const [open, setOpen] = useState('');
  const filled = (...values: string[]) => `${values.filter(value => value.trim()).length} de ${values.length} preenchidos`;
  const group = (key: string, title: string, icon: Icon, summary: string, children: React.ReactNode) =>
    <FormGroup key={key} title={title} icon={icon} summary={summary} open={open === key} onToggle={() => setOpen(open === key ? '' : key)}>{children}</FormGroup>;
  return <View style={{ gap: 10 }}>
    {group('id', 'Identificação', 'card-account-details-outline', filled(ongName, form.legalName, form.cnpj, form.foundedYear, form.about), <>
      <Input label="Nome público da ONG" value={ongName} onChange={setOngName} />
      <Input label="Razão social" placeholder="Associação Protetora dos Animais" value={form.legalName} onChange={set('legalName')} maxLength={150} />
      <Input label="CNPJ" placeholder="00.000.000/0000-00" numeric value={form.cnpj} onChange={value => set('cnpj')(value.replace(/\D/g, '').slice(0, 14))} maxLength={14} />
      <Input label="Ano de fundação" placeholder="2015" numeric value={form.foundedYear} onChange={value => set('foundedYear')(value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
      <Input label="Sobre / missão" placeholder="O que a ONG faz, quem atende e como ajuda os animais." value={form.about} onChange={set('about')} multiline maxLength={600} />
    </>)}
    {group('contacts', 'Contatos públicos', 'phone-outline', filled(form.whatsapp, form.publicEmail, form.instagram, form.website), <>
      <Input label="WhatsApp com DDD" placeholder="11987654321" numeric value={form.whatsapp} onChange={value => set('whatsapp')(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
      <Input label="E-mail público" placeholder="contato@suaong.org" email value={form.publicEmail} onChange={set('publicEmail')} maxLength={254} />
      <Input label="Instagram" placeholder="@suaong" value={form.instagram} onChange={set('instagram')} maxLength={80} />
      <Input label="Site" placeholder="suaong.org.br" value={form.website} onChange={set('website')} maxLength={200} />
    </>)}
    {group('service', 'Atendimento', 'clock-outline', filled(form.address, form.hours), <>
      <Input label="Endereço para visitas e retiradas" placeholder="Rua, número, bairro" value={form.address} onChange={set('address')} maxLength={200} />
      <Input label="Horário de atendimento" placeholder="Seg a sex, 9h às 17h" value={form.hours} onChange={set('hours')} maxLength={120} />
    </>)}
    {group('owner', 'Responsável e cadastro', 'account-tie-outline', filled(fullName, phone, postalCode), <>
      <Input label="Nome completo do responsável" value={fullName} onChange={setFullName} />
      <Input label="Telefone do responsável" numeric value={phone} onChange={value => setPhone(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
      <Input label="CEP da ONG" numeric value={postalCode} onChange={value => setPostalCode(value.replace(/\D/g, '').slice(0, 8))} maxLength={8} />
      <Text style={s.muted}>Login: {user!.email}. Telefone e CEP do responsável ficam privados; os contatos públicos aparecem no perfil da ONG.</Text>
    </>)}
    <Feedback message={action.message} />
    <View style={st.actions}><Button disabled={action.busy} title={action.busy ? 'Salvando…' : 'Salvar dados'} onPress={() => void action.run(async () => {
      if (form.cnpj) validCnpj(form.cnpj);
      await call('saveOrgInfo', { ...form, team: org.team });
      await saveProfile({ role: 'ong', fullName, ongName, phone, cep: postalCode });
      onDone();
    })} /></View>
  </View>;
}

// Tópico do formulário que abre e fecha ao tocar.
function FormGroup({ title, icon, summary, open, onToggle, children }: React.PropsWithChildren<{ title: string; icon: Icon; summary: string; open: boolean; onToggle: () => void }>) {
  const st = useSheet();
  const theme = useTheme();
  return <View style={[st.groupCard, open && { borderColor: theme.primary }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}, ${summary}`} onPress={onToggle} style={({ pressed }) => [st.groupHeader, pressed && { opacity: 0.75 }]}>
      <View style={[st.groupIcon, { backgroundColor: theme.primary }]}><MaterialCommunityIcons name={icon} size={20} color={colors.white} /></View>
      <View style={{ flex: 1 }}><Text style={st.lineTitle}>{title}</Text><Text style={s.muted}>{summary}</Text></View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={theme.primary} />
    </Pressable>
    {open && <View style={st.groupBody}>{children}</View>}
  </View>;
}

// Recebimentos: status da conta Mercado Pago e totais.
export function Receipts() {
  const st = useSheet();
  const theme = useTheme();
  const { user } = useSession();
  const donations = useRecords<Donation>('donations', 'ongId', user?.uid ?? null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const action = useAction();
  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(doc(db, 'paymentConnections', user.uid), snapshot => setConnected(!!snapshot.data()?.connected), () => setConnected(false));
  }, [user]);
  const received = donations.records.filter(donationCounts);
  const real = received.filter(item => item.mode === 'mercadopago').reduce((sum, item) => sum + item.amountCents, 0);
  const test = received.filter(item => item.mode === 'test').reduce((sum, item) => sum + item.amountCents, 0);
  return <View style={{ gap: 14 }}>
    <View style={st.card}>
      <View style={st.line}>
        <View style={[st.badgeIcon, { backgroundColor: connected ? theme.primary : colors.muted }]}><MaterialCommunityIcons name={connected ? 'check' : 'link-variant-off'} size={18} color={colors.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.lineTitle}>Mercado Pago</Text>
          <Text style={s.muted}>{connected === null ? 'Verificando…' : connected ? 'Conta conectada: as doações caem direto na conta da ONG.' : 'Conta não conectada.'}</Text>
        </View>
      </View>
      {!connected && <Button disabled={action.busy || !realPaymentsEnabled} title={realPaymentsEnabled ? 'Conectar conta' : 'Disponível em breve'} onPress={() => void action.run(async () => { const result = await call<{ url: string }>('startMercadoPagoConnection', {}); await Linking.openURL(result.url); })} />}
      <Feedback message={action.message} />
    </View>
    <View style={st.grid}>
      <View style={st.stat}><MaterialCommunityIcons name="cash-check" size={20} color={theme.primary} /><Text style={st.statValue}>{currency(real)}</Text><Text style={st.statLabel}>Recebido pelo Mercado Pago</Text></View>
      <View style={st.stat}><MaterialCommunityIcons name="flask-outline" size={20} color={theme.primary} /><Text style={st.statValue}>{currency(test)}</Text><Text style={st.statLabel}>Doações de teste</Text></View>
    </View>
    <Text style={s.muted}>O histórico completo de doações fica na aba “Doações”.</Text>
  </View>;
}

// Equipe: lista de pessoas e funções exibidas no perfil.
export function Team() {
  const st = useSheet();
  const theme = useTheme();
  const { profile } = useSession();
  const org = { ...emptyOrg, ...profile?.org };
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [adding, setAdding] = useState(false);
  const action = useAction();
  const save = (team: OrgInfo['team']) => action.run(async () => { await call('saveOrgInfo', { ...org, foundedYear: org.foundedYear ?? '', team }); });
  return <View style={{ gap: 14 }}>
    {org.team.length === 0 && <Text style={s.muted}>Adicione quem faz parte da ONG: coordenação, voluntários, veterinários…</Text>}
    {org.team.map((member, index) => <View key={`${member.name}-${index}`} style={[st.card, st.line]}>
      <View style={[st.badgeIcon, { backgroundColor: theme.primary }]}><Text style={{ color: colors.white, fontWeight: '800' }}>{member.name.split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join('')}</Text></View>
      <View style={{ flex: 1 }}><Text style={st.lineTitle}>{member.name}</Text>{!!member.role && <Text style={s.muted}>{member.role}</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${member.name}`} disabled={action.busy} hitSlop={8} onPress={() => void save(org.team.filter((_, i) => i !== index))}><MaterialCommunityIcons name="trash-can-outline" size={22} color="#B3261E" /></Pressable>
    </View>)}
    {org.team.length < 20 && !adding && <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={({ pressed }) => [st.addButton, { borderColor: theme.primary }, pressed && { opacity: 0.75 }]}>
      <MaterialCommunityIcons name="account-plus-outline" size={20} color={theme.primary} />
      <Text style={[st.lineTitle, { color: theme.primary }]}>Adicionar pessoa</Text>
    </Pressable>}
    {org.team.length < 20 && adding && <View style={[st.card, { gap: 12 }]}>
      <Text style={st.lineTitle}>Nova pessoa na equipe</Text>
      <Input label="Nome" placeholder="Ana Lima" value={name} onChange={setName} maxLength={80} />
      <Input label="Função" placeholder="Coordenação, voluntária…" value={role} onChange={setRole} maxLength={60} />
      <Button disabled={action.busy || !name.trim()} title={action.busy ? 'Salvando…' : 'Adicionar à equipe'} onPress={() => void save([...org.team, { name: name.trim(), role: role.trim() }]).then(() => { setName(''); setRole(''); setAdding(false); })} />
      <Button secondary disabled={action.busy} title="Cancelar" onPress={() => { setAdding(false); setName(''); setRole(''); }} />
    </View>}
    <Feedback message={action.message} />
  </View>;
}
export function OrgSubtitle() {
  const { profile } = useSession();
  const org = profile?.org;
  if (!org?.legalName && !org?.cnpj) return null;
  return <Text style={[s.muted, { textAlign: 'center' }]}>{[org.legalName, org.cnpj && `CNPJ ${formatCnpj(org.cnpj)}`].filter(Boolean).join(' · ')}</Text>;
}
export { formatPhone };

const useSheet = themedStyles(t => StyleSheet.create({
  cover: { height: 140, borderRadius: 24, overflow: 'hidden', backgroundColor: t.soft },
  coverHint: { color: colors.white, fontWeight: '700', marginTop: 4 },
  coverButton: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  coverError: { position: 'absolute', left: 10, right: 56, top: 10, color: colors.white, backgroundColor: 'rgba(0,0,0,0.55)', padding: 6, borderRadius: 8, fontSize: 12, overflow: 'hidden' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.dark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: colors.white, borderRadius: 18, padding: 12, gap: 4, borderWidth: 1, borderColor: t.soft },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: t.soft },
  link: { fontWeight: '700' },
  about: { fontSize: 15, lineHeight: 22, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineText: { flex: 1, fontSize: 14, color: colors.text },
  lineTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  contacts: { flexDirection: 'row', gap: 10, marginTop: 4 },
  contact: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: colors.white },
  groupCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: t.soft, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 60 },
  groupIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupBody: { paddingHorizontal: 12, paddingBottom: 14, gap: 14 },
  actions: { width: '100%', maxWidth: 280, alignSelf: 'center', marginTop: 8 },
}));
