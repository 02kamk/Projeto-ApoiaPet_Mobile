import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, colors, styles as s } from '../ui';
import { DonationMethod, money, parseAmount, places } from './domain';
import { useDonations } from './context';
import { useDemoPets } from '../DemoScreen';
import { adoptionCatalog, petSpeciesLabel } from '../domain';
type Stage = 'places' | 'details' | 'checkout' | 'payment' | 'receipt' | 'history';
export default function DonationsScreen() {
  const { records, create, finish } = useDonations();
  const pets = adoptionCatalog(useDemoPets());
  const [stage, setStage] = useState<Stage>('places');
  const [placeId, setPlaceId] = useState(places[0].id);
  const [purpose, setPurpose] = useState(places[0].needs[0]);
  const [amount, setAmount] = useState('25');
  const [method, setMethod] = useState<DonationMethod>('Pix');
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const place = places.find(p => p.id === placeId)!;
  const active = records.find(d => d.id === activeId);
  const navigate = (next: Stage) => { setError(''); setStage(next); };
  const start = () => {
    if (submitting.current) return;
    try {
      submitting.current = true;
      const donation = create(placeId, purpose, amount, method);
      setActiveId(donation.id); navigate('payment');
    } catch (e) { setError(e instanceof Error ? e.message : 'Confira os dados.'); }
    finally { submitting.current = false; }
  };
  const back = () => {
    if (stage === 'places') { router.replace('/home'); return; }
    if (stage === 'payment' && active?.status === 'Aguardando simulação') { navigate('history'); return; }
    navigate(stage === 'checkout' ? 'details' : stage === 'details' ? 'places' : 'places');
  };
  return <View style={s.page}><StatusBar style="dark" /><ScrollView contentContainerStyle={[s.content, { paddingTop: 56, paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>♥ ApoiaPet</Text>
    <View style={s.row}><Button secondary title="Adoção" onPress={() => router.replace('/catalog')} /><Button title="Doações" onPress={() => navigate('places')} /><Button secondary title="Meu histórico" onPress={() => navigate('history')} /></View>
    <Text style={s.notice}>Demonstração local: os locais são fictícios e nenhum pagamento é realizado. O histórico desaparece ao recarregar.</Text>
    <Button secondary title="← Voltar" onPress={back} />
    {!!error && <Text accessibilityRole="alert" style={[s.notice, { color: '#9B2525' }]}>{error}</Text>}
    {stage === 'places' && <>
      <Text style={s.title}>Um prato cheio de carinho.</Text>
      <Text style={s.text}>Apoie a alimentação de animais de rua e dos pets acolhidos por locais de resgate.</Text>
      <Card><Text style={s.subtitle}>Como ajudar</Text><Text style={s.text}>Escolha um local, uma necessidade e o valor da sua contribuição. Depois, selecione Pix ou cartão.</Text></Card>
      {pets.length > 0 && <Card><Text style={s.subtitle}>Conheça os animais cadastrados</Text><Text style={s.muted}>Pets desta demonstração. A contribuição será destinada ao local que você escolher abaixo.</Text>{pets.map(pet => <Text key={pet.id} style={s.text}>{pet.name} · {petSpeciesLabel(pet)}</Text>)}</Card>}
      {places.map(p => <Card key={p.id}><Text style={d.tag}>LOCAL DEMONSTRATIVO</Text><Text style={s.subtitle}>🐾 {p.name}</Text><Text style={s.text}>{p.description}</Text><Text style={s.muted}>Acolhimento: {p.audience}</Text><Text style={s.label}>Necessidades de alimentação</Text><Text style={s.text}>{p.needs.join(' · ')}</Text><Button title="Quero ajudar com alimentação" onPress={() => { setPlaceId(p.id); setPurpose(p.needs[0]); setAmount('25'); setMethod('Pix'); navigate('details'); }} /></Card>)}
    </>}
    {stage === 'details' && <>
      <Text style={s.subtitle}>{place.name}</Text><Text style={s.text}>{place.description}</Text>
      <Card><Text style={s.subtitle}>O que você deseja apoiar?</Text>{place.needs.map(item => <Choice key={item} label={item} selected={purpose === item} onPress={() => setPurpose(item)} />)}</Card>
      <Card><Text style={s.subtitle}>Escolha sua contribuição</Text><Text style={s.muted}>Contribuição em dinheiro destinada à alimentação. Não é compra ou entrega de ração.</Text><View style={s.row}>{['10', '25', '50', '100'].map(v => <Button key={v} title={money(Number(v) * 100)} secondary={amount !== v} onPress={() => setAmount(v)} />)}</View><Text style={s.label}>Outro valor (R$)</Text><TextInput accessibilityLabel="Valor da doação em reais" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={9} style={s.input} placeholder="Ex.: 25,50" /><Text style={s.muted}>Valor demonstrativo entre R$ 1,00 e R$ 10.000,00.</Text></Card>
      <Button title="Escolher forma de pagamento" onPress={() => { try { parseAmount(amount); navigate('checkout'); } catch (e) { setError((e as Error).message); } }} />
    </>}
    {stage === 'checkout' && <>
      <Text style={s.subtitle}>Revise sua contribuição</Text><Card><Text style={s.label}>Local escolhido</Text><Text style={s.text}>{place.name}</Text><Text style={s.label}>Destinação</Text><Text style={s.text}>{purpose}</Text><Text style={s.subtitle}>{money(parseAmount(amount))}</Text><Text style={s.muted}>Contribuição única. Nenhuma cobrança recorrente.</Text></Card>
      <Text style={s.subtitle}>Como você prefere contribuir?</Text><Choice label="Pix" detail="Simule a confirmação de uma contribuição por Pix." selected={method === 'Pix'} onPress={() => setMethod('Pix')} /><Choice label="Cartão de crédito" detail="Use o cartão demonstrativo, sem informar dados reais." selected={method === 'Cartão'} onPress={() => setMethod('Cartão')} />
      <Button title={method === 'Pix' ? 'Continuar com Pix (demonstração)' : 'Continuar com cartão (demonstração)'} onPress={start} />
    </>}
    {stage === 'payment' && active && <>
      <Text style={s.subtitle}>{active.method === 'Pix' ? 'Contribuir com Pix' : 'Contribuir com cartão'}</Text><Summary id={active.id} />
      {active.status === 'Aguardando simulação' ? <>
        {active.method === 'Pix' ? <Card><Text style={s.subtitle}>Pix demonstrativo</Text><Text style={s.text}>No pagamento real, este espaço exibirá o QR Code e o código Pix fornecidos pelo serviço de pagamentos.</Text><View style={d.placeholder}><Text style={d.symbol}>◇</Text><Text style={s.label}>Nenhum Pix gerado</Text><Text style={s.muted}>Não há chave ou código para pagar nesta demonstração.</Text></View><Text style={s.muted}>Experimente o próximo passo pelo botão de simulação abaixo.</Text></Card> : <Card><Text style={s.subtitle}>Cartão demonstrativo</Text><View style={d.bankCard}><Text style={d.bankText}>APOIAPET · DEMONSTRAÇÃO</Text><Text style={[d.bankText, { fontSize: 25 }]}>••••  ••••  ••••  0000</Text><Text style={d.bankText}>PESSOA DEMONSTRATIVA</Text><Text style={d.bankText}>Sem cobrança · pagamento único</Text></View><Text style={s.muted}>Não é necessário informar número, validade ou código de segurança. Na versão integrada, os dados serão solicitados pelo serviço de pagamentos.</Text></Card>}
        <Button title="Simular pagamento aprovado" onPress={() => { finish(active.id, 'confirm'); navigate('receipt'); }} />
        <Button secondary title="Cancelar esta contribuição" onPress={() => { finish(active.id, 'cancel'); navigate('history'); }} />
      </> : <Button title="Ver resultado" onPress={() => navigate('receipt')} />}
    </>}
    {stage === 'receipt' && active && <>
      <Text style={s.title}>{active.status === 'Confirmada (simulação)' ? 'Obrigada por apoiar! ♥' : 'Contribuição cancelada'}</Text><Text style={s.text}>Você percorreu o fluxo de apoio à alimentação dos animais.</Text><Summary id={active.id} /><Text style={s.notice}>Registro de demonstração. Não é comprovante financeiro: nenhum valor foi cobrado ou transferido.</Text><Button title="Ver minhas contribuições" onPress={() => navigate('history')} /><Button secondary title="Apoiar outro local" onPress={() => navigate('places')} />
    </>}
    {stage === 'history' && <>
      <Text style={s.subtitle}>Minhas contribuições</Text><Text style={s.muted}>Registros desta sessão de demonstração.</Text>
      {records.length === 0 && <Card><Text style={s.text}>Você ainda não fez uma contribuição.</Text><Button title="Conhecer locais para apoiar" onPress={() => navigate('places')} /></Card>}
      {records.map(record => <Card key={record.id}><Text style={s.subtitle}>{record.placeName}</Text><Text style={s.text}>{record.purpose}</Text><Text style={s.subtitle}>{money(record.amountCents)}</Text><Text style={s.muted}>{record.method} · {record.status}</Text><Text style={s.muted}>{new Date(record.createdAt).toLocaleString('pt-BR')}</Text><Button secondary title={record.status === 'Aguardando simulação' ? 'Continuar contribuição' : 'Ver registro'} onPress={() => { setActiveId(record.id); navigate(record.status === 'Aguardando simulação' ? 'payment' : 'receipt'); }} /></Card>)}
    </>}
    <Button secondary title="Ir ao início" onPress={() => router.replace('/home')} />
  </ScrollView></View>;
}
function Choice({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[d.choice, selected && d.selected]}><Text style={s.label}>{selected ? '●' : '○'} {label}</Text>{detail && <Text style={s.muted}>{detail}</Text>}</Pressable>;
}
function Summary({ id }: { id: string }) {
  const { records } = useDonations(); const record = records.find(r => r.id === id);
  if (!record) return null;
  return <Card><Text style={s.text}>{record.placeName}</Text><Text style={s.text}>{record.purpose}</Text><Text style={s.subtitle}>{money(record.amountCents)}</Text><Text style={s.muted}>{record.method} · {record.status}</Text><Text selectable style={s.muted}>Registro local: {record.id}</Text></Card>;
}
const d = StyleSheet.create({ tag: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'white', borderRadius: 14, padding: 18, gap: 8, minHeight: 56 }, selected: { borderColor: colors.green, backgroundColor: colors.mint }, placeholder: { backgroundColor: colors.bg, padding: 24, borderRadius: 16, alignItems: 'center', gap: 10 }, symbol: { fontSize: 54, color: colors.green }, bankCard: { backgroundColor: colors.dark, borderRadius: 18, padding: 24, gap: 22 }, bankText: { color: 'white', fontWeight: '600', letterSpacing: 1 } });
