import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { errorMessage } from '../backend/firebase';
import { photoUri } from '../backend/photos';
import { colors, styles as s } from '../ui';
type InputProps = { label: string; value: string; onChange: (value: string) => void; password?: boolean; email?: boolean; numeric?: boolean; multiline?: boolean; maxLength?: number; placeholder?: string; right?: React.ReactNode };
export function Input({ label, value, onChange, password = false, email = false, numeric = false, multiline = false, maxLength = 120, placeholder, right }: InputProps) {
  const [hidden, setHidden] = useState(true);
  const accessory = password ? <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'} onPress={() => setHidden(!hidden)} hitSlop={8} style={{ paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.green, fontWeight: '700' }}>{hidden ? 'Mostrar' : 'Ocultar'}</Text></Pressable> : right;
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><View style={[s.input, { flexDirection: 'row', alignItems: 'center', padding: 0, paddingVertical: 0, paddingHorizontal: 0 }]}><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.muted} style={{ flex: 1, alignSelf: 'stretch', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, minHeight: 50, outlineWidth: 0 }} value={value} onChangeText={onChange} secureTextEntry={password && hidden} keyboardType={email ? 'email-address' : numeric ? 'number-pad' : 'default'} autoCapitalize={email || password ? 'none' : 'sentences'} autoCorrect={!email && !password} multiline={multiline} maxLength={maxLength} />{accessory}</View></View>;
}
export type Place = { city: string; state: string; cityCode: string };
export async function fetchPlace(postalCode: string): Promise<Place> {
  const digits = postalCode.replace(/\D/g, '');
  if (digits.length !== 8) throw Error('Informe um CEP com 8 números.');
  let response: Response;
  try { response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: AbortSignal.timeout(10000) }); } catch { throw Error('Não foi possível consultar o CEP.'); }
  if (!response.ok) throw Error('Não foi possível consultar o CEP.');
  const data = await response.json();
  if (data.erro || !data.localidade) throw Error('CEP não encontrado.');
  return { city: data.localidade, state: data.uf, cityCode: String(data.ibge || '') };
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
export function StoredPhoto({ path, label, style }: { path: string; label: string; style?: StyleProp<ImageStyle> }) {
  if (style) return <View style={[style as StyleProp<ViewStyle>, { overflow: 'hidden', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }]}><StoredPhotoContent path={path} label={label} fill /></View>;
  return <StoredPhotoContent path={path} label={label} />;
}
function StoredPhotoContent({ path, label, fill = false }: { path: string; label: string; fill?: boolean }) {
  const [loaded, setLoaded] = useState<{ path: string; uri: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (path) photoUri(path).then(uri => { if (active) setLoaded({ path, uri, error: '' }); }).catch(() => { if (active) setLoaded({ path, uri: '', error: 'Não foi possível carregar a foto.' }); });
    return () => { active = false; };
  }, [path]);
  if (!path) return <Text style={s.muted}>Sem foto cadastrada.</Text>;
  if (loaded?.path !== path) return <ActivityIndicator accessibilityLabel="Carregando foto" />;
  return loaded.error ? <Text style={s.muted}>{loaded.error}</Text> : <Image accessibilityLabel={label} source={{ uri: loaded.uri }} style={fill ? StyleSheet.absoluteFill : { width: '100%', height: 240, borderRadius: 14 }} resizeMode="cover" />;
}
