import { createHmac, timingSafeEqual } from 'node:crypto';
export function validSignature({ signature, requestId, paymentId, secret, now = Date.now() }) {
  if (!signature || !requestId || !paymentId || !secret) return false;
  const values = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  const timestamp = Number(values.ts);
  const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (!Number.isFinite(milliseconds) || Math.abs(now - milliseconds) > 10 * 60000 || !/^[a-f\d]{64}$/i.test(values.v1 || '')) return false;
  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${values.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(values.v1, 'hex'));
}
export async function mpRequest(path, token, body, fetcher = fetch, key) {
  const response = await fetcher(`https://api.mercadopago.com${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'X-Idempotency-Key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error('O Mercado Pago não concluiu a solicitação. Confira a conexão da ONG e tente novamente.');
  return response.json();
}
