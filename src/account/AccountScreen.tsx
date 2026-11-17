import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Card, styles as s } from '../ui';
import { firebaseConfigured, usingEmulators } from '../backend/firebase';
import { Role, useSession, ProfileInput } from '../backend/session';
import { cep, passwordRequirements } from '../../functions/core';
import { Feedback, Input, useAction } from './components';
import { PetsPanel } from './PetsPanel';
import { ApplicationsPanel } from './ApplicationsPanel';
import { PaymentsPanel } from './PaymentsPanel';
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
  const action = useAction();
  const completing = !!session.user;
  const form = registering || completing;
  const requirements = passwordRequirements(password);
  return <View style={s.page}><ScrollView contentContainerStyle={[s.content, { paddingTop: 56, paddingBottom: 50 }]} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>♥ ApoiaPet</Text><Text style={s.subtitle}>Um novo começo para cada patinha.</Text><Text style={s.text}>Encontre animais na sua cidade ou ajude abrigos de todo o Brasil.</Text>
    {usingEmulators && <Text style={s.notice}>Ambiente local de teste · contas, fotos e registros ficam neste computador. Pagamentos são simulados.</Text>}
    {!firebaseConfigured && <Text style={s.notice}>O serviço de contas ainda não foi ativado. O cadastro ficará disponível assim que a configuração for concluída.</Text>}
    <Card><Text style={s.subtitle}>{completing ? 'Complete seu cadastro' : registering ? 'Criar minha conta' : 'Entrar'}</Text>
      {form && <><Text style={s.label}>Quero participar como</Text><View style={s.row}><Button disabled={action.busy} title="Doador / adotante" secondary={role !== 'donor'} onPress={() => setRole('donor')} /><Button disabled={action.busy} title="ONG / abrigo" secondary={role !== 'ong'} onPress={() => setRole('ong')} /></View>
        <Input label={role === 'ong' ? 'Nome completo do responsável *' : 'Nome completo *'} value={fullName} onChange={setFullName} />
        {role === 'ong' && <Input label="Nome público da ONG *" value={ongName} onChange={setOngName} />}
        <Input label="Telefone com DDD *" numeric value={phone} onChange={value => setPhone(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} /><Text style={s.muted}>Fixo: 10 números. Celular: 11 números, incluindo DDD e o 9 inicial. Ex.: 11987654321.</Text>
        <Input label="CEP *" numeric value={postalCode} onChange={value => { setPostalCode(value.replace(/\D/g, '').slice(0, 8)); setLocation(null); }} maxLength={8} />
        <Button disabled={action.busy} secondary title="Buscar endereço pelo CEP" onPress={() => void action.run(async () => {
          const code = cep(postalCode);
          const response = await fetch(`https://viacep.com.br/ws/${code}/json/`, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw Error('Não foi possível consultar o CEP. Tente novamente.');
          const data = await response.json();
          if (data.erro || !data.localidade) throw Error('CEP não encontrado.');
          setLocation({ cep: code, city: data.localidade, state: data.uf, street: data.logradouro || '', neighborhood: data.bairro || '' });
        })} />
        {location && <Text style={s.notice}>{location.street}{location.neighborhood ? ` · ${location.neighborhood}` : ''}{'\n'}{location.city} / {location.state}</Text>}
        <Text style={s.muted}>A consulta envia apenas seu CEP ao ViaCEP. Para adoção, mostraremos primeiro sua cidade; para contribuições, todas as ONGs.</Text>
      </>}
      {!completing && <><Input label="E-mail *" email value={email} onChange={setEmail} maxLength={254} /><Input label="Senha *" password value={password} onChange={setPassword} maxLength={128} />
        {registering && <><Text style={s.label}>Sua senha precisa ter:</Text>{['Pelo menos 10 caracteres', 'Uma letra maiúscula (A–Z)', 'Uma letra minúscula (a–z)', 'Um número (0–9)', 'Um caractere especial (!@#$%…)'].map((label, index) => <Text key={label} style={[s.muted, requirements[index] && { color: '#176B50', fontWeight: '700' }]}>{requirements[index] ? '✓' : '○'} {label}</Text>)}<Input label="Confirmar senha *" password value={confirmation} onChange={setConfirmation} maxLength={128} /></>}
      </>}
      <Feedback message={action.message || session.error} />
      <Button disabled={action.busy || !firebaseConfigured} title={action.busy ? 'Aguarde…' : completing ? 'Concluir cadastro' : registering ? 'Criar conta' : 'Entrar'} onPress={() => void action.run(async () => {
        const profile: ProfileInput = { role, fullName, ongName, phone, cep: postalCode };
        if (form && (!location || location.cep !== postalCode)) throw Error('Busque e confira seu endereço pelo CEP.');
        if (completing) await session.saveProfile(profile);
        else if (registering) {
          if (password !== confirmation) throw Error('As senhas não conferem.');
          await session.register(email, password, profile);
        } else await session.login(email, password);
        setPassword(''); setConfirmation('');
      })} />
      {!completing ? <><Button disabled={action.busy} secondary title={registering ? 'Já tenho conta' : 'Criar minha conta'} onPress={() => { setRegistering(!registering); action.setMessage(''); setPassword(''); setConfirmation(''); }} /><Button disabled={action.busy || !firebaseConfigured} secondary title="Esqueci minha senha" onPress={() => void action.run(async () => { await session.reset(email); action.setMessage('Se houver uma conta elegível, você receberá as instruções no e-mail informado.'); })} /></> : <Button secondary title="Sair da conta" onPress={() => void action.run(session.logout)} />}
    </Card>
  </ScrollView></View>;
}
function Dashboard() {
  const { profile, logout, user } = useSession();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = ['pets', 'applications', 'calendar', 'payments', 'history'].includes(params.tab || '') ? params.tab : 'pets';
  const action = useAction();
  if (!profile || !user) return null;
  const ong = profile.role === 'ong';
  const tabs = [['pets', ong ? 'Meus animais' : 'Adotar'], ['applications', ong ? 'Administração do abrigo' : 'Minhas candidaturas'], ['calendar', 'Agenda de retiradas'], ['payments', ong ? 'Doações recebidas' : 'Doar'], ['history', 'Meu histórico']];
  return <View style={s.page}><ScrollView contentContainerStyle={[s.content, { paddingTop: 56, paddingBottom: 50 }]} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>♥ ApoiaPet</Text><Text style={s.subtitle}>Olá, {profile.name}</Text><Text style={s.muted}>{ong ? 'Área da ONG · cadastro autodeclarado' : 'Doador / adotante'} · {profile.city} / {profile.state}</Text>
    {usingEmulators && <Text style={s.notice}>Ambiente local de teste · dados separados do Firebase na nuvem.</Text>}
    <View style={s.row}>{tabs.map(([key, title]) => <Button key={key} title={title} secondary={tab !== key} onPress={() => router.setParams({ tab: key })} />)}</View>
    {tab === 'pets' && <PetsPanel />}
    {(tab === 'applications' || tab === 'calendar') && <><ApplicationsPanel calendar={tab === 'calendar'} />{ong && tab === 'applications' && <PaymentsPanel history />}</>}
    {tab === 'payments' && <PaymentsPanel />}
    {tab === 'history' && <><Text style={s.title}>Meu histórico</Text><Text style={s.muted}>Registros associados à sua conta, inclusive após sair ou recarregar.</Text><ApplicationsPanel history /><PaymentsPanel history /></>}
    <Feedback message={action.message} /><Button disabled={action.busy} secondary title="Sair da conta" onPress={() => void action.run(logout)} />
  </ScrollView></View>;
}
