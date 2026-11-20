import { useSession } from '../backend/session';
import { Donation, donationCounts, useRecords } from '../backend/data';
import { levelFor } from '../donations/levels';
// Total doado (apenas registros confirmados) e nível do doador logado.
export function useDonorLevel() {
  const { user, profile } = useSession();
  const donor = profile?.role === 'donor' && user ? user.uid : null;
  const donations = useRecords<Donation>('donations', 'donorId', donor);
  const totalCents = donations.records.filter(donationCounts).reduce((sum, record) => sum + record.amountCents, 0);
  return { ...donations, totalCents, ...levelFor(totalCents), donor: !!donor };
}
