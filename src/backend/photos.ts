import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { apiBase, apiFetch, idToken } from './api';
export type Photo = { uri: string; mime: string; size?: number };
export type PhotoKind = 'pet' | 'avatar' | 'home';
const MAX_SIDE = 1600;

export async function pickPhoto(): Promise<Photo | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  // Resize and re-encode as JPEG: keeps uploads well under the 4 MB server limit and strips metadata (e.g. GPS).
  let context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_SIDE || asset.height > MAX_SIDE) context = context.resize(asset.width >= asset.height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, mime: 'image/jpeg' };
}

export function uniqueId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }

// The server picks the folder and file name; it returns the stored path.
export async function uploadPhoto(photo: Photo, kind: PhotoKind, petId?: string) {
  const blob = await (await fetch(photo.uri)).blob();
  if (blob.size > 4 * 1024 * 1024) throw Error('A foto deve ter no máximo 4 MB.');
  const query = new URLSearchParams({ kind, ...(petId ? { petId } : {}) });
  const response = await apiFetch(`/api/upload?${query}`, { method: 'POST', headers: { 'Content-Type': photo.mime }, body: blob });
  return (await response.json() as { path: string }).path;
}

// Photos are private (login required). Stored paths never change content (each upload gets a new
// name), so the path is a safe cache key.
export type PhotoSource = { uri: string; headers?: Record<string, string>; cacheKey: string };
const webCache = new Map<string, Promise<string>>();
export async function photoSource(path: string): Promise<PhotoSource> {
  // Native: expo-image downloads with the token header and keeps the file in its disk cache.
  if (Platform.OS !== 'web') return { uri: `${apiBase}/api/photo?${new URLSearchParams({ path })}`, headers: { Authorization: `Bearer ${await idToken()}` }, cacheKey: path };
  // Web: download once per session as an object URL (no base64 conversion).
  let uri = webCache.get(path);
  if (!uri) {
    uri = apiFetch(`/api/photo?${new URLSearchParams({ path })}`).then(async response => URL.createObjectURL(await response.blob()));
    uri.catch(() => webCache.delete(path));
    webCache.set(path, uri);
  }
  return { uri: await uri, cacheKey: path };
}
