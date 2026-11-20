// Expected validation failure: its message is safe to show to the user.
export class UserError extends Error {}
export const DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new UserError(`${label}: preencha corretamente (até ${max} caracteres).`);
  return value.trim();
}
export function id(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,300}$/.test(value)) throw new UserError('Identificador inválido.');
  return value;
}
export function fullName(value) {
  const name = text(value, 'Nome completo');
  if (!/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*)+$/u.test(name)) throw new UserError('Informe nome e sobrenome completos.');
  return name.replace(/\s+/g, ' ');
}
export function phone(value) {
  const digits = String(value ?? '').replace(/[\s()+.-]/g, '');
  if (!/^\d{10,11}$/.test(digits) || !DDDS.has(digits.slice(0, 2)) || !(digits.length === 11 ? /^9\d{8}$/.test(digits.slice(2)) : /^[2-5]\d{7}$/.test(digits.slice(2)))) throw new UserError('Informe DDD válido + telefone: 10 dígitos para fixo ou 11 para celular (começando com 9).');
  return digits;
}
export function passwordRequirements(value) {
  return [value.length >= 10, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^\p{L}\p{N}\s]/u.test(value)];
}
export function cep(value) {
  const digits = String(value ?? '').replace('-', '').trim();
  if (!/^\d{8}$/.test(digits)) throw new UserError('Informe um CEP válido com 8 números.');
  return digits;
}
export function cents(value) {
  if (!Number.isInteger(value) || value < 500 || value > 1000000) throw new UserError('Valor permitido: R$ 5,00 a R$ 10.000,00.');
  return value;
}
export function scheduledDate(value, now = Date.now()) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= now || ms > now + 366 * 86400000) throw new UserError('Escolha uma data futura, dentro de um ano.');
  return new Date(ms).toISOString();
}
export function decide(status, action) {
  const transitions = {
    sent: { review: 'in_review', reject: 'rejected', approve: 'approved', cancel: 'cancelled' },
    in_review: { request_info: 'needs_info', reject: 'rejected', approve: 'approved', cancel: 'cancelled' },
    needs_info: { review: 'in_review', reject: 'rejected', cancel: 'cancelled' },
    approved: { schedule: 'scheduled', cancel: 'cancelled', reject: 'rejected' },
    scheduled: { schedule: 'scheduled', complete: 'adopted', cancel: 'cancelled' },
  };
  const next = transitions[status]?.[action];
  if (!next) throw new UserError('Esta ação não está disponível para o estado atual da candidatura.');
  return next;
}
export function paymentMatches(payment, record, collectorId) {
  return payment.external_reference === record.id && payment.currency_id === 'BRL'
    && Math.round(Number(payment.transaction_amount) * 100) === record.amountCents
    && String(payment.collector_id) === String(collectorId);
}
export function cnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) throw new UserError('Informe um CNPJ válido com 14 números.');
  const check = length => {
    let sum = 0; let weight = length - 7;
    for (let i = 0; i < length; i++) { sum += Number(digits[i]) * weight--; if (weight < 2) weight = 9; }
    const rest = sum % 11; return rest < 2 ? 0 : 11 - rest;
  };
  if (check(12) !== Number(digits[12]) || check(13) !== Number(digits[13])) throw new UserError('CNPJ inválido. Confira os números.');
  return digits;
}
// Ficha institucional pública da ONG. Campos vazios são permitidos; preenchidos são validados.
export function orgInfo(data = {}, now = new Date()) {
  const optional = (value, label, max) => (typeof value === 'string' && value.trim() ? text(value, label, max) : '');
  const year = data.foundedYear === '' || data.foundedYear == null ? null : Number(data.foundedYear);
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > now.getFullYear())) throw new UserError(`Ano de fundação: use um ano entre 1900 e ${now.getFullYear()}.`);
  const email = optional(data.publicEmail, 'E-mail público', 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new UserError('Informe um e-mail público válido.');
  const instagram = optional(data.instagram, 'Instagram', 80).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) throw new UserError('Informe o usuário do Instagram, como @abrigo.');
  let website = optional(data.website, 'Site', 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) { let ok = false; try { const url = new URL(website); ok = ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.'); } catch { ok = false; } if (!ok) throw new UserError('Informe um site válido, como abrigo.org.br.'); }
  if (data.team != null && (!Array.isArray(data.team) || data.team.length > 20)) throw new UserError('A equipe pode ter até 20 pessoas.');
  const team = (data.team || []).map(member => ({ name: text(member?.name, 'Nome do integrante', 80), role: optional(member?.role, 'Função', 60) }));
  return {
    cnpj: typeof data.cnpj === 'string' && data.cnpj.trim() ? cnpj(data.cnpj) : '',
    legalName: optional(data.legalName, 'Razão social', 150),
    about: optional(data.about, 'Sobre a ONG', 600),
    foundedYear: year,
    whatsapp: typeof data.whatsapp === 'string' && data.whatsapp.trim() ? phone(data.whatsapp) : '',
    publicEmail: email,
    instagram,
    website,
    address: optional(data.address, 'Endereço de atendimento', 200),
    hours: optional(data.hours, 'Horário de atendimento', 120),
    team,
  };
}
