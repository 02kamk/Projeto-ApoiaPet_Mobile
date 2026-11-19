export type LevelId = 'none' | 'bronze' | 'prata' | 'ouro' | 'diamante';
export type Level = { id: LevelId; name: string; minCents: number; color: string };
// Metas por total acumulado (centavos). Bronze definido pelo produto; demais ajustáveis aqui.
export const levels: Level[] = [
  { id: 'none', name: 'Iniciante', minCents: 0, color: '#DCE5DF' },
  { id: 'bronze', name: 'Bronze', minCents: 100_00, color: '#B87333' },
  { id: 'prata', name: 'Prata', minCents: 500_00, color: '#9AA6B2' },
  { id: 'ouro', name: 'Ouro', minCents: 1_000_00, color: '#E0A82E' },
  { id: 'diamante', name: 'Diamante', minCents: 5_000_00, color: '#3FB8E8' },
];
export type LevelProgress = { level: Level; next: Level | null; progress: number; missingCents: number };
export function levelFor(totalCents: number): LevelProgress {
  const total = Number.isFinite(totalCents) && totalCents > 0 ? totalCents : 0;
  let index = 0;
  for (let i = 0; i < levels.length; i++) if (total >= levels[i].minCents) index = i;
  const level = levels[index];
  const next = levels[index + 1] ?? null;
  if (!next) return { level, next, progress: 1, missingCents: 0 };
  return { level, next, progress: Math.min(1, total / next.minCents), missingCents: next.minCents - total };
}
