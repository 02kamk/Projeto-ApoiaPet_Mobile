import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, colors, styles as s, themedStyles, useTheme, useSharedSheet } from '../ui';
import { call, useSession } from '../backend/session';
import { pickPhoto, uploadPhoto } from '../backend/photos';
import { passwordRequirements } from '../../functions/core';
import { Feedback, Input, StoredPhoto, useAction } from './components';
import { useDonorLevel } from './donationLevel';
import { ImpactPanel, OrgCover, OrgForm, OrgInfoCard, OrgSubtitle, Receipts } from './OrgProfile';

type Section = 'menu' | 'edit' | 'org' | 'payments' | 'team' | 'security' | 'help' | 'logout';
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type MenuItem = { key: Exclude<Section, 'menu'>; title: string; icon: Icon; tint: 'tintLight' | 'tintMid' | 'primary' };
const ongMenu: MenuItem[] = [
  { key: 'org', title: 'Dados da instituição', icon: 'office-building-outline', tint: 'primary' },
  { key: 'payments', title: 'Recebimentos', icon: 'cash-multiple', tint: 'primary' },
];
const menu: MenuItem[] = [
  { key: 'edit', title: 'Editar perfil', icon: 'account-outline', tint: 'primary' },
  { key: 'security', title: 'Segurança', icon: 'shield-check-outline', tint: 'primary' },
  { key: 'help', title: 'Ajuda', icon: 'headset', tint: 'primary' },
  { key: 'logout', title: 'Sair', icon: 'logout', tint: 'primary' },
];
const titles: Record<Exclude<Section, 'menu'>, string> = { org: 'Dados da instituição', payments: 'Recebimentos', team: 'Equipe', edit: 'Editar meu perfil', security: 'Segurança', help: 'Ajuda', logout: 'Sair' };

export function ProfilePanel() {
  const p = usePSheet();
  const theme = useTheme();
  const { profile, user } = useSession();
  const [section, setSection] = useState<Section>('menu');
  const donor = useDonorLevel();
  const photo = useAction();
  if (!profile || !user) return null;
  const ong = profile.role === 'ong';
  const items = ong ? [...ongMenu, ...menu.filter(item => item.key !== 'edit')] : menu;
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
  return <View style={{ gap: 20 }}>
    {ong && section === 'menu' && <OrgCover />}
    {(section === 'menu' || section === 'edit') && <View style={[p.identity, ong && section === 'menu' && { marginTop: -72 }]}>
      <View>
        <View accessibilityLabel={donor.donor ? `Nível ${donor.level.name}` : undefined} style={[p.avatar, donor.donor && { borderColor: donor.level.color, borderWidth: 5 }]}>
          {profile.photoPath ? <StoredPhoto path={profile.photoPath} label="Sua foto de perfil" style={p.avatarPhoto} /> : <Text style={p.avatarText}>{initials || '?'}</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={profile.photoPath ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'} disabled={photo.busy} hitSlop={8} style={p.camera} onPress={() => void photo.run(async () => {
          const picked = await pickPhoto();
          if (!picked) return;
          const path = await uploadPhoto(picked, `avatars/${user.uid}`);
          await call('setProfilePhoto', { photoPath: path });
        })}>{photo.busy ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="camera" size={18} color={colors.white} />}</Pressable>
      </View>
      <Text style={p.name}>{profile.name}</Text>
      {ong ? <OrgSubtitle /> : <Text style={s.muted}><Text style={{ fontWeight: '700', color: colors.dark }}>ID: </Text>{user.uid.slice(0, 8).toUpperCase()}</Text>}
      {!!profile.photoPath && section === 'edit' && <Pressable accessibilityRole="button" disabled={photo.busy} onPress={() => void photo.run(() => call('setProfilePhoto', { photoPath: '' }))} hitSlop={6}><Text style={p.removePhoto}>Remover foto</Text></Pressable>}
      <Feedback message={photo.message} />
      {donor.donor && <Text style={[s.label, { color: donor.level.id === 'none' ? colors.muted : donor.level.color }]}>Nível {donor.level.name}</Text>}
    </View>}
    {section !== 'menu' && <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao perfil" onPress={() => setSection('menu')} hitSlop={8} style={p.backRow}>
      <MaterialCommunityIcons name="arrow-left" size={22} color={theme.primary} />
      <Text style={s.subtitle}>{titles[section]}</Text>
    </Pressable>}
    {ong && section === 'menu' && <><ImpactPanel /><OrgInfoCard onEdit={() => setSection('org')} /></>}
    {section === 'menu' && <View style={{ gap: 12 }}>{items.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={() => setSection(item.key)} style={({ pressed }) => [p.item, pressed && { opacity: 0.7 }]}>
      <View style={[p.icon, { backgroundColor: theme[item.tint] }]}><MaterialCommunityIcons name={item.icon} size={22} color={colors.white} /></View>
      <Text style={[p.itemTitle, { flex: 1 }]}>{item.title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.dark} />
    </Pressable>)}</View>}
    {section === 'edit' && <EditProfile onDone={() => setSection('menu')} />}
    {section === 'org' && <OrgForm onDone={() => setSection('menu')} />}
    {section === 'payments' && <Receipts />}

    {section === 'security' && <Security />}
    {section === 'help' && <Help />}
    {section === 'logout' && <Logout onCancel={() => setSection('menu')} />}
  </View>;
}

