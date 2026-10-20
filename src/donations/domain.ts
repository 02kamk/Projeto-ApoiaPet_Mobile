export type SupportPlace = { id: string; name: string; description: string; needs: string[]; audience: string };
export type DonationMethod = 'Pix' | 'Cartão';
export type Donation = { id: string; placeId: string; placeName: string; purpose: string; amountCents: number; method: DonationMethod; status: 'Aguardando simulação' | 'Confirmada (simulação)' | 'Cancelada'; createdAt: string };
export const places: SupportPlace[] = [
  { id: 'demo-cats', name: 'Ponto de apoio aos gatos — exemplo', description: 'Exemplo de local que oferece alimentação e acolhimento a gatos resgatados das ruas.', needs: ['Ração para gatos', 'Alimento úmido para gatos', 'Ração para filhotes'], audience: 'Gatos e filhotes' },
  { id: 'demo-dogs', name: 'Ponto de apoio aos cães — exemplo', description: 'Exemplo de local que cuida de cães em situação de rua e prepara os animais para adoção.', needs: ['Ração para cães', 'Ração para filhotes', 'Alimentação especial'], audience: 'Cães e filhotes' },
  { id: 'demo-rescue', name: 'Rede de acolhimento — exemplo', description: 'Exemplo de rede de apoio à alimentação de diferentes animais resgatados.', needs: ['Alimentação dos animais resgatados', 'Ração para gatos', 'Ração para cães'], audience: 'Diferentes pets' },
];
export function money(cents: number): string { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function parseAmount(value: string): number {
  const cleaned = value.trim();
  if (!/^\d{1,5}([,.]\d{1,2})?$/.test(cleaned)) throw Error('Informe um valor válido, como 25 ou 25,50.');
  const cents = Math.round(Number(cleaned.replace(',', '.')) * 100);
  if (cents < 100 || cents > 1000000) throw Error('Escolha um valor entre R$ 1,00 e R$ 10.000,00.');
  return cents;
}
export function createDonation(id: string, placeId: string, purpose: string, amount: string, method: DonationMethod): Donation {
  const place = places.find(p => p.id === placeId);
  if (!place || !place.needs.includes(purpose)) throw Error('Selecione um local e uma necessidade válidos.');
  if (method !== 'Pix' && method !== 'Cartão') throw Error('Selecione a forma de pagamento.');
  return { id, placeId, placeName: place.name, purpose, amountCents: parseAmount(amount), method, status: 'Aguardando simulação', createdAt: new Date().toISOString() };
}
export function finishDonation(records: Donation[], id: string, action: 'confirm' | 'cancel'): Donation[] {
  const donation = records.find(d => d.id === id);
  if (!donation) throw Error('Doação não encontrada.');
  const status = action === 'confirm' ? 'Confirmada (simulação)' : 'Cancelada';
  if (donation.status === status) return records;
  if (donation.status !== 'Aguardando simulação') throw Error('Esta doação já foi encerrada.');
  return records.map(d => d.id === id ? { ...d, status } : d);
}
