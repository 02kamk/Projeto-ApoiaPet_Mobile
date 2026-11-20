import { UserError } from './core.js';
// Registration options only: vaccination protocols and diagnosis require a veterinarian.
export const vaccineOptions = {
  Gato: [{ id: 'rabies', label: 'Antirrábica' }, { id: 'v3', label: 'V3 felina' }, { id: 'v4', label: 'V4 felina' }, { id: 'v5', label: 'V5 felina' }],
  Cão: [{ id: 'rabies', label: 'Antirrábica' }, { id: 'v8', label: 'V8 canina' }, { id: 'v10', label: 'V10 canina' }],
  Outro: [],
};
export const testOptions = {
  Gato: [{ id: 'fiv', label: 'FIV' }, { id: 'felv', label: 'FeLV' }],
  Cão: [{ id: 'leishmania', label: 'Leishmaniose' }, { id: 'heartworm', label: 'Dirofilariose' }],
  Outro: [],
};
export const testResults = { not_informed: 'Resultado não informado', negative: 'Negativo', positive: 'Positivo', inconclusive: 'Inconclusivo' };
export function emptyHealth() { return { vaccinesDone: [], vaccinesNeeded: [], tests: [], notes: '' }; }
export function validateHealth(value, species) {
  if (!value || !vaccineOptions[species]) throw new UserError('Informações de saúde inválidas.');
  const allowedVaccines = vaccineOptions[species].map(item => item.id);
  const checkList = list => {
    if (!Array.isArray(list) || list.some(id => !allowedVaccines.includes(id)) || new Set(list).size !== list.length) throw new UserError('Selecione vacinas válidas para a espécie.');
    return [...list];
  };
  if (!Array.isArray(value.tests) || value.tests.length > testOptions[species].length || new Set(value.tests.map(item => item?.id)).size !== value.tests.length) throw new UserError('Testes inválidos ou repetidos.');
  const tests = value.tests.map(item => {
    if (!testOptions[species].some(option => option.id === item?.id) || !Object.hasOwn(testResults, item.result)) throw new UserError('Selecione um teste e resultado válidos para a espécie.');
    return { id: item.id, result: item.result };
  });
  if (typeof value.notes !== 'string' || value.notes.length > 3000) throw new UserError('As observações de saúde devem ter até 3000 caracteres.');
  return { vaccinesDone: checkList(value.vaccinesDone), vaccinesNeeded: checkList(value.vaccinesNeeded), tests, notes: value.notes.trim() };
}
export function vaccineSummary(ids, species) {
  return ids.map(id => vaccineOptions[species]?.find(item => item.id === id)?.label).filter(Boolean).join(', ') || 'Nenhuma vacina registrada';
}
export function healthForEditing(pet) {
  return pet.health ? validateHealth(pet.health, pet.species) : emptyHealth();
}
