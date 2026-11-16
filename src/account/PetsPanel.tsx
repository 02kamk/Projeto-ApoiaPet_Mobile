import React, { useState } from 'react';
import { ActivityIndicator, Image, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, styles as s } from '../ui';
import { Listing, petStatus, useRecords } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Photo, pickPhoto, uploadPhoto } from '../backend/photos';
import { Feedback, Input, StoredPhoto, useAction } from './components';
import { emptyHealth, Health, healthForEditing, testOptions, testResults } from '../../functions/health';
import { HealthFields } from './HealthFields';
const blank = { name: '', species: 'Gato', age: '', description: '' };
export function PetsPanel() {
  const { user, profile } = useSession();
  const ong = profile!.role === 'ong';
  const pets = useRecords<Listing>('pets', ong ? 'ongId' : 'listed', ong ? user!.uid : true);
  const [nearby, setNearby] = useState(true);
  const [fields, setFields] = useState(blank);
  const [health, setHealth] = useState<Health>(emptyHealth);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [selected, setSelected] = useState<Listing | null>(null);
  const action = useAction();
  const visible = pets.records.filter(pet => ong || !nearby || pet.cityCode === profile!.cityCode).sort((a, b) => Number(b.cityCode === profile!.cityCode) - Number(a.cityCode === profile!.cityCode));
  return <>
    {ong && <Card><Text style={s.subtitle}>{editing ? `Editar ${editing.name}` : 'Cadastrar animal'}</Text>
      {(['name', 'age', 'description'] as const).map(key => <Input key={key} label={{ name: 'Nome *', age: 'Idade aproximada *', description: 'Descrição e cuidados *' }[key]} value={fields[key]} onChange={value => setFields(current => ({ ...current, [key]: value }))} multiline={key === 'description'} maxLength={key === 'name' ? 120 : key === 'age' ? 80 : 3000} />)}
      <View style={s.row}>{['Gato', 'Cão', 'Outro'].map(species => <Button key={species} disabled={action.busy} title={species} secondary={fields.species !== species} onPress={() => {
        if (species !== fields.species) {
          setFields(current => ({ ...current, species })); setHealth(current => ({ ...emptyHealth(), notes: current.notes }));
          action.setMessage('Espécie alterada. Selecione novamente vacinas e testes para esta espécie.');
        }
      }} />)}</View>
      <HealthFields species={fields.species} value={health} onChange={setHealth} disabled={action.busy} />
      {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Foto selecionada do animal" style={{ width: '100%', height: 220, borderRadius: 14 }} /> : editing?.photoPath ? <StoredPhoto path={editing.photoPath} label={editing.name} /> : null}
      <Button disabled={action.busy} secondary title="Selecionar foto do animal *" onPress={() => void action.run(async () => { const selectedPhoto = await pickPhoto(); if (selectedPhoto) setPhoto(selectedPhoto); })} />
      <Button disabled={action.busy} title={action.busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Publicar animal'} onPress={() => void action.run(async () => {
        if (Object.values(fields).some(value => !value.trim())) throw Error('Preencha todos os campos do animal.');
        const photoPath = photo ? await uploadPhoto(photo, `pets/${user!.uid}`) : editing?.photoPath;
        if (!photoPath) throw Error('Adicione uma foto do animal.');
        await call('savePet', { ...fields, health, photoPath, ...(editing ? { id: editing.id } : {}) });
        setFields(blank); setHealth(emptyHealth()); setPhoto(null); setEditing(null); action.setMessage('Animal salvo.');
      })} />
      {editing && <Button secondary disabled={action.busy} title="Cancelar edição" onPress={() => { setFields(blank); setHealth(emptyHealth()); setPhoto(null); setEditing(null); }} />}
    </Card>}
    {!ong && <><Text style={s.subtitle}>Animais para adoção</Text><View style={s.row}><Switch accessibilityLabel="Mostrar apenas animais da minha cidade" value={nearby} onValueChange={setNearby} /><Text style={[s.text, { flex: 1 }]}>Na minha cidade: {profile!.city} / {profile!.state}</Text></View><Text style={s.muted}>O CEP identifica o município. Este filtro não calcula distância em quilômetros. Desative para ver todo o Brasil.</Text></>}
    <Feedback message={pets.error || action.message} />{pets.loading && <ActivityIndicator accessibilityLabel="Carregando animais" />}
    {!pets.loading && !pets.error && !visible.length && <Card><Text style={s.text}>{ong ? 'Você ainda não cadastrou animais.' : 'Nenhum animal nesta busca. Experimente ver outras cidades.'}</Text></Card>}
    {visible.map(pet => <Card key={pet.id}><StoredPhoto path={pet.photoPath} label={`Foto de ${pet.name}`} /><Text style={s.subtitle}>{pet.name}</Text><Text style={s.notice}>{petStatus[pet.status]}</Text><Text style={s.muted}>{pet.species} · {pet.age} · {pet.city} / {pet.state}</Text><Text style={s.text}>{pet.description}</Text><Text style={s.label}>Vacinas realizadas</Text><Text style={s.text}>{pet.vaccinesDone}</Text><Text style={s.label}>Vacinas necessárias</Text><Text style={s.text}>{pet.vaccinesNeeded}</Text><Text style={s.muted}>{pet.ongName}</Text>
      <Text style={s.label}>Testes realizados</Text>{pet.health?.tests.length ? pet.health.tests.map(test => <Text key={test.id} style={s.text}>{testOptions[pet.species]?.find(option => option.id === test.id)?.label || test.id}: {testResults[test.result] || 'Não informado'}</Text>) : <Text style={s.muted}>Nenhum teste registrado.</Text>}
      {!!pet.health?.notes && <><Text style={s.label}>Observações de saúde</Text><Text style={s.text}>{pet.health.notes}</Text></>}
      {ong ? <><Button disabled={action.busy} secondary title="Editar informações e foto" onPress={() => { setEditing(pet); setFields({ name: pet.name, species: pet.species, age: pet.age, description: pet.description }); setHealth(healthForEditing(pet)); setPhoto(null); }} />{['available', 'paused'].includes(pet.status) && <Button disabled={action.busy} secondary title={pet.status === 'available' ? 'Pausar divulgação' : 'Reativar divulgação'} onPress={() => void action.run(() => call('togglePet', { petId: pet.id }))} />}</> : pet.status === 'available' ? <Button title="Quero me candidatar" onPress={() => setSelected(pet)} /> : <Text style={s.muted}>Este animal já tem retirada em andamento. Novas candidaturas estão suspensas.</Text>}
      {selected?.id === pet.id && <ApplicationForm pet={pet} onClose={() => setSelected(null)} />}
    </Card>)}
  </>;
}
function ApplicationForm({ pet, onClose }: { pet: Listing; onClose: () => void }) {
  const { user } = useSession();
  const [housing, setHousing] = useState('Casa');
  const [safety, setSafety] = useState('');
  const [routine, setRoutine] = useState('');
  const [motivation, setMotivation] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [consent, setConsent] = useState(false);
  const action = useAction();
  return <><Text style={s.subtitle}>Candidatura para {pet.name}</Text><Text style={s.muted}>A ONG {pet.ongName} analisará as informações e as fotos. O envio não garante aprovação.</Text><View style={s.row}>{['Casa', 'Apartamento', 'Outro'].map(value => <Button key={value} title={value} secondary={housing !== value} onPress={() => setHousing(value)} />)}</View><Input label={housing === 'Apartamento' ? 'Descreva as telas/grades nas janelas, varanda e a proteção das saídas *' : 'Como o ambiente e as saídas estão protegidos? *'} value={safety} onChange={setSafety} multiline maxLength={2000} /><Input label="Rotina e responsável pelos cuidados *" value={routine} onChange={setRoutine} multiline maxLength={2000} /><Input label="Por que deseja adotar este animal? *" value={motivation} onChange={setMotivation} multiline maxLength={2000} />
    <Text style={s.label}>Fotos do ambiente (1 a 6) *</Text><Text style={s.muted}>Mostre o espaço de descanso, janelas, varanda e proteções. A avaliação é feita por uma pessoa da ONG. Não há aprovação automática por foto.</Text>
    {photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={{ gap: 8 }}><Image source={{ uri: photo.uri }} accessibilityLabel={`Foto do ambiente ${index + 1}`} style={{ width: '100%', height: 180, borderRadius: 12 }} /><Button disabled={action.busy} secondary title={`Remover foto ${index + 1}`} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} /></View>)}
    <Button disabled={action.busy || photos.length >= 6} secondary title="Adicionar foto do ambiente" onPress={() => void action.run(async () => { const photo = await pickPhoto(); if (photo) setPhotos(current => [...current, photo]); })} />
    <View style={s.row}><Switch accessibilityLabel="Autorizo compartilhar meus dados e fotos com esta ONG para análise da candidatura" value={consent} onValueChange={setConsent} /><Text style={[s.text, { flex: 1 }]}>Autorizo compartilhar meus dados de cadastro e estas fotos com esta ONG para a análise da candidatura.</Text></View><Feedback message={action.message} />
    <Button disabled={action.busy} title={action.busy ? 'Enviando…' : 'Enviar candidatura à ONG'} onPress={() => void action.run(async () => {
      if (!consent || !photos.length || !safety.trim() || !routine.trim() || !motivation.trim()) throw Error('Preencha todos os campos, adicione fotos e autorize o compartilhamento.');
      const id = `${pet.id}_${user!.uid}`;
      const photoPaths = [];
      for (const photo of photos) photoPaths.push(await uploadPhoto(photo, `homes/${user!.uid}/${id}`));
      await call('submitApplication', { petId: pet.id, housing, safety, routine, motivation, photoPaths, consent });
      onClose(); router.setParams({ tab: 'applications' });
    })} /><Button disabled={action.busy} secondary title="Cancelar preenchimento" onPress={onClose} />
  </>;
}
