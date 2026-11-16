import * as ImagePicker from 'expo-image-picker';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
export type Photo = { uri: string; mime: string; size?: number };
export async function pickPhoto(): Promise<Photo | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || (asset.uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw Error('Escolha JPG, PNG ou WebP.');
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw Error('A foto deve ter no máximo 5 MB.');
  return { uri: asset.uri, mime, size: asset.fileSize };
}
export function uniqueId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
export async function uploadPhoto(photo: Photo, folder: string) {
  if (!storage) throw Error('O envio de fotos ainda não está disponível.');
  const blob = await (await fetch(photo.uri)).blob();
  if (blob.size > 5 * 1024 * 1024) throw Error('A foto deve ter no máximo 5 MB.');
  const extension = photo.mime === 'image/png' ? 'png' : photo.mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${uniqueId()}.${extension}`;
  await uploadBytes(ref(storage, path), blob, { contentType: photo.mime });
  return path;
}
export async function photoUri(path: string) {
  if (!storage) throw Error('Fotos indisponíveis.');
  const bytes = await getBytes(ref(storage, path), 5 * 1024 * 1024);
  const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
    reader.readAsDataURL(new Blob([bytes], { type: mime }));
  });
}
