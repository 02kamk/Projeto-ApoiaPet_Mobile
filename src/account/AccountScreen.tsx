import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, colors, LinkButton, Screen, TabBar, styles as s } from '../ui';
import { firebaseConfigured, usingEmulators } from '../backend/firebase';
import { Role, useSession, ProfileInput } from '../backend/session';
import { cep, passwordRequirements } from '../../functions/core';
import { Feedback, Input, useAction } from './components';
import { PetsPanel } from './PetsPanel';
import { ApplicationsPanel } from './ApplicationsPanel';
import { PaymentsPanel } from './PaymentsPanel';
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
  const title = completing ? 'Seu cadastro' : !registering ? 'Entrar' : step === 1 ? 'Nova conta' : 'Sua senha';
  const back = completing ? undefined : registering && step === 2 ? () => { setStep(1); action.setMessage(''); } : () => { setWelcome(true); action.setMessage(''); };
  return <Screen title={title} onBack={back}>
    {usingEmulators && <Text style={styles.testBadge}>Modo de teste</Text>}
    {!firebaseConfigured && <Text style={s.notice}>O serviço de contas ainda não foi ativado.</Text>}
    {registering && !completing && <View style={styles.steps} accessibilityLabel={`Etapa ${step} de 2`}>{[1, 2].map(item => <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />)}</View>}
    <View style={{ gap: 18 }}>
      {details && <>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {([['donor', 'Doador / adotante'], ['ong', 'ONG / abrigo']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: role === value }} disabled={action.busy} onPress={() => setRole(value)} style={[styles.segmentItem, role === value && styles.segmentActive]}><Text style={[styles.segmentText, role === value && styles.segmentTextActive]}>{label}</Text></Pressable>)}
        </View>
        <Input label={ong ? 'Nome do responsável' : 'Nome completo'} placeholder="Maria da Silva" value={fullName} onChange={setFullName} />
        {ong && <Input label="Nome da ONG" placeholder="Abrigo Patinhas" value={ongName} onChange={setOngName} />}
        <Input label="Celular com DDD" placeholder="11987654321" numeric value={phone} onChange={value => setPhone(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
        <View style={{ gap: 6 }}>
          <Input label="CEP" placeholder="00000000" numeric value={postalCode} maxLength={8} onChange={value => { const digits = value.replace(/\D/g, '').slice(0, 8); setPostalCode(digits); setLocation(null); setCepError(''); if (digits.length === 8) void findCep(digits); }} right={searching ? <ActivityIndicator style={{ paddingHorizontal: 14 }} color={colors.green} /> : null} />
          {!!location && <Text style={styles.hintOk}>📍 {location.city} / {location.state}</Text>}
          {!!cepError && <Text style={styles.hintError}>{cepError}</Text>}
        </View>
      </>}
      {!completing && (!registering || step === 2) && <>
        <Input label="E-mail" placeholder="voce@email.com" email value={email} onChange={setEmail} maxLength={254} />
        <Input label="Senha" placeholder="••••••••••" password value={password} onChange={setPassword} maxLength={128} />
        {registering && <>
          <View style={s.row}>{['10+ caracteres', 'A–Z', 'a–z', '0–9', '!@#'].map((label, index) => <Text key={label} style={[styles.chip, requirements[index] && styles.chipOk]}>{requirements[index] ? '✓ ' : ''}{label}</Text>)}</View>
          <Input label="Confirmar senha" placeholder="••••••••••" password value={confirmation} onChange={setConfirmation} maxLength={128} />
        </>}
        {!registering && <Pressable accessibilityRole="button" disabled={action.busy || !firebaseConfigured} onPress={() => void action.run(async () => { await session.reset(email); action.setMessage('Se houver uma conta elegível, você receberá as instruções no e-mail informado.'); })} style={styles.link}><Text style={styles.linkText}>Esqueci minha senha</Text></Pressable>}
      </>}
      <Feedback message={action.message || session.error} />
      <View style={styles.actions}>
        <Button disabled={action.busy || !firebaseConfigured || searching} title={action.busy ? 'Aguarde…' : completing ? 'Concluir cadastro' : !registering ? 'Entrar' : step === 1 ? 'Continuar' : 'Criar conta'} onPress={() => void action.run(async () => {
          const profile: ProfileInput = { role, fullName, ongName, phone, cep: postalCode };
          if (details) {
            if (!fullName.trim() || (ong && !ongName.trim())) throw Error('Preencha seu nome' + (ong ? ' e o nome da ONG.' : '.'));
            if (phone.length < 10) throw Error('Informe o telefone com DDD.');
            if (!location || location.cep !== postalCode) throw Error('Informe um CEP válido.');
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
      {completing
        ? <Pressable accessibilityRole="button" onPress={() => void action.run(session.logout)} style={styles.footer}><Text style={styles.footerText}>Sair da conta</Text></Pressable>
        : <Pressable accessibilityRole="button" disabled={action.busy} onPress={() => changeMode(!registering)} style={styles.footer}><Text style={styles.footerText}>{registering ? 'Já tem conta? ' : 'Não tem conta? '}<Text style={styles.linkText}>{registering ? 'Entrar' : 'Criar conta'}</Text></Text></Pressable>}
    </View>
  </Screen>;
}
function Welcome({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return <View style={styles.welcome}>
    <View style={styles.logo}><Text style={styles.logoIcon}>♥</Text><Text style={styles.logoPaw}>🐾</Text></View>
    <Text style={styles.brand}><Text style={{ color: colors.header }}>Apoia</Text>Pet</Text>
    <Text style={styles.tagline}>Um novo começo para cada patinha.{'\n'}Adote, doe e acompanhe abrigos perto de você.</Text>
    <View style={styles.welcomeActions}>
      <Pressable accessibilityRole="button" onPress={onLogin} style={[styles.welcomeButton, { backgroundColor: colors.header }]}><Text style={styles.welcomeButtonText}>Entrar</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onRegister} style={[styles.welcomeButton, { backgroundColor: colors.mint }]}><Text style={styles.welcomeButtonText}>Criar conta</Text></Pressable>
    </View>
  </View>;
}
function Dashboard() {
  const { profile, logout, user } = useSession();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = ['pets', 'applications', 'calendar', 'payments', 'history'].includes(params.tab || '') ? params.tab : 'pets';
  const action = useAction();
  if (!profile || !user) return null;
  const ong = profile.role === 'ong';
  const tabs = [
    { key: 'pets', label: ong ? 'Animais' : 'Adotar', icon: 'paw' as const },
    { key: 'applications', label: ong ? 'Abrigo' : 'Pedidos', icon: 'clipboard-text' as const },
    { key: 'calendar', label: 'Agenda', icon: 'calendar-month' as const },
    { key: 'payments', label: ong ? 'Doações' : 'Doar', icon: 'heart' as const },
    { key: 'history', label: 'Histórico', icon: 'history' as const },
  ];
  const titles: Record<string, string> = { pets: ong ? 'Meus animais' : 'Adotar', applications: ong ? 'Administração' : 'Minhas candidaturas', calendar: 'Agenda', payments: ong ? 'Doações recebidas' : 'Doar', history: 'Meu histórico' };
  const phrases = [`Olá, ${profile.name}!`, ...(ong ? ongPhrases : donorPhrases)];
  return <Screen title={titles[tab!]} subtitle={<Typewriter phrases={phrases} style={[s.headerSubtitle, styles.greeting]} />} right={<View accessibilityLabel={`Conta de ${profile.name}`} style={styles.avatar}><Text style={styles.avatarText}>{profile.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>} footer={<TabBar items={tabs} active={tab!} onChange={key => router.setParams({ tab: key })} />}>
    {usingEmulators && <Text style={styles.testBadge}>Modo de teste</Text>}
    {tab === 'pets' && <PetsPanel />}
    {(tab === 'applications' || tab === 'calendar') && <><ApplicationsPanel calendar={tab === 'calendar'} />{ong && tab === 'applications' && <PaymentsPanel history />}</>}
    {tab === 'payments' && <PaymentsPanel />}
    {tab === 'history' && <><ApplicationsPanel history /><PaymentsPanel history /></>}
    <Feedback message={action.message} /><LinkButton disabled={action.busy} title="Sair da conta" onPress={() => void action.run(logout)} />
  </Screen>;
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
  welcome: { flex: 1, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 },
  logo: { width: 150, height: 130, alignItems: 'center', justifyContent: 'center' },
  logoIcon: { fontSize: 140, lineHeight: 150, color: colors.header },
  logoPaw: { position: 'absolute', fontSize: 40, top: 42 },
  brand: { fontSize: 46, fontWeight: '900', color: colors.white, letterSpacing: 0.5 },
  tagline: { color: colors.mint, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 18 },
  welcomeActions: { width: '100%', maxWidth: 260, gap: 10 },
  welcomeButton: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  welcomeButtonText: { color: colors.green, fontSize: 20, fontWeight: '700' },
  link: { alignSelf: 'flex-end', paddingVertical: 6, minHeight: 32, marginTop: -8 },
  linkText: { color: colors.green, fontWeight: '700' },
  testBadge: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.mint, color: colors.green, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
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
  actions: { width: '100%', maxWidth: 280, alignSelf: 'center', marginTop: 8 },
  footer: { alignSelf: 'center', paddingVertical: 8, minHeight: 40 },
  footerText: { color: colors.muted },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.green, fontWeight: '800', fontSize: 18 },
});
