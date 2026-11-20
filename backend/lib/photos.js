import { randomBytes } from 'node:crypto';
import { del, get, head, put } from '@vercel/blob';
import { UserError, id as safeId } from './core.js';
import { db, getProfile, HttpError } from './runtime.js';

// Every photo lives in one PRIVATE Blob store and is only served through /api/photo.
// Credentials: OIDC on Vercel (store connected to the project) or BLOB_READ_WRITE_TOKEN locally.
// Kept as an object so tests can replace the storage calls.
export const blob = {
  exists: async path => { try { await head(path); return true; } catch { return false; } },
  save: (path, bytes, contentType) => put(path, bytes, { access: 'private', contentType, addRandomSuffix: false }),
  read: path => get(path, { access: 'private' }),
  remove: path => del(path),
};

export const MAX_BYTES = 4 * 1024 * 1024; // Vercel request bodies are capped at 4.5 MB.
const signatures = [
  { type: 'image/jpeg', ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: 'image/webp', ext: 'webp', test: b => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP' },
];
// The real file type comes from its first bytes, never from what the client claims.
export function imageType(bytes) {
  return signatures.find(item => bytes.length > 12 && item.test(bytes)) ?? null;
}

// Folder chosen by the server from the user's role; the client never sends a path.
export async function uploadFolder(uid, kind, petId) {
  if (kind === 'pet') { await getProfile(uid, 'ong'); return `pets/${uid}`; }
  if (kind === 'home') { await getProfile(uid, 'donor'); return `homes/${uid}/${safeId(petId)}_${uid}`; }
  if (kind === 'avatar') { await getProfile(uid); return `avatars/${uid}`; }
  throw new UserError('Tipo de foto inválido.');
}

export async function savePhoto(uid, kind, petId, bytes) {
  if (bytes.length > MAX_BYTES) throw new UserError('A foto deve ter no máximo 4 MB.');
  const type = imageType(bytes);
  if (!type) throw new UserError('Use uma foto JPG, PNG ou WebP.');
  const path = `${await uploadFolder(uid, kind, petId)}/${Date.now()}-${randomBytes(12).toString('hex')}.${type.ext}`;
  await blob.save(path, bytes, type.type);
  return path;
}

// Checks a path the client sends back when saving a record (pet photo, avatar, home photos).
export async function validatePhoto(path, prefix) {
  if (typeof path !== 'string' || path.length > 300 || !path.startsWith(prefix) || !/^[\w/.-]+$/.test(path) || /\.\.|\/\//.test(path)) throw new UserError('Foto inválida.');
  if (!(await blob.exists(path))) throw new UserError('Foto não encontrada. Envie novamente.');
}

// Same access rules the old storage.rules had.
export async function canRead(uid, path) {
  if (typeof path !== 'string' || path.length > 300 || !/^[\w/.-]+$/.test(path) || /\.\.|\/\//.test(path)) return false;
  const parts = path.split('/');
  if ((parts[0] === 'pets' || parts[0] === 'avatars') && parts.length === 3) return true;
  if (parts[0] === 'homes' && parts.length === 4) {
    if (parts[1] === uid) return true;
    const application = (await db.doc(`applications/${parts[2]}`).get()).data();
    return !!application && application.ongId === uid && application.applicantId === parts[1];
  }
  return false;
}

export async function readPhoto(uid, path) {
  if (!(await canRead(uid, path))) throw new HttpError(404, 'Foto não encontrada.');
  const result = await blob.read(path);
  if (result?.statusCode !== 200 || !result.stream) throw new HttpError(404, 'Foto não encontrada.');
  return new Response(result.stream, { headers: {
    'Content-Type': result.blob.contentType || 'application/octet-stream',
    // File names are random and never overwritten, so the browser/app may cache them privately.
    'Cache-Control': 'private, max-age=86400, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
}
