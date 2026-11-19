import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleProp, Text, TextStyle } from 'react-native';

const TYPE_MS = 110;
const DELETE_MS = 55;
const HOLD_MS = 19300;
const PAUSE_MS = 1200;
const nativeDriver = Platform.OS !== 'web';

type Props = { phrases: string[]; style?: StyleProp<TextStyle> };

export function Typewriter({ phrases, style }: Props) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(phrases[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cursor] = useState(() => new Animated.Value(1));
  const phrase = phrases[index % phrases.length] ?? '';

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(cursor, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.timing(cursor, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
    ]));
    blink.start();
    return () => blink.stop();
  }, [cursor]);

  useEffect(() => {
    if (reduceMotion || phrases.length < 2) return;
    let delay = deleting ? DELETE_MS : TYPE_MS;
    if (!deleting && length === phrase.length) delay = HOLD_MS;
    if (deleting && length === 0) delay = PAUSE_MS;
    const timer = setTimeout(() => {
      if (!deleting && length === phrase.length) setDeleting(true);
      else if (deleting && length === 0) { setDeleting(false); setIndex(current => (current + 1) % phrases.length); }
      else setLength(current => current + (deleting ? -1 : 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [deleting, length, phrase, phrases.length, reduceMotion]);

  if (reduceMotion || phrases.length < 2) return <Text style={style} numberOfLines={1}>{phrases[0]}</Text>;
  return (
    <Text style={style} accessibilityLabel={phrases[0]} numberOfLines={1}>
      {phrase.slice(0, length)}
      <Animated.Text style={{ opacity: cursor, fontWeight: '400' }}>|</Animated.Text>
    </Text>
  );
}
