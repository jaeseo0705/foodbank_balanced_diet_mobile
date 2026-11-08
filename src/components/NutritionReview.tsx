import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { OcrLine } from '../lib/ocr.types';
import type { NutritionLabelResult, NutritionValue } from '../lib/nutrition.types';
import { describeNutritionBasis, orderNutritionValues } from '../lib/nutritionReview';

const states: Partial<Record<NutritionValue['state'], string>> = {
  trace: '미량', none_declared: '없음', dash: '—', not_detected: '미입력',
  conflict: '확인 필요', ambiguous: '확인 필요',
};
const boundNames = { lt: '미만', lte: '이하', gt: '초과', gte: '이상' };
const numeric = (text: string) => /^\d*(?:\.\d*)?$/.test(text);

function ValueRow({ item, id }: { item: NutritionValue; id: string }) {
  const uncertain = item.state === 'conflict' || item.alternatives.length > 0;
  const [value, setValue] = useState(uncertain ? '' : item.value ?? '');
  const [bound, setBound] = useState(item.operator ? boundNames[item.operator] : '');
  const [editingBound, setEditingBound] = useState(false);
  const unit = [item.unit, item.unitQualifier].filter(Boolean).join(' ');
  return (
    <View testID={`nutrition-row-${item.code}`} style={styles.valueRow}>
      <View style={styles.valueLine}>
        <Text style={styles.name}>{item.name}</Text>
        <TextInput testID={id} accessibilityLabel={`${item.name} 함량`} value={value}
          onChangeText={(text) => { if (numeric(text)) setValue(text); }}
          keyboardType="decimal-pad" placeholder={states[item.state] ?? '미입력'}
          placeholderTextColor={colors.body} style={styles.input} />
        <Text style={styles.unit}>{unit}</Text>
        {item.operator && <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 범위 수정`}
          onPress={() => setEditingBound(true)} style={styles.bound}><Text style={styles.body}>{bound || '범위 없음'}</Text></Pressable>}
      </View>
      {item.printedValue && uncertain && <Text style={styles.hint}>읽은 값: {item.printedValue}</Text>}
      {item.needsReview && <Text style={styles.hint}>{item.reviewReasons.join(' · ') || '사진 확인 필요'}</Text>}
      {item.notices.map((notice, i) => <Text key={i} style={styles.hint}>{notice}</Text>)}
      {item.alternatives.map((choice, i) => (
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${item.name} ${choice.value} ${choice.unit} 선택`}
          onPress={() => setValue(choice.value)} style={styles.choice}>
          <Text style={styles.body}>{choice.value} {choice.unit} — {choice.label}</Text>
        </Pressable>
      ))}
      <Modal visible={editingBound} transparent animationType="fade" onRequestClose={() => setEditingBound(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal>
          <Text style={styles.title}>{item.name} 범위</Text>
          {['범위 없음', '미만', '이하', '초과', '이상'].map(label => <Pressable key={label} accessibilityRole="button"
            onPress={() => { setBound(label === '범위 없음' ? '' : label); setEditingBound(false); }} style={styles.choice}>
            <Text style={styles.body}>{label}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setEditingBound(false)} style={styles.choice}><Text style={styles.body}>닫기</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function NutritionReview({ result, lines = [] }: { result: NutritionLabelResult; lines?: OcrLine[] }) {
  const [basisText, setBasisText] = useState(describeNutritionBasis(result.basis));
  const [packageQuantity, setPackageQuantity] = useState(result.package?.quantity ?? '');
  const [packageUnit, setPackageUnit] = useState(result.package?.unit ?? 'g');
  const [editingBasis, setEditingBasis] = useState(false);
  const [draftBasis, setDraftBasis] = useState(basisText);
  const [draftQuantity, setDraftQuantity] = useState(packageQuantity);
  const [draftUnit, setDraftUnit] = useState(packageUnit);
  const [registrationNotice, setRegistrationNotice] = useState(false);
  const unresolved = [...result.review.unmatched, ...result.review.ambiguous];
  const values = orderNutritionValues(result, lines);
  const multipleBases = result.review.notes.some(note => note.includes('여러 기준') || note.includes('기준량이 여러 개'));
  function editBasis() {
    setDraftBasis(basisText); setDraftQuantity(packageQuantity); setDraftUnit(packageUnit); setEditingBasis(true);
  }
  return (
    <View testID="nutrition-review" style={styles.section}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>영양정보 확인</Text>
        <View style={styles.summary}>
          <View style={{ flex: 1, gap: 6 }}>
            {packageQuantity !== '' && <Text style={styles.body}>총 내용량 {packageQuantity} {packageUnit}</Text>}
            <Text testID="nutrition-basis-summary" style={styles.body}>영양정보 기준: {basisText}</Text>
          </View>
          <Pressable testID="nutrition-edit-basis" accessibilityRole="button" accessibilityLabel="영양정보 기준 수정" onPress={editBasis} style={styles.edit}>
            <Text style={styles.editText}>수정</Text>
          </Pressable>
        </View>
        {multipleBases && <Text style={styles.hint}>사진에 기준량이 여러 개 있습니다. 사용할 열 하나와 각 함량을 확인해 주세요.</Text>}
        {!multipleBases && (result.basis.needsReview || result.basis.needsUnitWeight) && <Text style={styles.hint}>사진에 적힌 기준을 확인해 주세요.</Text>}
        {values.map((item, i) => <ValueRow key={item.code ?? i} item={item} id={`nutrition-value-${item.code}`} />)}
        {unresolved.length > 0 && <Text style={styles.subtitle}>성분명 확인 필요</Text>}
        {unresolved.map((item, i) => <Text key={i} style={styles.body}>{item.printedName ?? item.name} · {item.printedValue ?? '값 확인 필요'}</Text>)}
      </View>
      <View style={styles.registration}>
        <Pressable testID="register-nutrition" accessibilityRole="button" accessibilityLabel="등록"
          onPress={() => setRegistrationNotice(true)} style={({ pressed }) => [styles.register, pressed && { opacity: 0.8 }]}>
          <Text style={styles.registerText}>등록</Text>
        </Pressable>
        <Text style={styles.registrationHint}>사진과 영양정보가 일치하는지 확인한 후 등록해 주세요.</Text>
      </View>
      <Modal visible={editingBasis} transparent animationType="fade" onRequestClose={() => setEditingBasis(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal testID="nutrition-basis-editor">
          <Text accessibilityRole="header" style={styles.title}>영양정보 기준 수정</Text>
          <Text style={styles.body}>총 내용량</Text>
          <View style={styles.valueLine}>
            <TextInput testID="nutrition-package-quantity" accessibilityLabel="총 내용량" value={draftQuantity}
              onChangeText={text => { if (numeric(text)) setDraftQuantity(text); }} keyboardType="decimal-pad" style={styles.input} />
            <TextInput accessibilityLabel="총 내용량 단위" value={draftUnit} onChangeText={setDraftUnit} style={styles.input} />
          </View>
          <Text style={styles.body}>영양정보 기준</Text>
          <TextInput testID="nutrition-basis-text" accessibilityLabel="영양정보 기준" value={draftBasis} onChangeText={setDraftBasis}
            placeholder="예: 총 내용량당, 100 g당, 1봉(40 g)당" style={styles.basisInput} />
          <Text style={styles.hint}>사진에 적힌 기준을 입력해 주세요. 아래 성분값은 자동 환산되지 않습니다.</Text>
          <View style={styles.summary}>
            <Pressable accessibilityRole="button" accessibilityLabel="기준 수정 취소" onPress={() => setEditingBasis(false)} style={styles.edit}><Text style={styles.editText}>취소</Text></Pressable>
            <Pressable testID="nutrition-basis-apply" accessibilityRole="button" accessibilityLabel="기준 수정 적용"
              disabled={!draftBasis.trim() || (!!draftQuantity && Number(draftQuantity) <= 0)}
              onPress={() => { setBasisText(draftBasis.trim()); setPackageQuantity(draftQuantity); setPackageUnit(draftUnit.trim()); setEditingBasis(false); }} style={styles.edit}>
              <Text style={styles.editText}>적용</Text>
            </Pressable>
          </View>
        </View></KeyboardAvoidingView>
      </Modal>
      <Modal visible={registrationNotice} transparent animationType="fade" onRequestClose={() => setRegistrationNotice(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal testID="nutrition-register-notice">
          <Text accessibilityRole="header" style={styles.title}>등록 안내</Text>
          <Text style={styles.body}>현재는 시험 단계로, 입력값은 저장되지 않습니다.</Text>
          <Pressable testID="nutrition-register-close" accessibilityRole="button" accessibilityLabel="등록 안내 확인" onPress={() => setRegistrationNotice(false)} style={styles.edit}><Text style={styles.editText}>확인</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 20 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, padding: 18, gap: 12 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  hint: { color: colors.body, fontSize: 14, lineHeight: 22 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  edit: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  editText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  valueRow: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 14, paddingBottom: 4, gap: 6 },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.text, fontSize: 17, fontWeight: '600', flexGrow: 1, flexBasis: 90 },
  input: { minWidth: 76, maxWidth: 130, minHeight: 46, padding: 10, color: colors.text, fontSize: 18, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, backgroundColor: colors.background, textAlign: 'right' },
  unit: { color: colors.text, fontSize: 16, minWidth: 28 },
  bound: { minHeight: 44, justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8, padding: 10 },
  registration: { gap: 10 },
  register: { minHeight: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  registerText: { color: colors.background, fontSize: 20, fontWeight: '700' },
  registrationHint: { color: colors.body, textAlign: 'center', fontSize: 14, lineHeight: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,40,65,0.25)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 420, borderRadius: 20, backgroundColor: colors.background, padding: 24, gap: 14 },
  basisInput: { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, padding: 10, color: colors.text, fontSize: 17 },
});
