import { mercadoPagoWebhook } from '../lib/payments.js';
// POST /api/mp-webhook: payment notifications (protected by HMAC signature).
export const POST = mercadoPagoWebhook;
