import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';
import { errorMessage } from '../backend/firebase';
import { photoUri } from '../backend/photos';
import { styles as s } from '../ui';
export function Input({ label, value, onChange, password = false, email = false, numeric = false, multiline = false, maxLength = 120 }: { label: string; value: string; onChange: (value: string) => void; password?: boolean; email?: boolean; numeric?: boolean; multiline?: boolean; maxLength?: number }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} secureTextEntry={password} keyboardType={email ? 'email-address' : numeric ? 'number-pad' : 'default'} autoCapitalize={email || password ? 'none' : 'sentences'} autoCorrect={!email && !password} multiline={multiline} maxLength={maxLength} /></View>;
}
export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, message, setMessage, run };
}
export function Feedback({ message }: { message: string }) { return message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null; }
export function StoredPhoto({ path, label }: { path: string; label: string }) {
  const [loaded, setLoaded] = useState<{ path: string; uri: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (path) photoUri(path).then(uri => { if (active) setLoaded({ path, uri, error: '' }); }).catch(() => { if (active) setLoaded({ path, uri: '', error: 'Não foi possível carregar a foto.' }); });
    return () => { active = false; };
  }, [path]);
  if (!path) return <Text style={s.muted}>Sem foto cadastrada.</Text>;
  if (loaded?.path !== path) return <ActivityIndicator accessibilityLabel="Carregando foto" />;
  return loaded.error ? <Text style={s.muted}>{loaded.error}</Text> : <Image accessibilityLabel={label} source={{ uri: loaded.uri }} style={{ width: '100%', height: 240, borderRadius: 14 }} resizeMode="cover" />;
}
