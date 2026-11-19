import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, colors, Screen, TabBar, ThemeProvider, themes, styles as s } from '../ui';
import { firebaseConfigured } from '../backend/firebase';
import { Role, useSession, ProfileInput } from '../backend/session';
import { cep, cnpj, passwordRequirements } from '../../functions/core';
import { Feedback, Input, useAction } from './components';
import { PetsPanel } from './PetsPanel';
import { NotificationBell, NotificationsPanel, useNotifications } from './Notifications';
import { ApplicationsPanel } from './ApplicationsPanel';
import { PaymentsPanel } from './PaymentsPanel';
import { Team } from './OrgProfile';
import { ProfilePanel } from './ProfilePanel';
import { Typewriter } from './Typewriter';
export default function AccountScreen() {
  const session = useSession();
  if (session.loading) return <View style={[s.page, { justifyContent: 'center' }]}><ActivityIndicator accessibilityLabel="Carregando conta" /></View>;
  if (session.user && session.profile) return <Dashboard key={session.user.uid} />;
  return <AuthForm />;
}
function AuthForm() {
  const session = useSession();
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<Role>('donor');
  const [fullName, setFullName] = useState('');
  const [ongName, setOngName] = useState('');
  const [orgCnpj, setOrgCnpj] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [location, setLocation] = useState<{ cep: string; city: string; state: string; street: string; neighborhood: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [welcome, setWelcome] = useState(true);
  const [step, setStep] = useState(1);
  const [searching, setSearching] = useState(false);
  const [cepError, setCepError] = useState('');
  const action = useAction();
  const completing = !!session.user;
  const form = registering || completing;
  const requirements = passwordRequirements(password);
  const ong = role === 'ong';
  async function findCep(value: string) {
    setCepError('');
    let code = '';
    try { code = cep(value); } catch { setCepError('CEP inválido.'); return; }
    setSearching(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${code}/json/`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Não foi possível consultar o CEP.');
      const data = await response.json();
      if (data.erro || !data.localidade) throw Error('CEP não encontrado.');
      setLocation({ cep: code, city: data.localidade, state: data.uf, street: data.logradouro || '', neighborhood: data.bairro || '' });
    } catch (error) {
      setCepError(error instanceof Error && !error.name.includes('Timeout') && !error.name.includes('Abort') ? error.message : 'Não foi possível consultar o CEP.');
    } finally { setSearching(false); }
  }
  function changeMode(register: boolean) { setRegistering(register); setStep(1); action.setMessage(''); setPassword(''); setConfirmation(''); }
  if (welcome && !completing) return <Welcome onLogin={() => { changeMode(false); setWelcome(false); }} onRegister={() => { changeMode(true); setWelcome(false); }} />;
  const details = form && (completing || step === 1);
  const title = completing ? 'Seu cadastro' : !registering ? 'Boas-vindas' : 'Criar conta';
  const back = completing ? undefined : registering && step === 2 ? () => { setStep(1); action.setMessage(''); } : () => { setWelcome(true); action.setMessage(''); };
  return <AuthLayout title={title} onBack={back}>
    {!firebaseConfigured && <Text style={s.notice}>O serviço de contas ainda não foi ativado.</Text>}
    {registering && !completing && <View style={styles.steps} accessibilityLabel={`Etapa ${step} de 2`}>{[1, 2].map(item => <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />)}</View>}
    <View style={{ gap: 18 }}>
      {details && <>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {([['donor', 'Doador / adotante'], ['ong', 'ONG / abrigo']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: role === value }} disabled={action.busy} onPress={() => setRole(value)} style={[styles.segmentItem, role === value && styles.segmentActive]}><Text style={[styles.segmentText, role === value && styles.segmentTextActive]}>{label}</Text></Pressable>)}
        </View>
        <Input pill label={ong ? 'Nome do responsável' : 'Nome completo'} placeholder="Maria da Silva" value={fullName} onChange={setFullName} />
        {ong && <><Input pill label="Nome da ONG" placeholder="Abrigo Patinhas" value={ongName} onChange={setOngName} /><Input pill label="Razão social (opcional)" placeholder="Associação Abrigo Patinhas" value={legalName} onChange={setLegalName} maxLength={150} /><Input pill label="CNPJ (opcional)" placeholder="00000000000000" numeric value={orgCnpj} onChange={value => setOrgCnpj(value.replace(/\D/g, '').slice(0, 14))} maxLength={14} /></>}
        <Input pill label="Celular com DDD" placeholder="11987654321" numeric value={phone} onChange={value => setPhone(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
        <View style={{ gap: 6 }}>
          <Input pill label="CEP" placeholder="00000000" numeric value={postalCode} maxLength={8} onChange={value => { const digits = value.replace(/\D/g, '').slice(0, 8); setPostalCode(digits); setLocation(null); setCepError(''); if (digits.length === 8) void findCep(digits); }} right={searching ? <ActivityIndicator style={{ paddingHorizontal: 14 }} color={colors.green} /> : null} />
          {!!location && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 }}><MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.green} /><Text style={[styles.hintOk, { paddingLeft: 0 }]}>{location.city} / {location.state}</Text></View>}
          {!!cepError && <Text style={styles.hintError}>{cepError}</Text>}
        </View>
      </>}
      {!completing && (!registering || step === 2) && <>
        <Input pill label="E-mail" placeholder="voce@email.com" email value={email} onChange={setEmail} maxLength={254} />
        <Input pill label="Senha" placeholder="••••••••••" password value={password} onChange={setPassword} maxLength={128} />
        {registering && <>
          <View style={s.row}>{['10+ caracteres', 'A–Z', 'a–z', '0–9', '!@#'].map((label, index) => <Text key={label} style={[styles.chip, requirements[index] && styles.chipOk]}>{requirements[index] ? '✓ ' : ''}{label}</Text>)}</View>
          <Input pill label="Confirmar senha" placeholder="••••••••••" password value={confirmation} onChange={setConfirmation} maxLength={128} />
        </>}
      </>}
      <Feedback message={action.message || session.error} />
      {registering && !completing && step === 2 && <Text style={styles.terms}>Ao continuar, você concorda com os{'\n'}<Text style={styles.termsStrong}>Termos de Uso</Text> e a <Text style={styles.termsStrong}>Política de Privacidade</Text>.</Text>}
      <View style={styles.actions}>
        <Button disabled={action.busy || !firebaseConfigured || searching} title={action.busy ? 'Aguarde…' : completing ? 'Concluir cadastro' : !registering ? 'Entrar' : step === 1 ? 'Continuar' : 'Criar conta'} onPress={() => void action.run(async () => {
          const profile: ProfileInput = { role, fullName, ongName, phone, cep: postalCode, ...(ong && { cnpj: orgCnpj, legalName }) };
          if (details) {
            if (!fullName.trim() || (ong && !ongName.trim())) throw Error('Preencha seu nome' + (ong ? ' e o nome da ONG.' : '.'));
            if (phone.length < 10) throw Error('Informe o telefone com DDD.');
            if (!location || location.cep !== postalCode) throw Error('Informe um CEP válido.');
            if (ong && orgCnpj) cnpj(orgCnpj);
          }
          if (completing) await session.saveProfile(profile);
          else if (registering && step === 1) setStep(2);
          else if (registering) {
            if (password !== confirmation) throw Error('As senhas não conferem.');
            await session.register(email, password, profile);
          } else await session.login(email, password);
          if (!registering || step === 2) { setPassword(''); setConfirmation(''); }
        })} />
      </View>
      {!completing && !registering && <>
        <Pressable accessibilityRole="button" disabled={action.busy || !firebaseConfigured} onPress={() => void action.run(async () => { await session.reset(email); action.setMessage('Se houver uma conta elegível, você receberá as instruções no e-mail informado.'); })} style={styles.forgot}><Text style={styles.forgotText}>Esqueci minha senha</Text></Pressable>
        <View style={styles.actions}><Button secondary disabled={action.busy} title="Criar conta" onPress={() => changeMode(true)} /></View>
      </>}
      {completing
        ? <Pressable accessibilityRole="button" onPress={() => void action.run(session.logout)} style={styles.footer}><Text style={styles.footerText}>Sair da conta</Text></Pressable>
        : registering && <Pressable accessibilityRole="button" disabled={action.busy} onPress={() => changeMode(!registering)} style={styles.footer}><Text style={styles.footerText}>{registering ? 'Já tem conta? ' : 'Não tem conta? '}<Text style={styles.linkText}>{registering ? 'Entrar' : 'Criar conta'}</Text></Text></Pressable>}
    </View>
  </AuthLayout>;
}
// Layout das telas de entrada/cadastro: título sobre o verde e área clara arredondada.
function AuthLayout({ title, onBack, children }: React.PropsWithChildren<{ title: string; onBack?: () => void }>) {
  const insets = useSafeAreaInsets();
  return <View style={styles.authPage}>
    <View style={[styles.authHeader, { paddingTop: insets.top + 12 }]}>
      <View style={styles.authTop}>{onBack && <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={12} style={styles.authBack}><MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} /></Pressable>}</View>
      <Text style={styles.authTitle} accessibilityRole="header">{title}</Text>
    </View>
    <ScrollView style={styles.authSheet} contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </View>;
}
function Welcome({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  // Foto: Nicholas Brownlow / Unsplash (Unsplash License).
  return <View style={styles.welcome}>
    <Image source={require('../../assets/welcome-pet.jpg')} resizeMode="cover" style={styles.welcomePhoto} accessibilityIgnoresInvertColors />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs><LinearGradient id="welcome-fade" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.green} stopOpacity={0} />
        <Stop offset="0.3" stopColor={colors.green} stopOpacity={0.05} />
        <Stop offset="0.5" stopColor={colors.green} stopOpacity={0.75} />
        <Stop offset="0.62" stopColor={colors.green} stopOpacity={1} />
      </LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#welcome-fade)" />
    </Svg></View>
    <View style={styles.logo}><Text style={styles.logoIcon}>♥</Text><View style={styles.logoPaws}><MaterialCommunityIcons name="paw" size={24} color={colors.white} style={styles.pawLow} /><MaterialCommunityIcons name="paw" size={24} color={colors.white} style={styles.pawHigh} /></View></View>
    <Text style={styles.brand}><Text style={{ color: colors.header }}>Apoia</Text>Pet</Text>
    <Text style={styles.tagline}>Um novo começo para cada patinha.{'\n'}Adote, doe e acompanhe abrigos perto de você.</Text>
    <View style={styles.welcomeActions}>
      <Pressable accessibilityRole="button" onPress={onLogin} style={[styles.welcomeButton, { backgroundColor: colors.header }]}><Text style={styles.welcomeButtonText}>Entrar</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onRegister} style={[styles.welcomeButton, { backgroundColor: colors.mint }]}><Text style={styles.welcomeButtonText}>Criar conta</Text></Pressable>
    </View>
  </View>;
}
function Dashboard() {
  const { profile, user } = useSession();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = ['pets', 'applications', 'calendar', 'payments', 'profile'].includes(params.tab || '') ? params.tab : 'pets';
  const notifications = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  if (!profile || !user) return null;
  const ong = profile.role === 'ong';
  const tabs = [
    { key: 'pets', label: ong ? 'Animais' : 'Adotar', icon: 'paw' as const },
    { key: 'applications', label: ong ? 'Abrigo' : 'Pedidos', icon: 'clipboard-text' as const },
    { key: 'calendar', label: 'Agenda', icon: 'calendar-month' as const },
    { key: 'payments', label: ong ? 'Doações' : 'Doar', icon: 'heart' as const },
    { key: 'profile', label: 'Perfil', icon: 'account' as const },
  ];
  const titles: Record<string, string> = { pets: ong ? 'Meus animais' : 'Adotar', applications: ong ? 'Administração' : 'Minhas candidaturas', calendar: 'Agenda', payments: ong ? 'Doações recebidas' : 'Doar', profile: 'Meu perfil' };
  const phrases = [`Olá, ${profile.name}!`, ...(ong ? ongPhrases : donorPhrases)];
  return <ThemeProvider theme={ong ? themes.ong : themes.donor}><Screen title={titles[tab!]} subtitle={<Typewriter phrases={phrases} style={[s.headerSubtitle, styles.greeting, { color: (ong ? themes.ong : themes.donor).primary }]} />} right={<NotificationBell unread={notifications.unread} onPress={() => setMenuOpen(true)} />} footer={<TabBar items={tabs} active={tab!} onChange={key => router.setParams({ tab: key })} />}>
    {tab === 'pets' && <PetsPanel />}
    {(tab === 'applications' || tab === 'calendar') && <><ApplicationsPanel calendar={tab === 'calendar'} />{ong && tab === 'applications' && <View style={{ gap: 12, marginTop: 8 }}><Text style={s.subtitle}>Equipe</Text><Team /></View>}</>}
    {tab === 'payments' && <PaymentsPanel />}
    {tab === 'profile' && <ProfilePanel />}
    <NotificationsPanel visible={menuOpen} top={insets.top + 76} notes={notifications.notes} seen={notifications.seen} onClose={() => { setMenuOpen(false); notifications.markRead(); }} onOpenTab={key => router.setParams({ tab: key })} />
  </Screen></ThemeProvider>;
}
const donorPhrases = [
  'Que bom ter você aqui!',
  'Um focinho espera por você.',
  'Sua doação aquece um coração.',
  'Juntos, mudamos histórias.',
  'Hoje é um ótimo dia para ajudar.',
  'Obrigado por fazer parte!',
];
const ongPhrases = [
  'Obrigado por cuidar deles!',
  'Cada cadastro é uma nova chance.',
  'Seu trabalho muda histórias.',
  'Um novo lar está a caminho.',
];
const styles = StyleSheet.create({
  greeting: { minHeight: 22, lineHeight: 22, paddingHorizontal: 8 },
  welcomePhoto: { position: 'absolute', top: 0, left: 0, width: '100%', height: '70%' },
  welcome: { flex: 1, overflow: 'hidden', backgroundColor: colors.green, alignItems: 'center', justifyContent: 'flex-end', padding: 32, paddingBottom: 48, gap: 18 },
  logo: { width: 150, height: 130, alignItems: 'center', justifyContent: 'center' },
  logoIcon: { fontSize: 140, lineHeight: 150, color: colors.header },
  logoPaws: { position: 'absolute', top: 49, width: 44, height: 42 },
  pawLow: { position: 'absolute', left: 0, bottom: 0, transform: [{ rotate: '25deg' }] },
  pawHigh: { position: 'absolute', right: 0, top: 0, transform: [{ rotate: '25deg' }] },
  brand: { fontSize: 46, fontWeight: '900', color: colors.white, letterSpacing: 0.5 },
  tagline: { color: colors.mint, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 18 },
  welcomeActions: { width: '100%', maxWidth: 260, gap: 10 },
  welcomeButton: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  welcomeButtonText: { color: colors.green, fontSize: 20, fontWeight: '700' },
  link: { alignSelf: 'flex-end', paddingVertical: 6, minHeight: 32, marginTop: -8 },
  linkText: { color: colors.green, fontWeight: '700' },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  stepDot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.soft },
  stepDotActive: { backgroundColor: colors.green },
  segment: { flexDirection: 'row', backgroundColor: colors.mint, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.green },
  segmentText: { color: colors.green, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  hintOk: { color: colors.green, fontWeight: '600', paddingLeft: 4 },
  hintError: { color: '#B3261E', fontWeight: '600', paddingLeft: 4 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.mint, color: colors.muted, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  chipOk: { backgroundColor: colors.green, color: colors.white },
  actions: { width: '100%', maxWidth: 240, alignSelf: 'center', marginTop: 20 },
  authPage: { flex: 1, backgroundColor: colors.green },
  authHeader: { paddingHorizontal: 22, paddingBottom: 64, width: '100%', maxWidth: 650, alignSelf: 'center' },
  authTop: { height: 40, justifyContent: 'center' },
  authBack: { width: 40, height: 40, justifyContent: 'center' },
  authTitle: { marginTop: 18, fontSize: 34, fontWeight: '800', color: colors.white, textAlign: 'center' },
  authSheet: { flex: 1, marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 56, borderTopRightRadius: 56 },
  authContent: { paddingHorizontal: 28, paddingTop: 44, paddingBottom: 48, gap: 18, width: '100%', maxWidth: 520, alignSelf: 'center' },
  forgot: { alignSelf: 'center', paddingVertical: 4, minHeight: 32, justifyContent: 'center' },
  forgotText: { color: colors.dark, fontWeight: '700' },
  terms: { color: colors.text, textAlign: 'center', lineHeight: 20 },
  termsStrong: { fontWeight: '800', color: colors.dark },
  footer: { alignSelf: 'center', paddingVertical: 8, minHeight: 40 },
  footerText: { color: colors.muted },
});
