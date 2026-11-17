import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fullName, phone, cep, passwordRequirements, scheduledDate, decide, paymentMatches, cents } from '../core.js';
import { validSignature, mpRequest } from '../gateway.js';
test('cadastro: nome completo, senha forte, CEP e telefone brasileiro', () => {
  assert.equal(fullName('  João  da Silva '), 'João da Silva');
  for (const invalid of ['João', '', '123 Silva', 'João @Silva']) assert.throws(() => fullName(invalid));
  for (const valid of ['11987654321', '(81) 98765-4321', '1134567890', '8534567890']) assert.ok(phone(valid));
  for (const invalid of ['1198765432', '00987654321', '20987654321', '119876543210', '11887654321', '+5511987654321', 'abcdefghijk']) assert.throws(() => phone(invalid));
  assert.equal(cep('01001-000'), '01001000');
  for (const invalid of ['123', '0100a000', '010010000']) assert.throws(() => cep(invalid));
  assert.ok(passwordRequirements('Forte!12345').every(Boolean));
  for (const invalid of ['Aa1!short', 'somente123!', 'SOMENTE123!', 'SemNumeros!', 'SemEspecial123']) assert.ok(!passwordRequirements(invalid).every(Boolean));
});
test('ciclo de adoção exige aprovação, agendamento e confirmação da retirada', () => {
  assert.equal(decide('sent', 'review'), 'in_review');
  assert.equal(decide('in_review', 'request_info'), 'needs_info');
  assert.equal(decide('needs_info', 'review'), 'in_review');
  assert.equal(decide('in_review', 'approve'), 'approved');
  assert.equal(decide('approved', 'schedule'), 'scheduled');
  assert.equal(decide('scheduled', 'complete'), 'adopted');
  assert.equal(decide('scheduled', 'schedule'), 'scheduled');
  assert.equal(decide('scheduled', 'cancel'), 'cancelled');
  for (const [status, action] of [['sent', 'complete'], ['sent', 'schedule'], ['approved', 'complete'], ['adopted', 'schedule'], ['cancelled', 'approve'], ['rejected', 'review']]) assert.throws(() => decide(status, action));
});
test('agenda recusa passado e datas fora do intervalo', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(scheduledDate('2026-11-15T10:00:00-03:00', now), '2026-11-15T13:00:00.000Z');
  for (const invalid of ['invalid', '2026-11-13T12:00:00Z', '2028-11-13T12:00:00Z']) assert.throws(() => scheduledDate(invalid, now));
});
test('pagamento confere valor, moeda, referência e recebedor', () => {
  const payment = { external_reference: 'donation-1', currency_id: 'BRL', transaction_amount: 25.5, collector_id: 123 };
  const record = { id: 'donation-1', amountCents: 2550 };
  assert.ok(paymentMatches(payment, record, '123'));
  for (const change of [{ currency_id: 'USD' }, { transaction_amount: 2.55 }, { external_reference: 'other' }, { collector_id: 999 }]) assert.equal(paymentMatches({ ...payment, ...change }, record, '123'), false);
  for (const invalid of [0, -100, 1.5, 1000001, NaN]) assert.throws(() => cents(invalid));
});
test('webhook valida assinatura HMAC e recusa adulteração/replay antigo', () => {
  const secret = 'test-secret'; const now = 1800000000000; const ts = String(now);
  const v1 = createHmac('sha256', secret).update(`id:123;request-id:req;ts:${ts};`).digest('hex');
  const request = { signature: `ts=${ts},v1=${v1}`, requestId: 'req', paymentId: '123', secret, now };
  assert.equal(validSignature(request), true);
  for (const change of [{ secret: 'wrong' }, { paymentId: '456' }, { requestId: 'other' }, { signature: 'ts=1,v1=bad' }, { now: now + 11 * 60000 }]) assert.equal(validSignature({ ...request, ...change }), false);
});
test('gateway envia autenticação e idempotência somente ao servidor do provedor', async () => {
  let request;
  const fetcher = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ id: 'preference' }) }; };
  const result = await mpRequest('/checkout/preferences', 'server-token', { external_reference: 'donation' }, fetcher, 'request-key');
  assert.equal(result.id, 'preference');
  assert.equal(request.url, 'https://api.mercadopago.com/checkout/preferences');
  assert.equal(request.options.headers.Authorization, 'Bearer server-token');
  assert.equal(request.options.headers['X-Idempotency-Key'], 'request-key');
  await assert.rejects(mpRequest('/test', 'token', {}, async () => ({ ok: false })), /Mercado Pago/);
});
