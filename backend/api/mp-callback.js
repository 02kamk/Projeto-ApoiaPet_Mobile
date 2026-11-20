import { mercadoPagoCallback } from '../lib/payments.js';
// GET /api/mp-callback: Mercado Pago OAuth redirect (protected by single-use state + PKCE).
export const GET = mercadoPagoCallback;
