import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Health, testOptions, testResults, vaccineOptions } from '../../functions/health';
import { colors, styles as s } from '../ui';
import { Input } from './components';

function Check({ label, accessibilityLabel, checked, onPress, disabled }: { label: string; accessibilityLabel: string; checked: boolean; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, checked && styles.chipActive, disabled && { opacity: 0.5 }]}>
      <MaterialCommunityIcons name={checked ? 'check' : 'plus'} size={16} color={checked ? colors.white : colors.green} />
      <Text style={[styles.chipText, checked && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function HealthFields({ species, value, onChange, disabled }: { species: string; value: Health; onChange: (value: Health) => void; disabled: boolean }) {
  const vaccines = vaccineOptions[species] || [];
  const tests = testOptions[species] || [];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={s.subtitle}>Saúde</Text>
        <Text style={s.muted}>Marque só o que consta nos registros.</Text>
      </View>
      {(['vaccinesDone', 'vaccinesNeeded'] as const).map(key => vaccines.length > 0 && (
        <View key={key} style={{ gap: 8 }}>
          <Text style={s.label}>{key === 'vaccinesDone' ? 'Vacinas aplicadas' : 'Vacinas pendentes'}</Text>
          <View style={s.row}>
            {vaccines.map(option => <Check key={option.id} label={option.label} accessibilityLabel={`${key === 'vaccinesDone' ? 'Aplicada' : 'Pendente'}: ${option.label}`} checked={value[key].includes(option.id)} disabled={disabled} onPress={() => onChange({ ...value, [key]: value[key].includes(option.id) ? value[key].filter(id => id !== option.id) : [...value[key], option.id] })} />)}
          </View>
        </View>
      ))}
      {tests.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.label}>Testes</Text>
          <View style={s.row}>
            {tests.map(option => {
              const selected = value.tests.find(item => item.id === option.id);
              return <Check key={option.id} label={option.label} accessibilityLabel={`Teste ${option.label} realizado`} checked={!!selected} disabled={disabled} onPress={() => onChange({ ...value, tests: selected ? value.tests.filter(item => item.id !== option.id) : [...value.tests, { id: option.id, result: 'not_informed' }] })} />;
            })}
          </View>
          {value.tests.map(test => {
            const option = tests.find(item => item.id === test.id);
            if (!option) return null;
            return (
              <View key={test.id} style={{ gap: 6 }}>
                <Text style={s.muted}>Resultado {option.label}</Text>
                <View style={s.row}>
                  {Object.entries(testResults).map(([result, label]) => {
                    const active = test.result === result;
                    return <Pressable key={result} accessibilityRole="radio" accessibilityLabel={`${option.label}: ${label}`} accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onChange({ ...value, tests: value.tests.map(item => item.id === test.id ? { ...item, result } : item) })} style={[styles.result, active && styles.chipActive]}><Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text></Pressable>;
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Input label="Observações" placeholder={species === 'Outro' ? 'Vacinas, testes e datas' : 'Outras vacinas, datas…'} value={value.notes} onChange={notes => onChange({ ...value, notes })} multiline maxLength={3000} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.mint },
  chipActive: { backgroundColor: colors.green },
  chipText: { color: colors.green, fontWeight: '700' },
  result: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.mint, justifyContent: 'center' },
});
