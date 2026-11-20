import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { UserError } from './core.js';

// Production: FIREBASE_SERVICE_ACCOUNT holds the service account JSON.
// Local emulators/tests: FIREBASE_PROJECT_ID only (with FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST).
function app() {
  if (getApps().length) return getApps()[0];
  const account = process.env.FIREBASE_SERVICE_ACCOUNT;
  return account
    ? initializeApp({ credential: cert(JSON.parse(account)) })
    : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-apoiapet' });
}
export const db = getFirestore(app());
export const adminAuth = getAuth(app());

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function getProfile(uid, requiredRole) {
  const [pub, priv] = await Promise.all([db.doc(`profiles/${uid}`).get(), db.doc(`privateProfiles/${uid}`).get()]);
  if (!pub.exists || !priv.exists || (requiredRole && pub.data().role !== requiredRole)) throw new UserError('Complete seu cadastro com o perfil correto.');
  return { ...pub.data(), ...priv.data() };
}

// Firebase ID token sent by the app as "Authorization: Bearer <token>".
export async function authenticate(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Entre na sua conta.');
  try { return (await adminAuth.verifyIdToken(token)).uid; }
  catch { throw new HttpError(401, 'Sua sessão expirou. Entre novamente.'); }
}

// Native apps send no Origin; browsers (Expo web) must be listed in ALLOWED_ORIGINS.
function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

// Wraps a route: CORS, OPTIONS and error mapping. Only UserError/HttpError messages reach the client.
export function route(methods, handler) {
  return async request => {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!methods.includes(request.method)) return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: cors });
    try {
      const response = await handler(request);
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    } catch (error) {
      if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status, headers: cors });
      if (error instanceof UserError) return Response.json({ error: error.message }, { status: 400, headers: cors });
      console.error(error);
      return Response.json({ error: 'Não foi possível concluir. Tente novamente em instantes.' }, { status: 500, headers: cors });
    }
  };
}
