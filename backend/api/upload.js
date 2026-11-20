import { savePhoto } from '../lib/photos.js';
import { authenticate, HttpError, route } from '../lib/runtime.js';
// POST /api/upload?kind=pet|avatar|home[&petId=...]  body: raw image bytes. Returns { path }.
export const POST = route(['POST'], async request => {
  const uid = await authenticate(request);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4 * 1024 * 1024) throw new HttpError(413, 'A foto deve ter no máximo 4 MB.');
  const query = new URL(request.url).searchParams;
  const bytes = new Uint8Array(await request.arrayBuffer());
  return Response.json({ path: await savePhoto(uid, query.get('kind'), query.get('petId'), bytes) });
});
export const OPTIONS = POST;
