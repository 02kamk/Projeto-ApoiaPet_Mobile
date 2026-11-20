import * as core from './core.js';
import { UserError } from './core.js';
import { validateHealth, vaccineSummary } from './health.js';
import { db, getProfile } from './runtime.js';
import { blob, validatePhoto } from './photos.js';
import { createDonation, startMercadoPagoConnection } from './payments.js';
async function address(value) {
  const cep = core.cep(value);
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new UserError('Não foi possível consultar o CEP. Tente novamente.');
  const data = await response.json();
  if (data.erro || !data.ibge || !data.localidade || !data.uf) throw new UserError('CEP não encontrado.');
  return { cep, city: data.localidade, state: data.uf, cityCode: data.ibge, street: data.logradouro || '', neighborhood: data.bairro || '' };
}
export const saveProfile = async (uid, data) => {
  const name = core.fullName(data.fullName);
  const phone = core.phone(data.phone);
  const location = await address(data.cep);
  if (!['ong', 'donor'].includes(data.role)) throw new UserError('Escolha seu perfil.');
  const publicName = data.role === 'ong' ? core.text(data.ongName, 'Nome da ONG') : name;
  const org = data.role === 'ong' && (data.cnpj || data.legalName) ? { cnpj: data.cnpj ? core.cnpj(data.cnpj) : '', legalName: data.legalName ? core.text(data.legalName, 'Razão social', 150) : '' } : null;
  await db.runTransaction(async transaction => {
    const current = await transaction.get(db.doc(`profiles/${uid}`));
    if (current.exists && current.data().role !== data.role) throw new UserError('Não é possível trocar o tipo de conta.');
    transaction.set(db.doc(`profiles/${uid}`), { name: publicName, role: data.role, city: location.city, state: location.state, cityCode: location.cityCode, ...(org && { org }) }, { merge: true });
    transaction.set(db.doc(`privateProfiles/${uid}`), { fullName: name, phone, ...location });
  });
  return { ok: true };
};
// Foto de perfil (doador ou ONG). photoPath vazio remove a foto.
export const setProfilePhoto = async (uid, data) => {
  const field = data.kind === 'cover' ? 'coverPath' : 'photoPath';
  const photoPath = typeof data.photoPath === 'string' ? data.photoPath : '';
  if (photoPath) await validatePhoto(photoPath, `avatars/${uid}/`);
  const ref = db.doc(`profiles/${uid}`);
  const previous = await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists) throw new UserError('Complete seu cadastro antes de adicionar uma foto.');
    if (field === 'coverPath' && current.data().role !== 'ong') throw new UserError('Somente ONGs têm foto de capa.');
    transaction.update(ref, { [field]: photoPath });
    return current.data()[field] || '';
  });
  if (previous && previous !== photoPath) { try { await blob.remove(previous); } catch (error) { console.error(error); /* arquivo órfão não impede a troca */ } }
  return { ok: true };
};
// Ficha institucional e equipe da ONG (dados públicos do perfil).
export const saveOrgInfo = async (uid, data) => {
  await getProfile(uid, 'ong');
  const org = core.orgInfo(data);
  await db.doc(`profiles/${uid}`).update({ org });
  return { ok: true };
};
export const savePet = async (uid, data) => {
  const profile = await getProfile(uid, 'ong');
  const species = core.text(data.species, 'Espécie', 20);
  if (!['Gato', 'Cão', 'Outro'].includes(species)) throw new UserError('Espécie inválida.');
  const health = validateHealth(data.health, species);
  const fields = {
    name: core.text(data.name, 'Nome'), species, age: core.text(data.age, 'Idade', 80),
    description: core.text(data.description, 'Descrição e cuidados', 3000), photoPath: data.photoPath, health,
    vaccinesDone: vaccineSummary(health.vaccinesDone, species), vaccinesNeeded: vaccineSummary(health.vaccinesNeeded, species),
  };
  await validatePhoto(fields.photoPath, `pets/${uid}/`);
  const ref = data.id ? db.doc(`pets/${core.id(data.id)}`) : db.collection('pets').doc();
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    if (data.id && (!previous.exists || previous.data().ongId !== uid)) throw new UserError('Animal não encontrado nesta ONG.');
    const now = new Date().toISOString();
    const base = { ...fields, ongId: uid, ongName: profile.name, city: profile.city, state: profile.state, cityCode: profile.cityCode, updatedAt: now };
    // Status, listing and reservation are only changed by togglePet/changeApplication.
    if (previous.exists) transaction.update(ref, base);
    else transaction.create(ref, { ...base, status: 'available', listed: true, activeApplicationId: null, createdAt: now });
  });
  return { id: ref.id };
};
// Funcionário da equipe responsável pelo animal ('' remove).
export const setPetCaretaker = async (uid, data) => {
  const profile = await getProfile(uid, 'ong');
  const caretaker = typeof data.caretaker === 'string' ? data.caretaker.trim() : '';
  if (caretaker && !(profile.org?.team || []).some(member => member.name === caretaker)) throw new UserError('Escolha alguém da equipe da ONG.');
  const ref = db.doc(`pets/${core.id(data.petId)}`);
  await db.runTransaction(async transaction => {
    const pet = (await transaction.get(ref)).data();
    if (!pet || pet.ongId !== uid) throw new UserError('Animal não encontrado nesta ONG.');
    transaction.update(ref, { caretaker });
  });
  return { ok: true };
};
export const togglePet = async (uid, { petId }) => {
  await getProfile(uid, 'ong');
  const ref = db.doc(`pets/${core.id(petId)}`);
  await db.runTransaction(async transaction => {
    const pet = (await transaction.get(ref)).data();
    if (!pet || pet.ongId !== uid || !['available', 'paused'].includes(pet.status)) throw new UserError('Só é possível pausar/reativar animais disponíveis.');
    transaction.update(ref, { status: pet.status === 'available' ? 'paused' : 'available', listed: pet.status !== 'available' });
  });
  return { ok: true };
};
export const submitApplication = async (uid, data) => {
  const profile = await getProfile(uid, 'donor');
  const petId = core.id(data.petId);
  const id = `${petId}_${uid}`;
  const answers = { housing: core.text(data.housing, 'Moradia', 500), safety: core.text(data.safety, 'Proteção de janelas e saídas', 2000), routine: core.text(data.routine, 'Rotina de cuidados', 2000), motivation: core.text(data.motivation, 'Motivação', 2000) };
  if (data.consent !== true) throw new UserError('Autorize o compartilhamento dos seus dados com a ONG.');
  // Fotos do ambiente são opcionais (até 6).
  const photoPaths = data.photoPaths ?? [];
  if (!Array.isArray(photoPaths) || photoPaths.length > 6) throw new UserError('Adicione no máximo 6 fotos do ambiente.');
  if (new Set(photoPaths).size !== photoPaths.length) throw new UserError('Selecione fotos diferentes.');
  await Promise.all(photoPaths.map(path => validatePhoto(path, `homes/${uid}/${id}/`)));
  await db.runTransaction(async transaction => {
    const petRef = db.doc(`pets/${petId}`);
    const applicationRef = db.doc(`applications/${id}`);
    const [petDoc, existing] = await Promise.all([transaction.get(petRef), transaction.get(applicationRef)]);
    const pet = petDoc.data();
    if (!pet || pet.status !== 'available') throw new UserError('Este animal não está disponível para novas candidaturas.');
    if (existing.exists) throw new UserError('Você já enviou uma candidatura para este animal. Consulte seu histórico.');
    const now = new Date().toISOString();
    transaction.create(applicationRef, { petId, petName: pet.name, ongId: pet.ongId, ongName: pet.ongName, applicantId: uid,
      applicantName: profile.fullName, phone: profile.phone, city: profile.city, state: profile.state,
      answers, photoPaths, consentAt: now, status: 'sent', createdAt: now, updatedAt: now, pickupAt: null, pickupPlace: '', history: [{ at: now, message: 'Candidatura enviada para análise humana.', actorId: uid }] });
  });
  return { id };
};
export const changeApplication = async (uid, data) => {
  const id = core.id(data.id);
  const ref = db.doc(`applications/${id}`);
  await db.runTransaction(async transaction => {
    const application = (await transaction.get(ref)).data();
    if (!application || ![application.ongId, application.applicantId].includes(uid)) throw new UserError('Candidatura não encontrada.');
    const isOng = application.ongId === uid;
    if (!isOng && !['cancel', 'review'].includes(data.action)) throw new UserError('Somente a ONG pode realizar esta ação.');
    if (!isOng && data.action === 'review' && application.status !== 'needs_info') throw new UserError('Não há complementação pendente.');
    const status = core.decide(application.status, data.action);
    const petRef = db.doc(`pets/${application.petId}`);
    const pet = (await transaction.get(petRef)).data();
    if (!pet) throw new UserError('Animal não encontrado.');
    const now = new Date().toISOString();
    const update = { status, updatedAt: now };
    let message = typeof data.message === 'string' ? data.message.trim().slice(0, 2000) : '';
    if (['reject', 'request_info'].includes(data.action) || (!isOng && data.action === 'review')) message = core.text(message, 'Mensagem', 2000);
    if (data.action === 'approve' && pet.status !== 'available') throw new UserError('Este animal já tem uma retirada agendada ou foi adotado.');
    let others;
    if (data.action === 'complete') others = await transaction.get(db.collection('applications').where('petId', '==', application.petId));
    if (data.action === 'schedule') {
      if (pet.status === 'adopted' || (pet.activeApplicationId && pet.activeApplicationId !== id)) throw new UserError('Já existe outra retirada agendada para este animal.');
      update.pickupAt = core.scheduledDate(data.pickupAt);
      update.pickupPlace = core.text(data.pickupPlace, 'Local da retirada', 500);
      transaction.update(petRef, { status: 'in_process', listed: true, activeApplicationId: id });
      message = `Retirada agendada para ${update.pickupAt}. Local: ${update.pickupPlace}. ${message}`;
    }
    if (data.action === 'complete') {
      if (pet.activeApplicationId !== id) throw new UserError('A retirada agendada não pertence a esta candidatura.');
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
};
export const sendMessage = async (uid, data) => {
  const id = core.id(data.id);
  const body = core.text(data.body, 'Mensagem', 2000);
  const profile = await getProfile(uid);
  await db.runTransaction(async transaction => {
    const application = (await transaction.get(db.doc(`applications/${id}`))).data();
    if (!application || ![application.ongId, application.applicantId].includes(uid) || !['approved', 'scheduled'].includes(application.status)) throw new UserError('O chat fica disponível após a aprovação e até a retirada.');
    const ref = db.collection(`applications/${id}/messages`).doc();
    transaction.create(ref, { senderId: uid, senderName: profile.role === 'ong' ? profile.name : profile.fullName, body, createdAt: new Date().toISOString() });
  });
  return { ok: true };
};
// Actions available through POST /api/call. Each receives the authenticated uid.
export const handlers = { saveProfile, setProfilePhoto, saveOrgInfo, savePet, setPetCaretaker, togglePet, submitApplication, changeApplication, sendMessage, createDonation, startMercadoPagoConnection };
