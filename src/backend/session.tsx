import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, errorMessage, functions } from './firebase';
import { cep, fullName, passwordRequirements, phone } from '../../functions/core';
export type Role = 'donor' | 'ong';
export type Profile = { name: string; role: Role; city: string; state: string; cityCode: string; fullName: string; phone: string; cep: string; neighborhood: string; street: string };
export type ProfileInput = { role: Role; fullName: string; ongName: string; phone: string; cep: string };
export async function call<T = { ok: boolean }>(name: string, data: unknown): Promise<T> {
  if (!functions) throw Error('O serviço ainda não está disponível.');
  const response = await httpsCallable<unknown, T>(functions, name)(data);
  return response.data;
}
function useSessionState() {
  const [user, setUser] = useState<User | null>(null);
  const [pub, setPub] = useState<Partial<Profile> | null>(null);
  const [priv, setPriv] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(!!auth);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth || !db) return;
    let cleanup: (() => void)[] = [];
    let generation = 0;
    const stop = onAuthStateChanged(auth, next => {
      cleanup.forEach(fn => fn()); cleanup = [];
      const version = ++generation;
      setUser(next); setPub(null); setPriv(null); setError('');
      if (!next) { setLoading(false); return; }
      setLoading(true);
      let received = 0;
      const failure = (err: unknown) => { if (version === generation) { setError(errorMessage(err)); setLoading(false); } };
      for (const [path, setter] of [['profiles', setPub], ['privateProfiles', setPriv]] as const) {
        let first = true;
        cleanup.push(onSnapshot(doc(db!, path, next.uid), snapshot => {
          if (version !== generation) return;
          setter(snapshot.exists() ? snapshot.data() : null);
          if (first) { received++; first = false; }
          if (received === 2) setLoading(false);
        }, failure));
      }
    });
    return () => { generation++; stop(); cleanup.forEach(fn => fn()); };
  }, []);
  const profile = pub && priv ? { ...pub, ...priv } as Profile : null;
  const validateProfile = (value: ProfileInput) => {
    fullName(value.fullName); phone(value.phone); cep(value.cep);
    if (value.role === 'ong' && !value.ongName.trim()) throw Error('Informe o nome da ONG.');
  };
  const saveProfile = async (value: ProfileInput) => { validateProfile(value); await call('saveProfile', value); };
  return {
    user, profile, loading, error, saveProfile,
    login: async (email: string, password: string) => { if (!auth) throw Error('O serviço de conta ainda não está disponível.'); await signInWithEmailAndPassword(auth, email.trim(), password); },
    register: async (email: string, password: string, value: ProfileInput) => {
      if (!auth) throw Error('O serviço de conta ainda não está disponível.');
      validateProfile(value);
      if (!passwordRequirements(password).every(Boolean)) throw Error('A senha deve ter 10 caracteres ou mais, maiúscula, minúscula, número e caractere especial.');
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      await saveProfile(value);
    },
    reset: async (email: string) => { if (!auth) throw Error('O serviço de conta ainda não está disponível.'); if (!email.trim()) throw Error('Informe seu e-mail.'); await sendPasswordResetEmail(auth, email.trim()); },
    logout: async () => { if (auth) await signOut(auth); },
  };
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function SessionProvider({ children }: React.PropsWithChildren) { const value = useSessionState(); return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>; }
export function useSession() { const value = useContext(SessionContext); if (!value) throw Error('SessionProvider ausente.'); return value; }
