import React, { createContext, useContext, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

export const colors = {
  green: '#176B50',
  dark: '#102E24',
  bg: '#F5F8F5',
  text: '#172C24',
  muted: '#5B7166',
  border: '#DCE5DF',
  mint: '#E4F3EA',
  header: '#BFE3CD',
  headerDeep: '#86C7A3',
  soft: '#D3ECDC',
  white: '#FFFFFF',
};

// Tema por tipo de conta: doador usa o verde da marca; ONG usa verde-musgo.
export type Theme = { primary: string; header: string; headerDeep: string; soft: string; mint: string; tintLight: string; tintMid: string; blobs: [string, string, string, string] };
export const themes: Record<'donor' | 'ong', Theme> = {
  donor: { primary: colors.green, header: colors.header, headerDeep: colors.headerDeep, soft: colors.soft, mint: colors.mint, tintLight: '#7FC4A0', tintMid: '#3E9A72', blobs: ['#2E8A63', '#E9F7EE', '#5FAE86', '#CFEEDB'] },
  ong: { primary: '#4A5D23', header: '#DDE3C8', headerDeep: '#AAB884', soft: '#E3E8D2', mint: '#EEF1E4', tintLight: '#A3B27A', tintMid: '#6B7F3A', blobs: ['#5E7330', '#F4F6EC', '#8A9A5B', '#D9E0C2'] },
};
const ThemeContext = createContext<Theme>(themes.donor);
export function ThemeProvider({ theme, children }: React.PropsWithChildren<{ theme: Theme }>) { return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>; }
export function useTheme() { return useContext(ThemeContext); }
// Monta os estilos uma vez por tema; cada componente pega o conjunto do tema atual.
export function themedStyles<T>(make: (theme: Theme) => T) {
  const sheets = { donor: make(themes.donor), ong: make(themes.ong) };
  return function useThemedStyles() { return useTheme() === themes.ong ? sheets.ong : sheets.donor; };
}


type ButtonProps = { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean };

export function Button({ title, onPress, secondary = false, disabled = false }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: secondary ? theme.soft : theme.primary }, pressed && { opacity: 0.85 }, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, secondary && { color: theme.primary }]}>{title}</Text>
    </Pressable>
  );
}

type FieldProps = { label: string; value: string; onChange: (v: string) => void };

export function Field({ label, value, onChange }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline style={styles.input} />
    </View>
  );
}

export function Card({ children }: React.PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Badge({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.badge, { backgroundColor: theme.mint, color: theme.primary }]}>{text}</Text>;
}

export function LinkButton({ title, onPress, disabled = false, align = 'center' }: { title: string; onPress: () => void; disabled?: boolean; align?: 'center' | 'flex-start' | 'flex-end' }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={6} style={[styles.link, { alignSelf: align }, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.linkText, { color: theme.primary }]}>{title}</Text>
    </Pressable>
  );
}

type SegmentProps = { options: string[]; value: string; onChange: (value: string) => void; disabled?: boolean; labels?: Record<string, string>; compact?: boolean };

