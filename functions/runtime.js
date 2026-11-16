import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });
export const db = getFirestore();
export function callable(handler, options = {}) {
  return onCall(options, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    try { return await handler(request.auth.uid, request.data ?? {}); }
    catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('failed-precondition', error.message || 'Não foi possível concluir.');
    }
  });
}
