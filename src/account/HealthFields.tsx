import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Health, testOptions, testResults, vaccineOptions } from '../../functions/health';
import { styles as s } from '../ui';
import { Input } from './components';
function Check({ label, checked, onPress, disabled }: { label: string; checked: boolean; onPress: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[s.row, { alignItems: 'center', paddingVertical: 12, minHeight: 48, opacity: disabled ? 0.5 : 1 }]}><Text style={{ fontSize: 24, color: '#176B50' }}>{checked ? '☑' : '☐'}</Text><Text style={[s.text, { flex: 1 }]}>{label}</Text></Pressable>;
}
export function HealthFields({ species, value, onChange, disabled }: { species: string; value: Health; onChange: (value: Health) => void; disabled: boolean }) {
  const vaccines = vaccineOptions[species] || [];
  const tests = testOptions[species] || [];
  return <View style={{ gap: 8 }}><Text style={s.subtitle}>Vacinas e testes</Text><Text style={s.muted}>Marque somente o que consta nos registros do animal. Uma opção desmarcada significa “não registrado”, sem afirmar que o animal não recebeu a vacina ou não fez o teste.</Text>
    {(['vaccinesDone', 'vaccinesNeeded'] as const).map(key => <View key={key}><Text style={s.label}>{key === 'vaccinesDone' ? 'Vacinas já aplicadas' : 'Vacinas pendentes / próximas doses'}</Text>{vaccines.map(option => <Check key={option.id} label={`${key === 'vaccinesDone' ? 'Aplicada' : 'Pendente'}: ${option.label}`} checked={value[key].includes(option.id)} disabled={disabled} onPress={() => onChange({ ...value, [key]: value[key].includes(option.id) ? value[key].filter(id => id !== option.id) : [...value[key], option.id] })} />)}</View>)}
    <Text style={s.label}>Testes realizados</Text>{tests.map(option => {
      const selected = value.tests.find(item => item.id === option.id);
      return <View key={option.id}><Check label={`Teste ${option.label} realizado`} checked={!!selected} disabled={disabled} onPress={() => onChange({ ...value, tests: selected ? value.tests.filter(item => item.id !== option.id) : [...value.tests, { id: option.id, result: 'not_informed' }] })} />
        {selected && <View style={{ paddingLeft: 18 }}>{Object.entries(testResults).map(([result, label]) => <Pressable key={result} accessibilityRole="radio" accessibilityLabel={`${option.label}: ${label}`} accessibilityState={{ checked: selected.result === result, disabled }} disabled={disabled} onPress={() => onChange({ ...value, tests: value.tests.map(item => item.id === option.id ? { ...item, result } : item) })} style={{ paddingVertical: 12, minHeight: 48 }}><Text style={s.text}>{selected.result === result ? '◉' : '○'} {label}</Text></Pressable>)}</View>}
      </View>;
    })}
    {species === 'Outro' && <Text style={s.muted}>Para outras espécies, descreva os registros nas observações abaixo.</Text>}
    <Input label="Outras vacinas, testes, datas e observações de saúde" value={value.notes} onChange={notes => onChange({ ...value, notes })} multiline maxLength={3000} />
    <Text style={s.muted}>As opções servem para registrar informações. Não são um protocolo de vacinação nem um diagnóstico; a avaliação cabe ao veterinário.</Text>
  </View>;
}
