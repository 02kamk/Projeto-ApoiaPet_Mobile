import { createHash, randomBytes } from 'node:crypto';
import { db, getProfile as profile } from './runtime.js';
import { UserError, cents, text, paymentMatches } from './core.js';
import { mpRequest, validSignature } from './gateway.js';
// Configured as Vercel environment variables. Secrets never reach the app.
const env = name => process.env[name] || '';
const clientId = () => env('MP_CLIENT_ID');
const appUrl = () => env('APP_URL');
const backendUrl = () => env('BACKEND_URL').replace(/\/+$/, '');
const paymentsEnabled = () => env('PAYMENTS_ENABLED') === 'true';
const callbackUrl = () => `${backendUrl()}/api/mp-callback`;
function requireEnabled() {
  if (!paymentsEnabled() || !/^https:\/\//.test(appUrl()) || !/^https:\/\//.test(backendUrl()) || !clientId() || !env('MP_CLIENT_SECRET') || !env('MP_WEBHOOK_SECRET')) throw new UserError('Pagamentos reais ainda não foram configurados pelo responsável do aplicativo.');
}
async function oauthToken(body) {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId(), client_secret: env('MP_CLIENT_SECRET'), ...body }),
  });
  if (!response.ok) throw new UserError('Não foi possível autorizar a conta no Mercado Pago. Reconecte sua conta.');
  const result = await response.json();
  if (!result.access_token || !result.user_id || !result.expires_in) throw new UserError('Resposta inválida do Mercado Pago.');
  return { accessToken: result.access_token, refreshToken: result.refresh_token || '', collectorId: String(result.user_id), expiresAt: Date.now() + result.expires_in * 1000 };
}
async function recipientToken(uid) {
  const ref = db.doc(`paymentCredentials/${uid}`);
  const current = (await ref.get()).data();
  if (!current) throw new UserError('Esta ONG ainda não conectou a conta do Mercado Pago.');
  if (current.expiresAt > Date.now() + 3600000) return current;
  if (!current.refreshToken) throw new UserError('A ONG precisa reconectar sua conta do Mercado Pago.');
  // Serialize refresh attempts: refresh tokens are single use.
  await db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    if (!record || record.refreshingUntil > Date.now()) throw new UserError('Atualizando conexão da ONG. Tente novamente em instantes.');
    transaction.update(ref, { refreshingUntil: Date.now() + 60000 });
  });
  try {
    const renewed = await oauthToken({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
    if (renewed.collectorId !== current.collectorId) throw new UserError('Recebedor inválido. Reconecte a conta.');
    await ref.set({ ...renewed, refreshingUntil: 0 });
    return renewed;
  } catch (error) {
    await ref.update({ refreshingUntil: 0 });
    throw error;
  }
}
export const startMercadoPagoConnection = async uid => {
  requireEnabled(); await profile(uid, 'ong');
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  await db.doc(`oauthStates/${state}`).create({ uid, verifier, expiresAt: Date.now() + 10 * 60000 });
  const params = new URLSearchParams({ client_id: clientId(), response_type: 'code', platform_id: 'mp', state,
    redirect_uri: callbackUrl(), code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { url: `https://auth.mercadopago.com/authorization?${params}` };
};
// GET /api/mp-callback: Mercado Pago redirects the ONG's browser here after authorization.
export async function mercadoPagoCallback(request) {
  try {
    requireEnabled();
    const query = new URL(request.url).searchParams;
    const state = query.get('state') || '';
    const code = query.get('code') || '';
    if (!/^[a-f\d]{64}$/.test(state) || !code || code.length > 500) throw new UserError('Autorização inválida.');
    const ref = db.doc(`oauthStates/${state}`);
    const record = await db.runTransaction(async transaction => {
      const document = await transaction.get(ref);
      if (!document.exists || document.data().expiresAt < Date.now()) throw new UserError('Autorização expirada.');
      transaction.delete(ref); return document.data();
    });
    const token = await oauthToken({ grant_type: 'authorization_code', code, code_verifier: record.verifier, redirect_uri: callbackUrl() });
    const existing = await db.doc(`paymentCredentials/${record.uid}`).get();
    if (existing.exists && existing.data().collectorId !== token.collectorId) throw new UserError('Use a mesma conta recebedora já vinculada.');
    const batch = db.batch();
    batch.set(db.doc(`paymentCredentials/${record.uid}`), token);
    batch.set(db.doc(`paymentConnections/${record.uid}`), { connected: true, connectedAt: new Date().toISOString() });
    await batch.commit();
    return new Response(null, { status: 303, headers: { Location: appUrl() } });
  } catch (error) {
    if (!(error instanceof UserError)) console.error(error);
    return new Response('Não foi possível conectar. Volte ao ApoiaPet e reinicie a autorização.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
export const createDonation = async (uid, data) => {
  const donor = await profile(uid, 'donor');
  const ongId = text(data.ongId, 'ONG', 150);
  if (!/^[\w-]+$/.test(ongId)) throw new UserError('ONG inválida.');
  const ong = await profile(ongId, 'ong');
  const amountCents = cents(data.amountCents);
  if (!['test', 'mercadopago'].includes(data.mode)) throw new UserError('Modo de pagamento inválido.');
  // Test donations are confirmed without money; never allow them once real payments are on.
  if (data.mode === 'test' && paymentsEnabled()) throw new UserError('Doações de teste estão desativadas.');
  if (data.mode === 'mercadopago') requireEnabled();
  const requestId = text(data.requestId, 'Identificador', 100);
  if (!/^[\w-]{16,100}$/.test(requestId)) throw new UserError('Identificador inválido.');
  const id = `${uid}_${requestId}`;
  const ref = db.doc(`donations/${id}`);
  const existing = await db.runTransaction(async transaction => {
    const doc = await transaction.get(ref);
    if (doc.exists) {
      const old = doc.data();
      if (old.ongId !== ongId || old.amountCents !== amountCents || old.mode !== data.mode) throw new UserError('Este identificador já foi usado para outra contribuição.');
      return old;
    }
    const now = new Date().toISOString();
    // Não existe aprovação de doação: a doação de teste já nasce concluída.
    transaction.create(ref, { donorId: uid, donorName: donor.fullName, ongId, ongName: ong.name, amountCents, mode: data.mode,
      status: data.mode === 'test' ? 'confirmed' : 'creating', createdAt: now, ...(data.mode === 'test' && { confirmedAt: now }), checkoutUrl: '' });
    return null;
  });
  if (existing) {
    if (existing.status === 'creating') throw new UserError('Sua contribuição está sendo preparada. Consulte o histórico antes de tentar outra vez.');
    return { id, url: existing.checkoutUrl || '' };
  }
  if (data.mode === 'test') return { id, url: '' };
  try {
    const token = await recipientToken(ongId);
    const preference = await mpRequest('/checkout/preferences', token.accessToken, {
      items: [{ id, title: `Apoio ao abrigo ${ong.name}`, quantity: 1, unit_price: amountCents / 100, currency_id: 'BRL' }],
      external_reference: id,
      notification_url: `${backendUrl()}/api/mp-webhook?donationId=${encodeURIComponent(id)}`,
      back_urls: { success: appUrl(), failure: appUrl(), pending: appUrl() }, auto_return: 'approved',
    }, fetch, id);
    if (!preference.init_point || !preference.id) throw new UserError('Checkout indisponível.');
    const checkoutUrl = String(preference.init_point);
    if (!/^https:\/\/([\w-]+\.)?mercadopago\.com(\.br)?\//.test(checkoutUrl)) throw new UserError('Endereço de checkout inválido.');
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
};
// POST /api/mp-webhook: payment notifications, authenticated by the HMAC signature.
export async function mercadoPagoWebhook(request) {
  const status = code => new Response(null, { status: code });
  if (request.method !== 'POST') return status(405);
  const query = new URL(request.url).searchParams;
  const paymentId = query.get('data.id') || '';
  if (!validSignature({ signature: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'), paymentId, secret: env('MP_WEBHOOK_SECRET') })) return status(401);
  try {
    if (!/^\d+$/.test(paymentId)) return status(400);
    const donationId = query.get('donationId') || '';
    if (!/^[\w-]{16,300}$/.test(donationId)) return status(400);
    const ref = db.doc(`donations/${donationId}`);
    const record = (await ref.get()).data();
    if (!record || record.mode !== 'mercadopago') return status(404);
    const token = await recipientToken(record.ongId);
    const payment = await mpRequest(`/v1/payments/${paymentId}`, token.accessToken);
    if (!paymentMatches(payment, { id: donationId, amountCents: record.amountCents }, token.collectorId)) return status(400);
    const statuses = { approved: 'confirmed', refunded: 'refunded', charged_back: 'charged_back', rejected: 'rejected', cancelled: 'cancelled', pending: 'pending', in_process: 'pending', authorized: 'pending' };
    const next = statuses[payment.status];
    if (!next) return status(200);
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      const attemptRef = ref.collection('attempts').doc(paymentId);
      const providerUpdatedAt = payment.date_last_updated || payment.date_created;
      if (!providerUpdatedAt || !Number.isFinite(Date.parse(providerUpdatedAt))) return;
      transaction.set(attemptRef, { status: next, providerUpdatedAt, amountCents: record.amountCents });
      if (current.paymentId && current.paymentId !== paymentId && ['confirmed', 'refunded', 'charged_back'].includes(current.status)) {
        if (next === 'confirmed') transaction.update(ref, { needsReconciliation: true });
        return;
      }
      if (current.paymentId === paymentId && current.providerUpdatedAt && Date.parse(current.providerUpdatedAt) > Date.parse(providerUpdatedAt)) return;
      transaction.update(ref, { status: next, paymentId, method: payment.payment_type_id || '', providerUpdatedAt, updatedAt: new Date().toISOString() });
    });
    return status(200);
  } catch (error) {
    console.error(error);
    return status(503); // Mercado Pago retries later.
  }
}
