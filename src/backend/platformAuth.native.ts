import { FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Metro selects the React Native export; Firebase's default TS types describe web.
const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
export function createAuth(app: FirebaseApp) {
  try {
    return FirebaseAuth.initializeAuth(app, { persistence: nativeAuth.getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return FirebaseAuth.getAuth(app);
    throw error;
  }
}
