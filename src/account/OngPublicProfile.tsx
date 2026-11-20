import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../backend/firebase';
import { Listing, Organization, useRecords } from '../backend/data';
import { Button, colors, styles as s, themedStyles, useTheme } from '../ui';
import { StoredPhoto } from './components';
import { formatCnpj } from './OrgProfile';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Perfil público da ONG (o que ela preencheu em "Dados da instituição"). A equipe é interna e não aparece aqui.
export function OngPublicProfile({ ongId, onClose, onDonate }: { ongId: string; onClose: () => void; onDonate?: (ongId: string) => void }) {
  const st = useSheet();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [ong, setOng] = useState<Organization | null | undefined>(undefined);
  const pets = useRecords<Listing>('pets', 'listed', true);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'profiles', ongId), snapshot => setOng(snapshot.exists() && snapshot.data().role === 'ong' ? { ...(snapshot.data() as Organization), id: snapshot.id } : null), () => setOng(null));
  }, [ongId]);
  const org = ong?.org ?? {};
  const animals = pets.records.filter(pet => pet.ongId === ongId && pet.status === 'available');
  const initials = (ong?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
  const lines = ([
    org.foundedYear ? ['calendar-star', `Fundada em ${org.foundedYear}`] : null,
    ong ? ['map-marker-outline', org.address ? `${org.address} · ${ong.city} / ${ong.state}` : `${ong.city} / ${ong.state}`] : null,
    org.hours ? ['clock-outline', org.hours] : null,
  ].filter(Boolean)) as [Icon, string][];
  const contacts = ([
    org.whatsapp ? ['whatsapp', 'WhatsApp', `https://wa.me/55${org.whatsapp}`] : null,
    org.publicEmail ? ['email-outline', 'E-mail', `mailto:${org.publicEmail}`] : null,
    org.instagram ? ['instagram', 'Instagram', `https://instagram.com/${org.instagram}`] : null,
    org.website ? ['web', 'Site', org.website] : null,
  ].filter(Boolean)) as [Icon, string, string][];
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[st.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
      <View style={st.cover}>
        {ong?.coverPath ? <StoredPhoto path={ong.coverPath} label={`Capa de ${ong.name}`} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.headerDeep }]} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onClose} hitSlop={8} style={st.back}><MaterialCommunityIcons name="chevron-left" size={28} color={colors.white} /></Pressable>
      </View>
      {ong === undefined && <ActivityIndicator accessibilityLabel="Carregando ONG" />}
      {ong === null && <Text style={[s.muted, { textAlign: 'center' }]}>Não foi possível carregar esta ONG.</Text>}
      {ong && <>
        <View style={st.identity}>
          <View style={[st.logo, { backgroundColor: theme.soft }]}>{ong.photoPath ? <StoredPhoto path={ong.photoPath} label={`Logo de ${ong.name}`} style={st.logoPhoto} /> : <Text style={[st.logoText, { color: theme.primary }]}>{initials || '?'}</Text>}</View>
          <Text style={st.name}>{ong.name}</Text>
          {(!!org.legalName || !!org.cnpj) && <Text style={[s.muted, { textAlign: 'center' }]}>{[org.legalName, org.cnpj && `CNPJ ${formatCnpj(org.cnpj)}`].filter(Boolean).join(' · ')}</Text>}
        </View>
        {onDonate && <Button title={`Doar para ${ong.name}`} onPress={() => onDonate(ong.id)} />}
        <View style={st.card}>
          <Text style={st.title}>Sobre</Text>
          {org.about ? <Text style={st.about}>{org.about}</Text> : <Text style={s.muted}>A ONG ainda não escreveu sobre ela.</Text>}
          {lines.map(([icon, text]) => <View key={text} style={st.line}><MaterialCommunityIcons name={icon} size={18} color={theme.primary} /><Text style={st.lineText}>{text}</Text></View>)}
          {contacts.length > 0 && <View style={st.contacts}>{contacts.map(([icon, label, url]) => <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} style={({ pressed }) => [st.contact, { backgroundColor: theme.primary }, pressed && { opacity: 0.8 }]}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.white} />
          </Pressable>)}</View>}
        </View>
        <View style={st.card}>
          <Text style={st.title}>Animais para adoção <Text style={s.muted}>· {animals.length}</Text></Text>
          {animals.length === 0 ? <Text style={s.muted}>Nenhum animal disponível no momento.</Text>
            : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{animals.map(pet => <View key={pet.id} style={st.pet}>
              <StoredPhoto path={pet.photoPath} label={`Foto de ${pet.name}`} style={st.petPhoto} />
              <Text style={st.petName} numberOfLines={1}>{pet.name}</Text>
              <Text style={st.petAge} numberOfLines={1}>{pet.age}</Text>
            </View>)}</ScrollView>}
        </View>
      </>}
    </ScrollView>
  </Modal>;
}

const useSheet = themedStyles(t => StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 650, alignSelf: 'center' },
  cover: { height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: t.soft },
  back: { position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', marginTop: -62, gap: 2 },
  logo: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  logoPhoto: { width: '100%', height: '100%', borderRadius: 50 },
  logoText: { fontSize: 34, fontWeight: '800' },
  name: { fontSize: 24, fontWeight: '800', color: colors.dark, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: t.soft },
  title: { fontSize: 17, fontWeight: '800', color: colors.dark },
  about: { fontSize: 15, lineHeight: 22, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineText: { flex: 1, fontSize: 14, color: colors.text },
  contacts: { flexDirection: 'row', gap: 10, marginTop: 4 },
  contact: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pet: { width: 96, gap: 2 },
  petPhoto: { width: 96, height: 96, borderRadius: 16 },
  petName: { fontSize: 14, fontWeight: '700', color: colors.dark, marginTop: 4 },
  petAge: { fontSize: 12, color: colors.muted },
}));
