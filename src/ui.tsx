import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const colors = {
  green: '#176B50',
  dark: '#102E24',
  bg: '#F5F8F5',
  text: '#172C24',
  muted: '#5B7166',
  border: '#DCE5DF',
  mint: '#E4F3EA',
  header: '#BFE3CD',
  soft: '#D3ECDC',
  white: '#FFFFFF',
};

type ButtonProps = { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean };

export function Button({ title, onPress, secondary = false, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && { opacity: 0.85 }, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
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
  return <Text style={styles.badge}>{text}</Text>;
}

export function LinkButton({ title, onPress, disabled = false, align = 'center' }: { title: string; onPress: () => void; disabled?: boolean; align?: 'center' | 'flex-start' | 'flex-end' }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={6} style={[styles.link, { alignSelf: align }, disabled && { opacity: 0.5 }]}>
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

type SegmentProps = { options: string[]; value: string; onChange: (value: string) => void; disabled?: boolean; labels?: Record<string, string>; compact?: boolean };

export function Segment({ options, value, onChange, disabled = false, labels, compact = false }: SegmentProps) {
  return (
    <View style={[styles.segment, compact && { padding: 3 }]} accessibilityRole="radiogroup">
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onChange(option)} hitSlop={compact ? 6 : undefined} style={[styles.segmentItem, compact && { minHeight: 32 }, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, compact && { fontSize: 13 }, active && styles.segmentTextActive]}>{labels?.[option] ?? option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ScreenProps = React.PropsWithChildren<{ title: string; subtitle?: React.ReactNode; onBack?: () => void; right?: React.ReactNode; footer?: React.ReactNode }>;

export function Screen({ title, subtitle, onBack, right, footer, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={12} style={styles.headerIcon}>
              <Text style={styles.back}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.headerIcon} />
          )}
          <Text style={[styles.headerTitle, !onBack && !right && { textAlign: 'left' }]} numberOfLines={1}>{title}</Text>
          <View style={styles.headerIcon}>{right}</View>
        </View>
        {!!subtitle && (typeof subtitle === 'string' ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : subtitle)}
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
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 10 }]} accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && <>
        <Animated.View pointerEvents="none" style={[styles.notch, { transform: [{ translateX }, { translateX: -NOTCH / 2 }] }]} />
        <Animated.View pointerEvents="none" style={[styles.bubble, { transform: [{ translateX }, { translateX: -BUBBLE / 2 }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
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
