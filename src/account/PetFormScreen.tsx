import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Button, Card, LinkButton, Screen, Segment, styles as s } from '../ui';
import { db, errorMessage } from '../backend/firebase';
import { Listing } from '../backend/data';
import { call, useSession } from '../backend/session';
import { Photo, pickPhoto, uploadPhoto } from '../backend/photos';
import { Feedback, Input, StoredPhoto, useAction } from './components';
import { emptyHealth, Health, healthForEditing } from '../../functions/health';
import { HealthFields } from './HealthFields';
const blank = { name: '', species: 'Gato', age: '', description: '' };
function leave() { if (router.canGoBack()) router.back(); else router.replace('/?tab=pets'); }
export default function PetFormScreen() {
  const { user, profile, loading } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [editing, setEditing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState('');
  const [fields, setFields] = useState(blank);
  const [health, setHealth] = useState<Health>(emptyHealth);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const action = useAction();
  const uid = user?.uid;
  useEffect(() => {
    if (!id || !db || !uid) return;
    let active = true;
    getDoc(doc(db, 'pets', id)).then(snapshot => {
      if (!active) return;
      const pet = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Listing : null;
      if (!pet || pet.ongId !== uid) { setLoadError('Animal não encontrado nesta ONG.'); return; }
      setEditing(pet);
      setFields({ name: pet.name, species: pet.species, age: pet.age, description: pet.description });
      setHealth(healthForEditing(pet));
    }).catch(error => { if (active) setLoadError(errorMessage(error)); });
    return () => { active = false; };
  }, [id, uid]);
  if (loading) return <View style={[s.page, { justifyContent: 'center' }]}><ActivityIndicator accessibilityLabel="Carregando conta" /></View>;
  if (!user || profile?.role !== 'ong') return <Redirect href="/" />;
  const waiting = !!id && !editing && !loadError;
  return <Screen title={id ? (editing ? `Editar ${editing.name}` : 'Editar animal') : 'Novo animal'} onBack={action.busy ? undefined : leave}>
    {waiting && <ActivityIndicator accessibilityLabel="Carregando animal" />}
    {!!loadError && <Feedback message={loadError} />}
    {!waiting && !loadError && <Card>
      {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Foto selecionada do animal" style={{ width: '100%', height: 240, borderRadius: 18 }} /> : editing?.photoPath ? <StoredPhoto path={editing.photoPath} label={editing.name} /> : null}
      <Button disabled={action.busy} secondary title={photo || editing?.photoPath ? 'Trocar foto' : '+ Adicionar foto'} onPress={() => void action.run(async () => { const selectedPhoto = await pickPhoto(); if (selectedPhoto) setPhoto(selectedPhoto); })} />
      <Segment disabled={action.busy} options={['Gato', 'Cão', 'Outro']} value={fields.species} onChange={species => {
        if (species !== fields.species) {
          setFields(current => ({ ...current, species })); setHealth(current => ({ ...emptyHealth(), notes: current.notes }));
          action.setMessage('Espécie alterada: marque de novo vacinas e testes.');
        }
      }} />
      <Input label="Nome" placeholder="Mel" value={fields.name} onChange={value => setFields(current => ({ ...current, name: value }))} maxLength={120} />
      <Input label="Idade" placeholder="2 anos" value={fields.age} onChange={value => setFields(current => ({ ...current, age: value }))} maxLength={80} />
      <Input label="Sobre" placeholder="Temperamento e cuidados" value={fields.description} onChange={value => setFields(current => ({ ...current, description: value }))} multiline maxLength={3000} />
      <HealthFields species={fields.species} value={health} onChange={setHealth} disabled={action.busy} />
      <Feedback message={action.message} />
      <Button disabled={action.busy} title={action.busy ? 'Salvando…' : editing ? 'Salvar' : 'Publicar'} onPress={() => void action.run(async () => {
        if (Object.values(fields).some(value => !value.trim())) throw Error('Preencha nome, idade e descrição.');
        const photoPath = photo ? await uploadPhoto(photo, `pets/${user.uid}`) : editing?.photoPath;
        if (!photoPath) throw Error('Adicione uma foto do animal.');
        await call('savePet', { ...fields, health, photoPath, ...(editing ? { id: editing.id } : {}) });
        leave();
      })} />
    </Card>}
    <LinkButton disabled={action.busy} title="Cancelar" onPress={leave} />
  </Screen>;
}
