export function text(value: unknown, label: string, max?: number): string;
export function id(value: unknown): string;
export function fullName(value: unknown): string;
export function phone(value: unknown): string;
export function passwordRequirements(value: string): boolean[];
export function cep(value: unknown): string;
export function cents(value: number): number;
export function scheduledDate(value: string, now?: number): string;
export function decide(status: string, action: string): string;
export function paymentMatches(payment: Record<string, unknown>, record: { id: string; amountCents: number }, collectorId: string): boolean;
export function cnpj(value: unknown): string;
export type OrgInfo = { cnpj: string; legalName: string; about: string; foundedYear: number | null; whatsapp: string; publicEmail: string; instagram: string; website: string; address: string; hours: string; team: { name: string; role: string }[] };
export function orgInfo(data?: Record<string, unknown>, now?: Date): OrgInfo;
export class UserError extends Error {}
