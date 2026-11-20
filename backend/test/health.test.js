import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyHealth, validateHealth, vaccineSummary, healthForEditing } from '../lib/health.js';
test('saúde: seleções por espécie e resultados sem negativo automático', () => {
  const cat = validateHealth({ vaccinesDone: ['v3', 'rabies'], vaccinesNeeded: ['v3'], tests: [{ id: 'fiv', result: 'not_informed' }, { id: 'felv', result: 'negative' }], notes: 'Registro da ONG' }, 'Gato');
  assert.equal(cat.tests[0].result, 'not_informed');
  assert.equal(cat.tests[1].result, 'negative');
  assert.equal(vaccineSummary(cat.vaccinesDone, 'Gato'), 'V3 felina, Antirrábica');
  assert.deepEqual(validateHealth(emptyHealth(), 'Outro'), emptyHealth());
  for (const [data, species] of [
    [{ ...emptyHealth(), vaccinesDone: ['v10'] }, 'Gato'],
    [{ ...emptyHealth(), tests: [{ id: 'fiv', result: 'positive' }] }, 'Cão'],
    [{ ...emptyHealth(), tests: [{ id: 'fiv', result: 'invalid' }] }, 'Gato'],
    [{ ...emptyHealth(), vaccinesDone: ['v3', 'v3'] }, 'Gato'],
    [{ ...emptyHealth(), tests: [{ id: 'fiv', result: 'negative' }, { id: 'fiv', result: 'positive' }] }, 'Gato'],
  ]) assert.throws(() => validateHealth(data, species));
});
test('saúde: edição usa o registro salvo ou começa vazio', () => {
  assert.deepEqual(healthForEditing({ species: 'Gato' }), emptyHealth());
  const saved = { ...emptyHealth(), vaccinesDone: ['v3'] };
  assert.deepEqual(healthForEditing({ species: 'Gato', health: saved }), saved);
});