export function Segment({ options, value, onChange, disabled = false, labels, compact = false }: SegmentProps) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.mint }, compact && { padding: 3 }]} accessibilityRole="radiogroup">
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onChange(option)} hitSlop={compact ? 6 : undefined} style={[styles.segmentItem, compact && { minHeight: 32 }, active && { backgroundColor: theme.primary }]}>
            <Text style={[styles.segmentText, { color: theme.primary }, compact && { fontSize: 13 }, active && styles.segmentTextActive]}>{labels?.[option] ?? option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ScreenProps = React.PropsWithChildren<{ title: string; subtitle?: React.ReactNode; onBack?: () => void; right?: React.ReactNode; footer?: React.ReactNode }>;

// Degradê "vivo" do cabeçalho: base diagonal + manchas de luz e sombra vagando em loop infinito.
type Blob = { size: number; duration: number; path: [number, number][] };
const blobs: Blob[] = [
  { size: 1.1, duration: 30000, path: [[-0.2, -0.3], [0.5, 0.1], [0.9, -0.2], [0.3, 0.5], [-0.2, -0.3]] },
  { size: 0.9, duration: 24000, path: [[0.8, 0.4], [0.1, -0.2], [-0.1, 0.6], [0.6, 0.2], [0.8, 0.4]] },
  { size: 1.0, duration: 36000, path: [[0.4, 0.8], [1.0, 0.3], [0.2, 0.0], [-0.3, 0.4], [0.4, 0.8]] },
  { size: 0.7, duration: 20000, path: [[0.0, 0.2], [0.7, 0.6], [1.1, 0.0], [0.4, -0.3], [0.0, 0.2]] },
];
function WanderingBlob({ blob, color, index, width, height }: { blob: Blob; color: string; index: number; width: number; height: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: blob.duration, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [t, blob.duration]);
  const diameter = Math.max(width, height) * blob.size;
  const input = blob.path.map((_, i) => i / (blob.path.length - 1));
  const translateX = t.interpolate({ inputRange: input, outputRange: blob.path.map(([x]) => x * width - diameter / 2) });
  const translateY = t.interpolate({ inputRange: input, outputRange: blob.path.map(([, y]) => y * height * 2 - diameter / 2) });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] });
  const id = `header-blob-${index}`;
  return <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: diameter, height: diameter, transform: [{ translateX }, { translateY }, { scale }] }}>
    <Svg width={diameter} height={diameter}>
      <Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color} stopOpacity={0.75} /><Stop offset="0.6" stopColor={color} stopOpacity={0.25} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </Animated.View>;
}
function MovingGradient() {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs><LinearGradient id="screen-header" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={theme.header} /><Stop offset="1" stopColor={theme.headerDeep} /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#screen-header)" />
    </Svg>
    {width > 0 && blobs.map((blob, index) => <WanderingBlob key={index} blob={blob} color={theme.blobs[index]} index={index} width={width} height={height} />)}
  </View>;
}
export function Screen({ title, subtitle, onBack, right, footer, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={[styles.page, { backgroundColor: theme.header }]}>
      <View>
      <MovingGradient />
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={12} style={styles.headerIcon}>
              <Text style={[styles.back, { color: theme.primary }]}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.headerIcon} />
          )}
          <Text style={[styles.headerTitle, title.length > 16 ? { fontSize: 21 } : title.length > 12 ? { fontSize: 23 } : null, !onBack && !right && { textAlign: 'left' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
          <View style={styles.headerIcon}>{right}</View>
        </View>
        {!!subtitle && (typeof subtitle === 'string' ? <Text style={[styles.headerSubtitle, { color: theme.primary }]}>{subtitle}</Text> : subtitle)}
      </View>
      </View>
      <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, { paddingBottom: footer ? 120 : 50 }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

type TabItem = { key: string; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };
type TabBarProps = { items: TabItem[]; active: string; onChange: (key: string) => void };

const BUBBLE = 58;
const NOTCH = BUBBLE + 11;
const nativeDriver = Platform.OS !== 'web';

export function TabBar({ items, active, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const index = Math.max(0, items.findIndex(item => item.key === active));
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(index));
  const [pop] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.parallel([
      Animated.spring(position, { toValue: index, useNativeDriver: nativeDriver, friction: 7, tension: 70 }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: nativeDriver, friction: 5, tension: 120 }),
      ]),
    ]).start();
  }, [index, position, pop]);
  const slot = width / items.length;
  const translateX = position.interpolate({ inputRange: [0, Math.max(1, items.length - 1)], outputRange: [slot / 2, slot * (Math.max(1, items.length - 1) + 0.5)] });
  const current = items[index];
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.primary, paddingBottom: insets.bottom + 10 }]} accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && <>
        <Animated.View pointerEvents="none" style={[styles.notch, { transform: [{ translateX }, { translateX: -NOTCH / 2 }] }]} />
        <Animated.View pointerEvents="none" style={[styles.bubble, { backgroundColor: theme.primary, borderColor: theme.primary, transform: [{ translateX }, { translateX: -BUBBLE / 2 }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
          <MaterialCommunityIcons name={current.icon} size={26} color={colors.white} />
        </Animated.View>
      </>}
      {items.map((item, i) => {
        const selected = i === index;
        const fade = position.interpolate({ inputRange: [i - 0.5, i - 0.25, i + 0.25, i + 0.5], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' });
        return (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => onChange(item.key)} style={styles.tabItem}>
            <Animated.View style={[styles.tabIcon, { opacity: fade }]}>
              <MaterialCommunityIcons name={item.icon} size={24} color="rgba(255,255,255,0.7)" />
            </Animated.View>
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.header },
  content: { padding: 22, paddingTop: 28, gap: 16, width: '100%', maxWidth: 650, alignSelf: 'center' },
  header: { paddingHorizontal: 22, paddingBottom: 44, width: '100%', maxWidth: 650, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 26, fontWeight: '800', color: colors.dark, textAlign: 'center' },
  headerSubtitle: { marginTop: 6, fontSize: 15, fontWeight: '600', color: colors.green, textAlign: 'center' },
  back: { fontSize: 40, lineHeight: 42, color: colors.green, fontWeight: '600' },
  sheet: { flex: 1, marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  subtitle: { fontSize: 20, fontWeight: '700', color: colors.dark },
  text: { fontSize: 16, color: colors.text, lineHeight: 24 },
  muted: { color: colors.muted, lineHeight: 21 },
  label: { color: colors.dark, fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: colors.mint, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 16, minHeight: 50 },
  button: { backgroundColor: colors.green, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, minHeight: 50, justifyContent: 'center' },
  buttonSecondary: { backgroundColor: colors.soft },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  buttonTextSecondary: { color: colors.green },
  card: { backgroundColor: colors.white, padding: 20, borderRadius: 24, gap: 12, shadowColor: colors.dark, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.mint, borderRadius: 14, color: colors.dark, overflow: 'hidden' },
  badge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.mint, color: colors.green, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
  link: { paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  linkText: { color: colors.green, fontWeight: '700', fontSize: 15 },
  segment: { flexDirection: 'row', backgroundColor: colors.mint, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.green },
  segmentText: { color: colors.green, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: colors.green, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 14, overflow: 'visible' },
  tabItem: { flex: 1, alignItems: 'center', gap: 4, minHeight: 52 },
  tabIcon: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  tabLabelActive: { color: colors.white, fontWeight: '800' },
  notch: { position: 'absolute', top: 0, left: 0, width: NOTCH, height: NOTCH / 2 + 4, borderBottomLeftRadius: NOTCH / 2, borderBottomRightRadius: NOTCH / 2, backgroundColor: colors.white },
  bubble: { position: 'absolute', top: -BUBBLE / 2 + 2, left: 0, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, backgroundColor: colors.green, borderWidth: 4, borderColor: colors.green, alignItems: 'center', justifyContent: 'center', shadowColor: colors.dark, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});

// Aviso e campo compartilhados com o fundo na cor do tema.
export const useSharedSheet = themedStyles(t => ({
  notice: [styles.notice, { backgroundColor: t.mint }],
  input: [styles.input, { backgroundColor: t.mint }],
}));
