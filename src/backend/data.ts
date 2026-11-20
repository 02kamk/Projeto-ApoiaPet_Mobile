import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, errorMessage } from './firebase';
import { Profile } from './session';
import type { Health } from '../../backend/lib/health';
export { money as currency, parseAmount, donationCounts } from '../donations/domain';
export type Listing = { id: string; ongId: string; ongName: string; name: string; species: string; age: string; description: string; city: string; state: string; cityCode: string; photoPath: string; vaccinesDone: string; vaccinesNeeded: string; health?: Health; status: 'available' | 'in_process' | 'adopted' | 'paused'; listed: boolean; createdAt?: string; updatedAt?: string; caretaker?: string };
export type Organization = Profile & { id: string };
export type Donation = { id: string; donorId: string; donorName: string; ongId: string; ongName: string; amountCents: number; mode: 'test' | 'mercadopago'; method?: string; status: string; createdAt: string; checkoutUrl: string };
export type Application = { id: string; petId: string; petName: string; ongId: string; ongName: string; applicantId: string; applicantName: string; phone: string; city: string; state: string; answers: { housing: string; safety: string; routine: string; motivation: string }; photoPaths: string[]; status: string; createdAt: string; updatedAt: string; pickupAt: string | null; pickupPlace: string; history: { at: string; message: string; actorId: string }[] };
export type Message = { id: string; senderId: string; senderName: string; body: string; createdAt: string };
export function useRecords<T extends { id: string }>(path: string, field: string, value: string | boolean | null) {
  const key = JSON.stringify([path, field, value]);
  const [snapshot, setSnapshot] = useState<{ key: string; records: T[]; error: string } | null>(null);
  useEffect(() => {
    if (!db || value === null) return;
    let active = true;
    const source = field ? query(collection(db, path), where(field, '==', value)) : collection(db, path);
    const stop = onSnapshot(source, next => {
      if (active) setSnapshot({ key, records: next.docs.map(item => ({ ...item.data(), id: item.id }) as T), error: '' });
    }, failure => { if (active) setSnapshot({ key, records: [], error: errorMessage(failure) }); });
    return () => { active = false; stop(); };
  }, [path, field, value, key]);
  const current = db && value !== null && snapshot?.key === key ? snapshot : null;
  return { records: current?.records ?? [], error: current?.error ?? '', loading: !!db && value !== null && !current };
}
export const applicationStatus: Record<string, string> = { sent: 'Enviada', in_review: 'Em análise', needs_info: 'Complementação solicitada', approved: 'Aprovada', scheduled: 'Retirada agendada', adopted: 'Adoção concluída', rejected: 'Não aprovada', cancelled: 'Cancelada', closed: 'Encerrada por adoção' };
export const petStatus: Record<string, string> = { available: 'Disponível para adoção', in_process: 'Em processo de adoção', adopted: 'Adotado', paused: 'Divulgação pausada' };
export const paymentStatus: Record<string, string> = { creating: 'Preparando checkout', pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', rejected: 'Recusada', refunded: 'Reembolsada', charged_back: 'Contestada', checkout_error: 'Checkout não concluído' };
export const brasilia = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
