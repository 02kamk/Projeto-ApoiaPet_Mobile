import { auth } from './firebase';

// Backend on Vercel (backend/ folder). Example: https://apoiapet-api.vercel.app
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
export const apiConfigured = /^https?:\/\//.test(apiUrl);

// Every request carries the user's Firebase ID token; the server verifies it.
export async function apiFetch(path: string, init: RequestInit = {}) {
  if (!apiConfigured) throw Error('O serviço ainda não está disponível.');
  const user = auth?.currentUser;
  if (!user) throw Error('Entre na sua conta.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  let response: Response;
  try { response = await fetch(`${apiUrl}${path}`, { ...init, headers }); }
  catch { throw Error('Não foi possível conectar. Verifique sua internet.'); }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw Error(body?.error || 'Não foi possível concluir. Tente novamente.');
  }
  return response;
}

// Runs an app action on the server (see backend/lib/handlers.js).
export async function call<T = { ok: boolean }>(name: string, data: unknown): Promise<T> {
  const response = await apiFetch('/api/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, data }) });
  return await response.json() as T;
}
