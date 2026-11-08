import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors } from '../theme';

// Keep drafts intact; validate when the user submits instead of dropping keystrokes.
export function QuantityInput(props: TextInputProps) {
  return <TextInput {...props} inputMode="decimal" keyboardType="decimal-pad" autoComplete="off"
    textContentType="none" autoCorrect={false} spellCheck={false} placeholder="" />;
}
const units = ['g', 'kg', 'mL', 'L'];
export function UnitPicker({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(!units.includes(value));
  return <View style={styles.container}>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel="총 내용량 단위 선택"
      onPress={() => setOpen(!open)} style={styles.button}><Text style={styles.text}>{custom ? '직접 입력' : value} ▾</Text></Pressable>
    {open && <View style={styles.options}>{[...units, '직접 입력'].map(unit => <Pressable key={unit}
      testID={`${id}-${unit === '직접 입력' ? 'custom' : unit}`} accessibilityRole="button" accessibilityLabel={`${unit} 단위 선택`}
      style={styles.button} onPress={() => { setCustom(unit === '직접 입력'); onChange(unit === '직접 입력' ? '' : unit); setOpen(false); }}>
      <Text style={styles.text}>{unit}</Text></Pressable>)}</View>}
    {custom && <TextInput testID={`${id}-custom-value`} accessibilityLabel="직접 입력 단위" value={value} onChangeText={onChange}
      autoComplete="off" autoCorrect={false} style={styles.button} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flexShrink: 1, gap: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  button: { minHeight: 46, padding: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.background, color: colors.text, fontSize: 17 },
  text: { color: colors.text, fontSize: 17 },
});
