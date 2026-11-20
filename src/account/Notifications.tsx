import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../backend/session';
import { Application, brasilia, currency, Donation, donationCounts, useRecords } from '../backend/data';
import { colors, styles as s, themedStyles, useTheme } from '../ui';
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Note = { id: string; at: string; icon: Icon; title: string; body: string; tab: string };
// Notificações derivadas do que já existe: andamento de candidaturas e doações.
export function useNotifications() {
  const { user, profile } = useSession();
  const uid = user?.uid ?? null;
  const ong = profile?.role === 'ong';
  const applications = useRecords<Application>('applications', ong ? 'ongId' : 'applicantId', uid);
  const donations = useRecords<Donation>('donations', ong ? 'ongId' : 'donorId', uid);
  const [seen, setSeen] = useState<string | null>(null);
  const key = `apoiapet-notifications-seen-${uid}`;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    AsyncStorage.getItem(key).then(value => { if (active) setSeen(value ?? ''); }).catch(() => { if (active) setSeen(''); });
    return () => { active = false; };
  }, [key, uid]);
  const notes: Note[] = [];
  for (const app of applications.records) (app.history || []).forEach((entry, index) => {
    if (entry.actorId === uid) return;
    notes.push({ id: `${app.id}-${index}`, at: entry.at, icon: 'clipboard-text-outline', title: ong ? `${app.applicantName} · ${app.petName}` : `${app.petName} · ${app.ongName}`, body: entry.message, tab: 'applications' });
  });
  for (const donation of donations.records) if (donationCounts(donation)) notes.push(ong
    ? { id: donation.id, at: donation.createdAt, icon: 'heart-outline', title: 'Nova doação recebida', body: `${donation.donorName} doou ${currency(donation.amountCents)}.`, tab: 'payments' }
    : { id: donation.id, at: donation.createdAt, icon: 'heart-outline', title: 'Doação realizada', body: `${currency(donation.amountCents)} para ${donation.ongName}. Obrigado!`, tab: 'payments' });
  notes.sort((a, b) => b.at.localeCompare(a.at));
  const list = notes.slice(0, 40);
  const unread = seen === null ? 0 : list.filter(note => note.at > seen).length;
  const markRead = () => { const now = new Date().toISOString(); setSeen(now); AsyncStorage.setItem(key, now).catch(() => {}); };
  return { notes: list, unread, seen: seen ?? '', markRead, loading: applications.loading || donations.loading };
}
export function NotificationBell({ unread, onPress }: { unread: number; onPress: () => void }) {
  const n = useNSheet();
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notificações, ${unread} não lidas` : 'Notificações'} onPress={onPress} hitSlop={8} style={n.bell}>
    <MaterialCommunityIcons name="bell-outline" size={22} color={theme.primary} />
    {unread > 0 && <View style={n.badge}><Text style={n.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
  </Pressable>;
}
export function NotificationsPanel({ visible, top, notes, seen, onClose, onOpenTab }: { visible: boolean; top: number; notes: Note[]; seen: string; onClose: () => void; onOpenTab: (tab: string) => void }) {
  const n = useNSheet();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable accessibilityLabel="Fechar notificações" style={n.backdrop} onPress={onClose}>
      <View onStartShouldSetResponder={() => true} style={[n.panel, { top }]}>
        <Text style={n.title}>Notificações</Text>
        {!notes.length && <View style={n.empty}><MaterialCommunityIcons name="bell-sleep-outline" size={30} color={colors.muted} /><Text style={s.muted}>Nada por aqui ainda.</Text></View>}
        <ScrollView style={{ maxHeight: 420 }}>
          {notes.map(note => <Pressable key={note.id} accessibilityRole="button" onPress={() => { onOpenTab(note.tab); onClose(); }} style={({ pressed }) => [n.item, pressed && { opacity: 0.7 }]}>
            <View style={n.icon}><MaterialCommunityIcons name={note.icon} size={18} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={n.itemTitle} numberOfLines={1}>{note.title}</Text>
              <Text style={n.itemBody} numberOfLines={2}>{note.body}</Text>
              <Text style={n.itemDate}>{brasilia(note.at)}</Text>
            </View>
            {note.at > seen && <View style={n.dot} />}
          </Pressable>)}
        </ScrollView>
      </View>
    </Pressable>
  </Modal>;
}
const useNSheet = themedStyles(t => StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#D93025', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  panel: { position: 'absolute', right: 12, left: 12, maxWidth: 380, alignSelf: 'flex-end', marginLeft: 'auto', backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 6, shadowColor: colors.dark, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.dark, paddingHorizontal: 4, paddingBottom: 4 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 34, height: 34, borderRadius: 12, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  itemDate: { fontSize: 11, color: t.primary, fontWeight: '600', marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.primary },
}));
