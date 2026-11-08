import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState('');
  const close = () => setOpen(false);
  return <View style={styles.container}>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={`총 내용량 단위 선택, ${value || '단위'}`}
      onPress={() => { setCustom(false); setOpen(true); }} style={styles.button}>
      <Text numberOfLines={1} style={styles.text}>{value || '단위'}</Text><Text style={styles.arrow}>▾</Text>
    </Pressable>
    {open && <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View testID={`${id}-dialog`} accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>단위 선택</Text>
          {custom ? <>
            <TextInput testID={`${id}-custom-value`} accessibilityLabel="직접 입력 단위" value={draft} onChangeText={setDraft}
              autoFocus maxLength={20} autoComplete="off" autoCorrect={false} style={styles.customInput} />
            <Pressable testID={`${id}-apply`} accessibilityRole="button" accessibilityLabel="단위 적용" disabled={!draft.trim()}
              onPress={() => { onChange(draft.trim()); close(); }} style={styles.option}><Text style={styles.text}>적용</Text></Pressable>
          </> : [...units, '직접 입력'].map(unit => <Pressable key={unit}
            testID={`${id}-${unit === '직접 입력' ? 'custom' : unit}`} accessibilityRole="button" accessibilityLabel={`${unit} 단위 선택`}
            style={styles.option} onPress={() => {
              if (unit === '직접 입력') { setDraft(units.includes(value) ? '' : value); setCustom(true); }
              else { onChange(unit); close(); }
            }}><Text style={styles.text}>{unit}</Text><Text style={styles.text}>{unit === value ? '✓' : ''}</Text></Pressable>)}
          <Pressable testID={`${id}-cancel`} accessibilityRole="button" accessibilityLabel="단위 선택 취소" onPress={close} style={styles.option}>
            <Text style={styles.text}>취소</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: 100, flexShrink: 0 },
  button: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: 17, flexShrink: 1 }, arrow: { color: colors.body, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,40,65,0.25)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 320, backgroundColor: colors.background, borderRadius: 18, padding: 20, gap: 4 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  option: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  customInput: { minHeight: 46, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, color: colors.text, fontSize: 17 },
});
