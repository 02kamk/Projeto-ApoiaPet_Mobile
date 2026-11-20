import { createHash, randomBytes } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { db, callable } from './runtime.js';
import { cents, text, paymentMatches, id as safeId } from './core.js';
import { mpRequest, validSignature } from './gateway.js';
const clientId = defineString('MP_CLIENT_ID', { default: '' });
const appUrl = defineString('APP_URL', { default: '' });
const backendUrl = defineString('BACKEND_URL', { default: '' });
const paymentsEnabled = defineString('PAYMENTS_ENABLED', { default: 'false' });
const clientSecret = defineSecret('MP_CLIENT_SECRET');
const webhookSecret = defineSecret('MP_WEBHOOK_SECRET');
const secretOptions = { secrets: [clientSecret] };
function requireEnabled() {
  if (process.env.FUNCTIONS_EMULATOR === 'true') throw Error('Pagamentos reais estão desativados no ambiente local.');
  if (paymentsEnabled.value() !== 'true' || !/^https:\/\//.test(appUrl.value()) || !/^https:\/\//.test(backendUrl.value()) || !clientId.value()) throw Error('Pagamentos reais ainda não foram configurados pelo responsável do aplicativo.');
}
async function profile(uid, role) {
  const [pub, priv] = await Promise.all([db.doc(`profiles/${uid}`).get(), db.doc(`privateProfiles/${uid}`).get()]);
  if (pub.data()?.role !== role || !priv.exists) throw Error('Complete seu cadastro com o perfil correto.');
  return { ...pub.data(), ...priv.data() };
}
async function oauthToken(body) {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId.value(), client_secret: clientSecret.value(), ...body }),
  });
  if (!response.ok) throw Error('Não foi possível autorizar a conta no Mercado Pago. Reconecte sua conta.');
  const result = await response.json();
  if (!result.access_token || !result.user_id || !result.expires_in) throw Error('Resposta inválida do Mercado Pago.');
  return { accessToken: result.access_token, refreshToken: result.refresh_token || '', collectorId: String(result.user_id), expiresAt: Date.now() + result.expires_in * 1000 };
}
async function recipientToken(uid) {
  const ref = db.doc(`paymentCredentials/${uid}`);
  const current = (await ref.get()).data();
  if (!current) throw Error('Esta ONG ainda não conectou a conta do Mercado Pago.');
  if (current.expiresAt > Date.now() + 3600000) return current;
  if (!current.refreshToken) throw Error('A ONG precisa reconectar sua conta do Mercado Pago.');
  // Serialize refresh attempts: refresh tokens are single use.
  const lock = randomBytes(16).toString('hex');
  await db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    if (record.refreshingUntil > Date.now()) throw Error('Atualizando conexão da ONG. Tente novamente em instantes.');
    transaction.update(ref, { refreshingUntil: Date.now() + 60000, refreshLock: lock });
  });
  try {
    const renewed = await oauthToken({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
    if (renewed.collectorId !== current.collectorId) throw Error('Recebedor inválido. Reconecte a conta.');
    await ref.set({ ...renewed, refreshingUntil: 0, refreshLock: '' });
    return renewed;
  } catch (error) {
    await ref.update({ refreshingUntil: 0, refreshLock: '' });
    throw error;
  }
}
export const startMercadoPagoConnection = callable(async uid => {
  requireEnabled(); await profile(uid, 'ong');
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  await db.doc(`oauthStates/${state}`).create({ uid, verifier, expiresAt: Date.now() + 10 * 60000 });
  const params = new URLSearchParams({ client_id: clientId.value(), response_type: 'code', platform_id: 'mp', state,
    redirect_uri: `${backendUrl.value()}/mercadoPagoCallback`, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { url: `https://auth.mercadopago.com/authorization?${params}` };
}, secretOptions);
export const mercadoPagoCallback = onRequest(secretOptions, async (request, response) => {
  try {
    requireEnabled();
    const state = String(request.query.state || '');
    if (!/^[a-f\d]{64}$/.test(state) || typeof request.query.code !== 'string') throw Error('Autorização inválida.');
    const ref = db.doc(`oauthStates/${state}`);
    const record = await db.runTransaction(async transaction => {
      const document = await transaction.get(ref);
      if (!document.exists || document.data().expiresAt < Date.now()) throw Error('Autorização expirada.');
      transaction.delete(ref); return document.data();
    });
    const token = await oauthToken({ grant_type: 'authorization_code', code: request.query.code, code_verifier: record.verifier, redirect_uri: `${backendUrl.value()}/mercadoPagoCallback` });
    const existing = await db.doc(`paymentCredentials/${record.uid}`).get();
    if (existing.exists && existing.data().collectorId !== token.collectorId) throw Error('Use a mesma conta recebedora já vinculada.');
    const batch = db.batch();
    batch.set(db.doc(`paymentCredentials/${record.uid}`), token);
    batch.set(db.doc(`paymentConnections/${record.uid}`), { connected: true, connectedAt: new Date().toISOString() });
    await batch.commit();
    response.redirect(303, appUrl.value());
  } catch { response.status(400).send('Não foi possível conectar. Volte ao ApoiaPet e reinicie a autorização.'); }
});
export const createDonation = callable(async (uid, data) => {
  const donor = await profile(uid, 'donor');
  const ongId = text(data.ongId, 'ONG', 150);
  if (!/^[\w-]+$/.test(ongId)) throw Error('ONG inválida.');
  const ong = await profile(ongId, 'ong');
  const amountCents = cents(data.amountCents);
  if (!['test', 'mercadopago'].includes(data.mode)) throw Error('Modo de pagamento inválido.');
  if (data.mode === 'mercadopago') requireEnabled();
  const requestId = text(data.requestId, 'Identificador', 100);
  if (!/^[\w-]{16,100}$/.test(requestId)) throw Error('Identificador inválido.');
  const id = `${uid}_${requestId}`;
  const ref = db.doc(`donations/${id}`);
  const existing = await db.runTransaction(async transaction => {
    const doc = await transaction.get(ref);
    if (doc.exists) {
      const old = doc.data();
      if (old.ongId !== ongId || old.amountCents !== amountCents || old.mode !== data.mode) throw Error('Este identificador já foi usado para outra contribuição.');
      return old;
    }
    const now = new Date().toISOString();
    // Não existe aprovação de doação: a doação de teste já nasce concluída.
    transaction.create(ref, { donorId: uid, donorName: donor.fullName, ongId, ongName: ong.name, amountCents, mode: data.mode,
      status: data.mode === 'test' ? 'confirmed' : 'creating', createdAt: now, ...(data.mode === 'test' && { confirmedAt: now }), checkoutUrl: '' });
    return null;
  });
  if (existing) {
    if (existing.status === 'creating') throw Error('Sua contribuição está sendo preparada. Consulte o histórico antes de tentar outra vez.');
    return { id, url: existing.checkoutUrl || '' };
  }
  if (data.mode === 'test') return { id, url: '' };
  try {
    const token = await recipientToken(ongId);
    const preference = await mpRequest('/checkout/preferences', token.accessToken, {
      items: [{ id, title: `Apoio ao abrigo ${ong.name}`, quantity: 1, unit_price: amountCents / 100, currency_id: 'BRL' }],
      external_reference: id,
      notification_url: `${backendUrl.value()}/mercadoPagoWebhook?donationId=${encodeURIComponent(id)}`,
      back_urls: { success: appUrl.value(), failure: appUrl.value(), pending: appUrl.value() }, auto_return: 'approved',
    }, fetch, id);
    if (!preference.init_point || !preference.id) throw Error('Checkout indisponível.');
    const checkoutUrl = String(preference.init_point);
    if (!/^https:\/\/([\w-]+\.)?mercadopago\.com(\.br)?\//.test(checkoutUrl)) throw Error('Endereço de checkout inválido.');
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      transaction.update(ref, { status: current.status === 'creating' ? 'pending' : current.status, checkoutUrl, preferenceId: String(preference.id), collectorId: token.collectorId });
    });
    return { id, url: checkoutUrl };
  } catch (error) {
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      if (current.status === 'creating') transaction.update(ref, { status: 'checkout_error' });
    });
    throw error;
  }
}, secretOptions);
export const mercadoPagoWebhook = onRequest({ secrets: [clientSecret, webhookSecret] }, async (request, response) => {
  if (request.method !== 'POST') { response.sendStatus(405); return; }
  const paymentId = String(request.query['data.id'] || '');
  if (!validSignature({ signature: request.get('x-signature'), requestId: request.get('x-request-id'), paymentId, secret: webhookSecret.value() })) { response.sendStatus(401); return; }
  try {
    if (!/^\d+$/.test(paymentId)) throw Error('Pagamento inválido.');
    const donationId = String(request.query.donationId || '');
    if (!/^[\w-]{16,300}$/.test(donationId)) throw Error('Contribuição inválida.');
    const ref = db.doc(`donations/${donationId}`);
    const record = (await ref.get()).data();
    if (!record || record.mode !== 'mercadopago') { response.sendStatus(404); return; }
    const token = await recipientToken(record.ongId);
    const payment = await mpRequest(`/v1/payments/${paymentId}`, token.accessToken);
    if (!paymentMatches(payment, { id: donationId, amountCents: record.amountCents }, token.collectorId)) { response.sendStatus(400); return; }
    const statuses = { approved: 'confirmed', refunded: 'refunded', charged_back: 'charged_back', rejected: 'rejected', cancelled: 'cancelled', pending: 'pending', in_process: 'pending', authorized: 'pending' };
    const status = statuses[payment.status];
    if (!status) { response.sendStatus(200); return; }
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      const attemptRef = ref.collection('attempts').doc(paymentId);
      const providerUpdatedAt = payment.date_last_updated || payment.date_created;
      if (!providerUpdatedAt || !Number.isFinite(Date.parse(providerUpdatedAt))) return;
      transaction.set(attemptRef, { status, providerUpdatedAt, amountCents: record.amountCents });
      if (current.paymentId && current.paymentId !== paymentId && ['confirmed', 'refunded', 'charged_back'].includes(current.status)) {
        if (status === 'confirmed') transaction.update(ref, { needsReconciliation: true });
        return;
      }
      if (current.paymentId === paymentId && current.providerUpdatedAt && Date.parse(current.providerUpdatedAt) > Date.parse(providerUpdatedAt)) return;
      transaction.update(ref, { status, paymentId, method: payment.payment_type_id || '', providerUpdatedAt, updatedAt: new Date().toISOString() });
    });
    response.sendStatus(200);
  } catch { response.sendStatus(503); }
});