function EditProfile({ onDone }: { onDone: () => void }) {
  const sh = useSharedSheet();
  const p = usePSheet();
  const { profile, user, saveProfile } = useSession();
  const ong = profile!.role === 'ong';
  const [fullName, setFullName] = useState(profile!.fullName);
  const [ongName, setOngName] = useState(ong ? profile!.name : '');
  const [phone, setPhone] = useState(profile!.phone);
  const [postalCode, setPostalCode] = useState(profile!.cep);
  const action = useAction();
  return <View style={{ gap: 14 }}>
    <Input label={ong ? 'Nome completo do responsável' : 'Nome completo'} value={fullName} onChange={setFullName} />
    {ong && <Input label="Nome público da ONG" value={ongName} onChange={setOngName} />}
    <Input label="Telefone com DDD" numeric value={phone} onChange={value => setPhone(value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
    <Input label="CEP" numeric value={postalCode} onChange={value => setPostalCode(value.replace(/\D/g, '').slice(0, 8))} maxLength={8} />
    <Text style={s.muted}>Ao mudar o CEP, sua cidade e endereço são atualizados automaticamente.</Text>
    <View style={{ gap: 6 }}><Text style={s.label}>E-mail</Text><Text style={[sh.input, { color: colors.muted }]}>{user!.email}</Text></View>
    <Feedback message={action.message} />
    <View style={p.actions}><Button disabled={action.busy} title={action.busy ? 'Salvando…' : 'Atualizar perfil'} onPress={() => void action.run(async () => {
      await saveProfile({ role: profile!.role, fullName, ongName, phone, cep: postalCode });
      onDone();
    })} /></View>
  </View>;
}

function Security() {
  const p = usePSheet();
  const theme = useTheme();
  const { changePassword, reset, user } = useSession();
  const [open, setOpen] = useState<'' | 'password' | 'terms'>('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const action = useAction();
  const requirements = passwordRequirements(next);
  return <View>
    <Row title="Alterar senha" open={open === 'password'} onPress={() => setOpen(open === 'password' ? '' : 'password')} />
    {open === 'password' && <View style={p.expanded}>
      <Input label="Senha atual" password value={current} onChange={setCurrent} maxLength={128} />
      <Input label="Nova senha" password value={next} onChange={setNext} maxLength={128} />
      {['Pelo menos 10 caracteres', 'Uma letra maiúscula (A–Z)', 'Uma letra minúscula (a–z)', 'Um número (0–9)', 'Um caractere especial (!@#$%…)'].map((label, index) => <Text key={label} style={[s.muted, requirements[index] && { color: theme.primary, fontWeight: '700' }]}>{requirements[index] ? '✓' : '○'} {label}</Text>)}
      <Input label="Confirmar nova senha" password value={confirmation} onChange={setConfirmation} maxLength={128} />
      <Feedback message={action.message} />
      <Button disabled={action.busy} title={action.busy ? 'Aguarde…' : 'Salvar nova senha'} onPress={() => void action.run(async () => {
        if (next !== confirmation) throw Error('As senhas não conferem.');
        await changePassword(current, next);
        setCurrent(''); setNext(''); setConfirmation('');
        action.setMessage('Senha alterada com sucesso.');
      })} />
      <Button disabled={action.busy} secondary title="Esqueci minha senha atual" onPress={() => void action.run(async () => { await reset(user!.email || ''); action.setMessage('Enviamos as instruções de redefinição para o seu e-mail.'); })} />
    </View>}
    <Row title="Termos e condições" open={open === 'terms'} onPress={() => setOpen(open === 'terms' ? '' : 'terms')} />
    {open === 'terms' && <View style={p.expanded}>
      <Text style={s.text}>O ApoiaPet conecta adotantes, doadores e ONGs/abrigos. Ao usar o aplicativo, você se compromete a:</Text>
      {['Informar dados verdadeiros no cadastro e nas candidaturas de adoção.', 'Tratar os animais com responsabilidade e respeitar as regras de cada abrigo.', 'Usar os contatos de outros usuários apenas para fins de adoção ou doação.', 'Saber que doações são processadas pelo provedor de pagamento e destinadas à ONG escolhida.'].map(item => <Text key={item} style={s.text}>• {item}</Text>)}
      <Text style={s.muted}>Seus dados pessoais (telefone e endereço completo) ficam em área privada e só são usados para o funcionamento do serviço.</Text>
    </View>}
  </View>;
}

function Help() {
  const p = usePSheet();
  const [open, setOpen] = useState(-1);
  const faq = [
    ['Como adoto um animal?', 'Na aba "Adotar", escolha um animal da sua cidade e envie uma candidatura. A ONG responsável analisa e responde em "Pedidos".'],
    ['Como funciona a retirada?', 'Quando a candidatura é aprovada, a ONG agenda a retirada. Você acompanha data e horário na aba "Agenda".'],
    ['Como faço uma doação?', 'Na aba "Doar", escolha uma ONG e o valor. O pagamento é feito pelo checkout do Mercado Pago, com Pix ou cartão.'],
    ['Posso mudar o tipo da minha conta?', 'Não. Contas de doador/adotante e de ONG são separadas. Crie outra conta com outro e-mail, se necessário.'],
    ['Como altero meus dados?', 'Na aba "Perfil", toque em "Editar perfil" (ou "Dados da instituição", para ONGs) para atualizar seus dados.'],
  ];
  return <View>{faq.map(([question, answer], index) => <View key={question}>
    <Row title={question} open={open === index} onPress={() => setOpen(open === index ? -1 : index)} />
    {open === index && <View style={p.expanded}><Text style={s.text}>{answer}</Text></View>}
  </View>)}</View>;
}

function Logout({ onCancel }: { onCancel: () => void }) {
  const { logout } = useSession();
  const action = useAction();
  return <Card>
    <Text style={[s.subtitle, { textAlign: 'center' }]}>Encerrar sessão</Text>
    <Text style={[s.text, { textAlign: 'center' }]}>Tem certeza de que deseja sair da sua conta?</Text>
    <Feedback message={action.message} />
    <Button disabled={action.busy} title={action.busy ? 'Saindo…' : 'Sim, sair'} onPress={() => void action.run(logout)} />
    <Button disabled={action.busy} secondary title="Cancelar" onPress={onCancel} />
  </Card>;
}

function Row({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) {
  const p = usePSheet();
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={({ pressed }) => [p.row, pressed && { opacity: 0.7 }]}>
    <Text style={[p.itemTitle, { flex: 1 }]}>{title}</Text>
    <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-right'} size={26} color={colors.dark} />
  </Pressable>;
}

const usePSheet = themedStyles(t => StyleSheet.create({
  identity: { alignItems: 'center', gap: 2 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: t.soft, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 38, fontWeight: '800', color: t.primary },
  avatarPhoto: { width: '100%', height: '100%', borderRadius: 52 },
  camera: { position: 'absolute', right: 0, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: t.primary, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  removePhoto: { color: '#B3261E', fontWeight: '700', paddingVertical: 4 },
  name: { fontSize: 24, fontWeight: '800', color: colors.dark, textAlign: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 17, fontWeight: '600', color: colors.dark },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 56 },
  expanded: { paddingVertical: 14, gap: 12 },
  actions: { width: '100%', maxWidth: 280, alignSelf: 'center', marginTop: 8 },
}));
