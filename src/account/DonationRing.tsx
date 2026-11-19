import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
type Props = { progress: number; from: string; to: string; value: string; size?: number; stroke?: number };
const DURATION = 1200;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
// Anel circular: a borda é uma barra de progresso animada até a próxima meta.
// Anima atualizando o valor a cada quadro (sem Animated no SVG, que gera aviso no navegador).
export function DonationRing({ progress, from, to, value, size = 168, stroke = 12 }: Props) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, progress));
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const start = current.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / DURATION);
      current.current = start + (target - start) * easeOutCubic(t);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const center = size / 2;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Total doado ${value}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }} style={{ width: size, height: size }}>
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs><LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} /></LinearGradient></Defs>
      <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} fill="none" />
      {shown > 0.001 && <Circle cx={center} cy={center} r={radius} stroke="url(#ring)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - shown)} />}
    </Svg>
    <View style={[StyleSheet.absoluteFill, r.center]}>
      <Text style={r.label}>Total doado</Text>
      <Text style={r.value} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </View>
  </View>;
}
const r = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  label: { color: '#E4F3EA', fontSize: 13, fontWeight: '600' },
  value: { color: 'white', fontSize: 24, fontWeight: '800', marginVertical: 2 },
});
