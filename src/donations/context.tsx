import React, { createContext, useContext, useRef, useState } from 'react';
import { createDonation, Donation, DonationMethod, finishDonation } from './domain';
type DonationsContextValue = { records: Donation[]; create: (placeId: string, purpose: string, amount: string, method: DonationMethod) => Donation; finish: (id: string, action: 'confirm' | 'cancel') => void };
const DonationsContext = createContext<DonationsContextValue | null>(null);
export function DonationsProvider({ children }: React.PropsWithChildren) {
  const [records, setRecords] = useState<Donation[]>([]);
  const sequence = useRef(0);
  const value: DonationsContextValue = {
    records,
    create: (placeId, purpose, amount, method) => {
      const donation = createDonation(`demo-${Date.now()}-${++sequence.current}`, placeId, purpose, amount, method);
      setRecords(current => [donation, ...current]);
      return donation;
    },
    finish: (id, action) => { setRecords(current => finishDonation(current, id, action)); },
  };
  return <DonationsContext.Provider value={value}>{children}</DonationsContext.Provider>;
}
export function useDonations() {
  const value = useContext(DonationsContext);
  if (!value) throw Error('DonationsProvider ausente.');
  return value;
}
