export type Health = { vaccinesDone: string[]; vaccinesNeeded: string[]; tests: { id: string; result: string }[]; notes: string };
export const vaccineOptions: Record<string, { id: string; label: string }[]>;
export const testOptions: Record<string, { id: string; label: string }[]>;
export const testResults: Record<string, string>;
export function emptyHealth(): Health;
export function validateHealth(value: unknown, species: string): Health;
export function vaccineSummary(ids: string[], species: string): string;
export function healthForEditing(pet: { species: string; health?: Health; vaccinesDone?: string; vaccinesNeeded?: string }): Health;
