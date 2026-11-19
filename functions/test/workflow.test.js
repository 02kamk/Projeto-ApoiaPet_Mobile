import test from 'node:test';
import assert from 'node:assert/strict';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-apoiapet', storageBucket: 'demo-apoiapet.appspot.com' });
const backend = await import('../index.js');
const { db } = await import('../runtime.js');
const { getStorage } = await import('firebase-admin/storage');

// Exercises real callable handlers with an atomic in-memory Firestore boundary.
// This does not replace deployed Firestore/Storage rule tests.
let records = new Map();
let sequence = 0;
let queue = Promise.resolve();
const snap = (ref, store = records) => ({ id: ref.id, ref, exists: store.has(ref.path), data: () => structuredClone(store.get(ref.path)) });
function doc(path) {
  return { path, id: path.split('/').at(-1), get: async () => snap(doc(path)), collection: name => collection(`${path}/${name}`),
    create: async value => { if (records.has(path)) throw Error('exists'); records.set(path, structuredClone(value)); },
    set: async value => { records.set(path, structuredClone(value)); },
    update: async value => { records.set(path, { ...records.get(path), ...structuredClone(value) }); },
  };
}
function collection(path, filters = []) {
  return { path, filters, doc: id => doc(`${path}/${id || `auto-${++sequence}`}`), where: (field, operator, value) => collection(path, [...filters, [field, value]]) };
}
db.doc = doc;
db.collection = collection;
db.runTransaction = handler => {
  const run = queue.then(async () => {
    const copy = new Map([...records].map(([key, value]) => [key, structuredClone(value)]));
    let written = false;
    const transaction = {
      get: async ref => {
        if (written) throw Error('Firestore reads must precede writes');
        if (ref.filters) return { docs: [...copy].filter(([path, value]) => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1 && ref.filters.every(([field, target]) => value[field] === target)).map(([path]) => snap(doc(path), copy)) };
        return snap(ref, copy);
      },
      create: (ref, value) => { written = true; if (copy.has(ref.path)) throw Error('exists'); copy.set(ref.path, structuredClone(value)); },
      set: (ref, value, options) => { written = true; copy.set(ref.path, { ...(options?.merge ? copy.get(ref.path) : {}), ...structuredClone(value) }); },
      update: (ref, value) => { written = true; assert.ok(copy.has(ref.path)); copy.set(ref.path, { ...copy.get(ref.path), ...structuredClone(value) }); },
    };
    const result = await handler(transaction); records = copy; return result;
  });
  queue = run.catch(() => {}); return run;
};
getStorage().bucket = () => ({ file: () => ({ getMetadata: async () => [{ contentType: 'image/jpeg', size: 1000 }] }) });
const invoke = (name, uid, data) => backend[name].run({ auth: { uid }, data });
function seed(uid, role, name) {
  records.set(`profiles/${uid}`, { name, role, city: 'Recife', state: 'PE', cityCode: '2611606' });
  records.set(`privateProfiles/${uid}`, { fullName: `${name} Silva`, phone: '81987654321', cep: '50000000' });
}
test('candidatura pertence à ONG escolhida; retirada reserva, conclui e encerra concorrentes', async () => {
  seed('ong-1', 'ong', 'Abrigo Um'); seed('ong-2', 'ong', 'Abrigo Dois'); seed('donor-1', 'donor', 'Maria'); seed('donor-2', 'donor', 'João');
  const pet = await invoke('savePet', 'ong-1', { name: 'Luna', species: 'Gato', age: '2 anos', description: 'Acolhida', health: { vaccinesDone: ['rabies'], vaccinesNeeded: ['v3'], tests: [{ id: 'fiv', result: 'not_informed' }, { id: 'felv', result: 'negative' }], notes: 'Registro de vacinação' }, photoPath: 'pets/ong-1/luna.jpg' });
  assert.equal(records.get(`pets/${pet.id}`).health.tests[0].result, 'not_informed');
  assert.equal(records.get(`pets/${pet.id}`).health.tests[1].result, 'negative');
  assert.equal(records.get(`pets/${pet.id}`).vaccinesDone, 'Antirrábica');
  const apply = uid => invoke('submitApplication', uid, { petId: pet.id, housing: 'Apartamento', safety: 'Telas em todas as janelas', routine: 'Cuidados diários', motivation: 'Quero acolher', consent: true, photoPaths: [`homes/${uid}/${pet.id}_${uid}/room.jpg`], ongId: 'ong-2', applicantName: 'Spoofed' });
  const a = await apply('donor-1'); const b = await apply('donor-2');
  assert.equal(records.get(`applications/${a.id}`).ongId, 'ong-1');
  assert.equal(records.get(`applications/${a.id}`).applicantName, 'Maria Silva');
  await assert.rejects(apply('donor-1'), /já enviou/);
  await assert.rejects(invoke('changeApplication', 'ong-2', { id: a.id, action: 'approve' }));
  await assert.rejects(invoke('changeApplication', 'donor-1', { id: a.id, action: 'approve' }));
  await assert.rejects(invoke('sendMessage', 'donor-1', { id: a.id, body: 'Antes da aprovação' }));
  await invoke('changeApplication', 'ong-1', { id: a.id, action: 'approve' });
  await invoke('changeApplication', 'ong-1', { id: b.id, action: 'approve' });
  await invoke('sendMessage', 'donor-1', { id: a.id, body: 'Podemos combinar a retirada?', senderName: 'Spoofed' });
  const message = [...records].find(([path]) => path.startsWith(`applications/${a.id}/messages/`))[1];
  assert.equal(message.senderName, 'Maria Silva');
  const pickupAt = new Date(Date.now() + 86400000).toISOString();
  await invoke('changeApplication', 'ong-1', { id: a.id, action: 'schedule', pickupAt, pickupPlace: 'Sede do abrigo' });
  assert.equal(records.get(`pets/${pet.id}`).status, 'in_process');
  assert.equal(records.get(`pets/${pet.id}`).listed, true);
  await assert.rejects(invoke('changeApplication', 'ong-1', { id: b.id, action: 'schedule', pickupAt, pickupPlace: 'Sede' }), /outra retirada/);
  await invoke('changeApplication', 'ong-1', { id: a.id, action: 'complete' });
  assert.equal(records.get(`pets/${pet.id}`).listed, false);
  assert.equal(records.get(`pets/${pet.id}`).status, 'adopted');
  assert.equal(records.get(`applications/${a.id}`).status, 'adopted');
  assert.equal(records.get(`applications/${b.id}`).status, 'closed');
  await assert.rejects(invoke('changeApplication', 'ong-1', { id: a.id, action: 'complete' }));
});
test('desistência libera animal; doação de teste é aprovada automaticamente', async () => {
  const pet = await invoke('savePet', 'ong-1', { name: 'Nino', species: 'Cão', age: '1 ano', description: 'Resgatado', vaccinesDone: 'Não informado', vaccinesNeeded: 'Avaliação veterinária', photoPath: 'pets/ong-1/nino.jpg' });
  const application = await invoke('submitApplication', 'donor-1', { petId: pet.id, housing: 'Casa', safety: 'Muros e portões', routine: 'Cuidados', motivation: 'Acolher', consent: true, photoPaths: [`homes/donor-1/${pet.id}_donor-1/room.jpg`] });
  await invoke('changeApplication', 'ong-1', { id: application.id, action: 'approve' });
  await invoke('changeApplication', 'ong-1', { id: application.id, action: 'schedule', pickupAt: new Date(Date.now() + 86400000).toISOString(), pickupPlace: 'Abrigo' });
  await invoke('changeApplication', 'donor-1', { id: application.id, action: 'cancel' });
  assert.equal(records.get(`pets/${pet.id}`).status, 'available');
  assert.equal(records.get(`pets/${pet.id}`).activeApplicationId, null);
  const data = { ongId: 'ong-1', amountCents: 2550, mode: 'test', requestId: 'unique-request-id-123' };
  const donation = await invoke('createDonation', 'donor-1', data);
  const again = await invoke('createDonation', 'donor-1', data);
  assert.equal(donation.id, again.id);
  assert.equal(records.get(`donations/${donation.id}`).donorName, 'Maria Silva');
  assert.equal(records.get(`donations/${donation.id}`).status, 'confirmed');
  assert.ok(records.get(`donations/${donation.id}`).confirmedAt);
});
test('doador e ONG salvam, trocam e removem a própria foto de perfil', async () => {
  seed('ong-9', 'ong', 'Abrigo Foto'); seed('donor-9', 'donor', 'Ana');
  await invoke('setProfilePhoto', 'ong-9', { photoPath: 'avatars/ong-9/a.jpg' });
  assert.equal(records.get('profiles/ong-9').photoPath, 'avatars/ong-9/a.jpg');
  await invoke('setProfilePhoto', 'donor-9', { photoPath: 'avatars/donor-9/b.png' });
  assert.equal(records.get('profiles/donor-9').photoPath, 'avatars/donor-9/b.png');
  await assert.rejects(invoke('setProfilePhoto', 'donor-9', { photoPath: 'avatars/ong-9/a.jpg' }), /Foto inválida/);
  await assert.rejects(invoke('setProfilePhoto', 'donor-9', { photoPath: 'pets/donor-9/x.jpg' }), /Foto inválida/);
  await invoke('setProfilePhoto', 'donor-9', { photoPath: '' });
  assert.equal(records.get('profiles/donor-9').photoPath, '');
  await assert.rejects(invoke('setProfilePhoto', 'sem-cadastro', { photoPath: '' }), /Complete seu cadastro/);
});
test('ONG salva ficha institucional, equipe e capa; doador não', async () => {
  seed('ong-7', 'ong', 'Abrigo Ficha'); seed('donor-7', 'donor', 'Bia');
  await invoke('saveOrgInfo', 'ong-7', { cnpj: '11.222.333/0001-81', legalName: 'Associação Abrigo Ficha', about: 'Resgatamos cães e gatos.', foundedYear: '2015', whatsapp: '81987654321', publicEmail: 'Contato@Abrigo.org', instagram: '@abrigo.ficha', website: 'abrigo.org.br', address: 'Rua A, 10', hours: 'Seg a sex, 9h às 17h', team: [{ name: 'Ana Lima', role: 'Coordenação' }] });
  const org = records.get('profiles/ong-7').org;
  assert.equal(org.cnpj, '11222333000181'); assert.equal(org.publicEmail, 'contato@abrigo.org'); assert.equal(org.instagram, 'abrigo.ficha');
  assert.equal(org.website, 'https://abrigo.org.br'); assert.equal(org.foundedYear, 2015); assert.equal(org.team[0].name, 'Ana Lima');
  await assert.rejects(invoke('saveOrgInfo', 'ong-7', { cnpj: '11222333000180' }), /CNPJ inválido/);
  await assert.rejects(invoke('saveOrgInfo', 'ong-7', { foundedYear: '1800' }), /Ano de fundação/);
  await assert.rejects(invoke('saveOrgInfo', 'donor-7', { about: 'x' }), /perfil correto/);
  await invoke('setProfilePhoto', 'ong-7', { photoPath: 'avatars/ong-7/capa.jpg', kind: 'cover' });
  assert.equal(records.get('profiles/ong-7').coverPath, 'avatars/ong-7/capa.jpg');
  await assert.rejects(invoke('setProfilePhoto', 'donor-7', { photoPath: 'avatars/donor-7/capa.jpg', kind: 'cover' }), /Somente ONGs/);
});
test('ONG define responsável da equipe por animal; data de cadastro é preservada', async () => {
  seed('ong-8', 'ong', 'Abrigo Equipe'); seed('ong-9b', 'ong', 'Outro Abrigo');
  await invoke('saveOrgInfo', 'ong-8', { team: [{ name: 'Ana Lima', role: 'Coordenação' }] });
  const pet = await invoke('savePet', 'ong-8', { name: 'Rex', species: 'Cão', age: '2 anos', description: 'Calmo', health: { vaccinesDone: [], vaccinesNeeded: [], tests: [], notes: '' }, photoPath: 'pets/ong-8/rex.jpg' });
  const created = records.get(`pets/${pet.id}`).createdAt;
  assert.ok(created);
  await invoke('setPetCaretaker', 'ong-8', { petId: pet.id, caretaker: 'Ana Lima' });
  assert.equal(records.get(`pets/${pet.id}`).caretaker, 'Ana Lima');
  await assert.rejects(invoke('setPetCaretaker', 'ong-8', { petId: pet.id, caretaker: 'Fulano' }), /equipe/);
  await assert.rejects(invoke('setPetCaretaker', 'ong-9b', { petId: pet.id, caretaker: '' }), /não encontrado/);
  await invoke('savePet', 'ong-8', { id: pet.id, name: 'Rex', species: 'Cão', age: '3 anos', description: 'Calmo', health: { vaccinesDone: [], vaccinesNeeded: [], tests: [], notes: '' }, photoPath: 'pets/ong-8/rex.jpg' });
  assert.equal(records.get(`pets/${pet.id}`).createdAt, created);
  assert.equal(records.get(`pets/${pet.id}`).caretaker, 'Ana Lima');
});
