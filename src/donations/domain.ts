export function money(cents: number): string { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function parseAmount(value: string): number {
  const cleaned = value.trim();
  if (!/^\d{1,5}([,.]\d{1,2})?$/.test(cleaned)) throw Error('Informe um valor válido, como 25 ou 25,50.');
  const cents = Math.round(Number(cleaned.replace(',', '.')) * 100);
  if (cents < 100 || cents > 1000000) throw Error('Escolha um valor entre R$ 1,00 e R$ 10.000,00.');
  return cents;
}
// Não existe aprovação de doação: doação de teste vale assim que é feita.
// Só o pagamento real (Mercado Pago) depende do retorno do provedor.
export function donationCounts(record: { mode: string; status: string }): boolean {
  return record.mode === 'test' ? record.status !== 'cancelled' : record.status === 'confirmed';
}
