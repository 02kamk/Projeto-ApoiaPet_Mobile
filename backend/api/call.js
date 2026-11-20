import { handlers } from '../lib/handlers.js';
import { authenticate, HttpError, route } from '../lib/runtime.js';
// POST /api/call  { name: 'savePet', data: {...} }  — every app action goes through here.
export const POST = route(['POST'], async request => {
  const uid = await authenticate(request);
  let body;
  try { body = await request.json(); } catch { throw new HttpError(400, 'Requisição inválida.'); }
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!Object.hasOwn(handlers, name)) throw new HttpError(404, 'Ação desconhecida.');
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  return Response.json(await handlers[name](uid, data));
});
export const OPTIONS = POST;
