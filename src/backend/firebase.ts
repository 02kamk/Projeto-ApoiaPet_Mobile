import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import { createAuth } from './platformAuth';

const localRequested = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
if (localRequested && !__DEV__) throw Error('Desative o modo de emuladores antes de gerar uma versão de produção.');
export const usingEmulators = localRequested && __DEV__;
const config = usingEmulators ? {
  apiKey: 'demo-apoiapet-key',
  authDomain: 'demo-apoiapet.firebaseapp.com',
  projectId: 'demo-apoiapet',
  appId: '1:123456789:web:demo-apoiapet',
  storageBucket: 'demo-apoiapet.appspot.com',
} : {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};
export const firebaseConfigured = !!(config.apiKey && config.authDomain && config.projectId && config.appId);
const appName = usingEmulators ? 'apoiapet-local' : '[DEFAULT]';
const app = firebaseConfigured ? (getApps().find(item => item.name === appName) ?? initializeApp(config, appName)) : null;
export const auth = app ? createAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app, 'southamerica-east1') : null;
export const storage = app && config.storageBucket ? getStorage(app) : null;
// Keep connections stable across Fast Refresh, before any auth listener or query starts.
const runtime = globalThis as typeof globalThis & { apoiapetEmulators?: WeakSet<object> };
runtime.apoiapetEmulators ??= new WeakSet();
if (usingEmulators && app && auth && db && functions && storage && !runtime.apoiapetEmulators.has(app)) {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
  runtime.apoiapetEmulators.add(app);
}

export function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre ou recupere sua senha.',
    'auth/weak-password': 'Use 10 caracteres ou mais, maiúscula, minúscula, número e caractere especial.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
    'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet.',
    'permission-denied': 'Acesso negado. Confira as regras do Firestore e seu perfil.',
    'unavailable': 'Banco indisponível. Verifique a conexão e tente novamente.',
  };
  if (code?.startsWith('functions/') && error instanceof Error) return error.message.replace(/^Firebase:\s*/, '');
  return code ? messages[code] ?? 'Não foi possível concluir. Verifique sua conexão e tente novamente.' : error instanceof Error ? error.message : 'Não foi possível concluir.';
}
