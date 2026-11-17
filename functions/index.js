import { getStorage } from 'firebase-admin/storage';
import * as core from './core.js';
import { validateHealth, vaccineSummary } from './health.js';
import { db, callable } from './runtime.js';
async function getProfile(uid, requiredRole) {
  const [pub, privateDoc] = await Promise.all([db.doc(`profiles/${uid}`).get(), db.doc(`privateProfiles/${uid}`).get()]);
  const profile = { ...pub.data(), ...privateDoc.data() };
  if (!pub.exists || !privateDoc.exists || (requiredRole && profile.role !== requiredRole)) throw Error('Complete seu cadastro com o perfil correto.');
  return profile;
}
async function address(value) {
  const cep = core.cep(value);
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Não foi possível consultar o CEP. Tente novamente.');
  const data = await response.json();
  if (data.erro || !data.ibge || !data.localidade || !data.uf) throw Error('CEP não encontrado.');
  return { cep, city: data.localidade, state: data.uf, cityCode: data.ibge, street: data.logradouro || '', neighborhood: data.bairro || '' };
}
export const saveProfile = callable(async (uid, data) => {
  const name = core.fullName(data.fullName);
  const phone = core.phone(data.phone);
  const location = await address(data.cep);
  if (!['ong', 'donor'].includes(data.role)) throw Error('Escolha seu perfil.');
  const publicName = data.role === 'ong' ? core.text(data.ongName, 'Nome da ONG') : name;
  await db.runTransaction(async transaction => {
    const current = await transaction.get(db.doc(`profiles/${uid}`));
    if (current.exists && current.data().role !== data.role) throw Error('Não é possível trocar o tipo de conta.');
    transaction.set(db.doc(`profiles/${uid}`), { name: publicName, role: data.role, city: location.city, state: location.state, cityCode: location.cityCode });
    transaction.set(db.doc(`privateProfiles/${uid}`), { fullName: name, phone, ...location });
  });
  return { ok: true };
});
async function validatePhoto(path, prefix) {
  if (typeof path !== 'string' || !path.startsWith(prefix) || !/^[\w/.-]+$/.test(path)) throw Error('Foto inválida.');
  const [metadata] = await getStorage().bucket().file(path).getMetadata();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.contentType) || Number(metadata.size) > 5 * 1024 * 1024) throw Error('Use uma foto JPG, PNG ou WebP de até 5 MB.');
}
export const savePet = callable(async (uid, data) => {
  const profile = await getProfile(uid, 'ong');
  const fields = {
    name: core.text(data.name, 'Nome'), species: core.text(data.species, 'Espécie', 20), age: core.text(data.age, 'Idade', 80),
    description: core.text(data.description, 'Descrição e cuidados', 3000),
    ...(data.health ? {} : { vaccinesDone: core.text(data.vaccinesDone, 'Vacinas realizadas', 1500), vaccinesNeeded: core.text(data.vaccinesNeeded, 'Vacinas necessárias', 1500) }),
    photoPath: core.text(data.photoPath, 'Foto', 300),
  };
  if (!['Gato', 'Cão', 'Outro'].includes(fields.species)) throw Error('Espécie inválida.');
  if (data.health) {
    fields.health = validateHealth(data.health, fields.species);
    fields.vaccinesDone = vaccineSummary(fields.health.vaccinesDone, fields.species);
    fields.vaccinesNeeded = vaccineSummary(fields.health.vaccinesNeeded, fields.species);
  }
  await validatePhoto(fields.photoPath, `pets/${uid}/`);
  const ref = data.id ? db.doc(`pets/${core.id(data.id)}`) : db.collection('pets').doc();
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    if (data.id && (!previous.exists || previous.data().ongId !== uid)) throw Error('Animal não encontrado nesta ONG.');
    const old = previous.data();
    transaction.set(ref, { ...fields, ongId: uid, ongName: profile.name, city: profile.city, state: profile.state, cityCode: profile.cityCode,
      status: old?.status || 'available', listed: old?.listed ?? true, activeApplicationId: old?.activeApplicationId || null, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return { id: ref.id };
});
export const togglePet = callable(async (uid, { petId }) => {
  await getProfile(uid, 'ong');
  const ref = db.doc(`pets/${core.id(petId)}`);
  await db.runTransaction(async transaction => {
    const pet = (await transaction.get(ref)).data();
    if (!pet || pet.ongId !== uid || !['available', 'paused'].includes(pet.status)) throw Error('Só é possível pausar/reativar animais disponíveis.');
    transaction.update(ref, { status: pet.status === 'available' ? 'paused' : 'available', listed: pet.status !== 'available' });
  });
  return { ok: true };
});
export const submitApplication = callable(async (uid, data) => {
  const profile = await getProfile(uid, 'donor');
  const petId = core.id(data.petId);
  const id = `${petId}_${uid}`;
  const answers = { housing: core.text(data.housing, 'Moradia', 500), safety: core.text(data.safety, 'Proteção de janelas e saídas', 2000), routine: core.text(data.routine, 'Rotina de cuidados', 2000), motivation: core.text(data.motivation, 'Motivação', 2000) };
  if (data.consent !== true || !Array.isArray(data.photoPaths) || data.photoPaths.length < 1 || data.photoPaths.length > 6) throw Error('Adicione de 1 a 6 fotos do ambiente e autorize o compartilhamento com a ONG.');
  if (new Set(data.photoPaths).size !== data.photoPaths.length) throw Error('Selecione fotos diferentes.');
  await Promise.all(data.photoPaths.map(path => validatePhoto(path, `homes/${uid}/${id}/`)));
  await db.runTransaction(async transaction => {
    const petRef = db.doc(`pets/${petId}`);
    const applicationRef = db.doc(`applications/${id}`);
    const [petDoc, existing] = await Promise.all([transaction.get(petRef), transaction.get(applicationRef)]);
    const pet = petDoc.data();
    if (!pet || pet.status !== 'available') throw Error('Este animal não está disponível para novas candidaturas.');
    if (existing.exists) throw Error('Você já enviou uma candidatura para este animal. Consulte seu histórico.');
    const now = new Date().toISOString();
    transaction.create(applicationRef, { petId, petName: pet.name, ongId: pet.ongId, ongName: pet.ongName, applicantId: uid,
      applicantName: profile.fullName, phone: profile.phone, city: profile.city, state: profile.state,
      answers, photoPaths: data.photoPaths, consentAt: now, status: 'sent', createdAt: now, updatedAt: now, pickupAt: null, pickupPlace: '', history: [{ at: now, message: 'Candidatura enviada para análise humana.', actorId: uid }] });
  });
  return { id };
});
export const changeApplication = callable(async (uid, data) => {
  const id = core.id(data.id);
  const ref = db.doc(`applications/${id}`);
  await db.runTransaction(async transaction => {
    const application = (await transaction.get(ref)).data();
    if (!application || ![application.ongId, application.applicantId].includes(uid)) throw Error('Candidatura não encontrada.');
    const isOng = application.ongId === uid;
    if (!isOng && !['cancel', 'review'].includes(data.action)) throw Error('Somente a ONG pode realizar esta ação.');
    if (!isOng && data.action === 'review' && application.status !== 'needs_info') throw Error('Não há complementação pendente.');
    const status = core.decide(application.status, data.action);
    const petRef = db.doc(`pets/${application.petId}`);
    const pet = (await transaction.get(petRef)).data();
    if (!pet) throw Error('Animal não encontrado.');
    const now = new Date().toISOString();
    const update = { status, updatedAt: now };
    let message = typeof data.message === 'string' ? data.message.trim().slice(0, 2000) : '';
    if (['reject', 'request_info'].includes(data.action) || (!isOng && data.action === 'review')) message = core.text(message, 'Mensagem', 2000);
    if (data.action === 'approve' && pet.status !== 'available') throw Error('Este animal já tem uma retirada agendada ou foi adotado.');
    let others;
    if (data.action === 'complete') others = await transaction.get(db.collection('applications').where('petId', '==', application.petId));
    if (data.action === 'schedule') {
      if (pet.status === 'adopted' || (pet.activeApplicationId && pet.activeApplicationId !== id)) throw Error('Já existe outra retirada agendada para este animal.');
      update.pickupAt = core.scheduledDate(data.pickupAt);
      update.pickupPlace = core.text(data.pickupPlace, 'Local da retirada', 500);
      transaction.update(petRef, { status: 'in_process', listed: true, activeApplicationId: id });
      message = `Retirada agendada para ${update.pickupAt}. Local: ${update.pickupPlace}. ${message}`;
    }
    if (data.action === 'complete') {
      if (pet.activeApplicationId !== id) throw Error('A retirada agendada não pertence a esta candidatura.');
      transaction.update(petRef, { status: 'adopted', listed: false });
      for (const other of others.docs) {
        const record = other.data();
        if (other.id !== id && !['rejected', 'cancelled', 'closed', 'adopted'].includes(record.status)) transaction.update(other.ref, { status: 'closed', updatedAt: now, history: [...record.history, { at: now, message: 'Candidatura encerrada: animal adotado por outra pessoa.', actorId: uid }] });
      }
    }
    if (data.action === 'cancel' && pet.activeApplicationId === id) {
      update.pickupAt = null; update.pickupPlace = '';
      transaction.update(petRef, { status: 'available', listed: true, activeApplicationId: null });
    }
    const labels = { review: 'Em análise.', approve: 'Candidatura aprovada. Combine a retirada pelo chat.', request_info: 'Complementação solicitada.', reject: 'Candidatura não aprovada.', cancel: 'Candidatura cancelada.', complete: 'Retirada confirmada. Adoção concluída.', schedule: 'Agendamento registrado.' };
    transaction.update(ref, { ...update, history: [...application.history, { at: now, message: `${labels[data.action]} ${message}`.trim(), actorId: uid }] });
  });
  return { ok: true };
});
export const sendMessage = callable(async (uid, data) => {
  const id = core.id(data.id);
  const body = core.text(data.body, 'Mensagem', 2000);
  const profile = await getProfile(uid);
  await db.runTransaction(async transaction => {
    const application = (await transaction.get(db.doc(`applications/${id}`))).data();
    if (!application || ![application.ongId, application.applicantId].includes(uid) || !['approved', 'scheduled'].includes(application.status)) throw Error('O chat fica disponível após a aprovação e até a retirada.');
    const ref = db.collection(`applications/${id}/messages`).doc();
    transaction.create(ref, { senderId: uid, senderName: profile.role === 'ong' ? profile.name : profile.fullName, body, createdAt: new Date().toISOString() });
  });
  return { ok: true };
});
export { createDonation, startMercadoPagoConnection, mercadoPagoCallback, mercadoPagoWebhook, simulateDonation } from './payments.js';
