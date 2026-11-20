import { readPhoto } from '../lib/photos.js';
import { authenticate, route } from '../lib/runtime.js';
// GET /api/photo?path=...  Streams a private photo after checking who may see it.
export const GET = route(['GET'], async request => {
  const uid = await authenticate(request);
  return readPhoto(uid, new URL(request.url).searchParams.get('path'));
});
export const OPTIONS = GET;
