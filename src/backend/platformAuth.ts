import { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const createAuth = (app: FirebaseApp) => getAuth(app);
