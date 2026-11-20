import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { apiFetch } from './api';
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

// Photos are private: they are downloaded with the user's token and shown as a data URI.
export async function photoUri(path: string) {
  const response = await apiFetch(`/api/photo?${new URLSearchParams({ path })}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
