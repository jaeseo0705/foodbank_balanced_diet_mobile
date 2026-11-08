import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { NutritionBasis, NutritionLabelResult, NutritionValue } from '../lib/nutrition.types';

const basisNames: Record<NutritionBasis['type'], string> = {
  total_package: '총 내용량당', per_quantity: '표시량당', per_serving: '1회 제공량당',
  per_unit: '개수당', per_daily_intake: '1일 섭취량당', unknown: '기준 확인 필요',
};
const states: Partial<Record<NutritionValue['state'], string>> = {
  trace: '미량', none_declared: '없음', dash: '—', not_detected: '확인 필요',
  conflict: '값 충돌', ambiguous: '확인 필요',
};
const operators = ['', '<', '≤', '>', '≥'];
const opSymbols = { lt: '<', lte: '≤', gt: '>', gte: '≥' };
const numeric = (text: string) => /^\d*(?:\.\d*)?$/.test(text);

function ValueRow({ item, id }: { item: NutritionValue; id: string }) {
  // Do not preselect a conflicting value or one of several unit interpretations.
  const uncertain = item.state === 'conflict' || item.alternatives.length > 0;
  const [value, setValue] = useState(uncertain ? '' : item.value ?? '');
  const [op, setOp] = useState(item.operator ? opSymbols[item.operator] : '');
  const [edited, setEdited] = useState(false);
  const unit = [item.unit, item.unitQualifier].filter(Boolean).join(' ');
  return (
    <View style={styles.valueRow}>
      <View style={styles.valueLine}>
        <Text style={styles.name}>{item.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 비교 기호 ${op || '없음'}`}
          onPress={() => { setOp(operators[(operators.indexOf(op) + 1) % operators.length]); setEdited(true); }} style={styles.operator}>
          <Text style={styles.body}>{op || '='}</Text>
        </Pressable>
        <TextInput testID={id} accessibilityLabel={`${item.name} 함량`} value={value}
          onChangeText={(text) => { if (numeric(text)) { setValue(text); setEdited(true); } }}
          keyboardType="decimal-pad" placeholder={states[item.state] ?? '미입력'}
          placeholderTextColor={colors.body} style={styles.input} />
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {item.printedValue && (uncertain || item.needsReview) && <Text style={styles.hint}>사진에서 읽은 값: {item.printedValue}</Text>}
      {item.needsReview && <Text style={styles.hint}>{item.reviewReasons.join(' · ') || '사진과 비교해 확인해 주세요.'}</Text>}
      {item.notices.map((notice, i) => <Text key={i} style={styles.hint}>{notice}</Text>)}
      {item.alternatives.map((choice, i) => (
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${item.name} ${choice.value} ${choice.unit} 선택`}
          onPress={() => { setValue(choice.value); setEdited(true); }} style={styles.choice}>
          <Text style={styles.body}>{choice.value} {choice.unit} — {choice.label}</Text>
        </Pressable>
      ))}
      {edited && <Text style={styles.hint}>수정한 값</Text>}
    </View>
  );
}

export function NutritionReview({ result }: { result: NutritionLabelResult }) {
  const [basis, setBasis] = useState(result.basis.type);
  const [quantity, setQuantity] = useState(result.basis.quantity ?? '');
  const [unit, setUnit] = useState(result.basis.unit ?? 'g');
  const [count, setCount] = useState(result.basis.count ?? '');
  const [countUnit, setCountUnit] = useState(result.basis.countUnit ?? '');
  const unresolved = [...result.review.unmatched, ...result.review.ambiguous];
  return (
    <View testID="nutrition-review" style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>영양정보 확인</Text>
      <Text style={styles.body}>사진과 비교해 값을 확인하고 수정해 주세요. 수정 내용은 현재 화면에서만 유지됩니다.</Text>
      {result.package && <Text style={styles.body}>총 내용량 {result.package.quantity} {result.package.unit}</Text>}
      <Text style={styles.subtitle}>영양성분 표시 기준</Text>
      <View style={styles.choices}>
        {Object.entries(basisNames).map(([key, name]) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={name}
            accessibilityState={{ selected: basis === key }}
            onPress={() => setBasis(key as NutritionBasis['type'])}
            style={[styles.choice, basis === key && styles.selected]}>
            <Text style={styles.body}>{name}</Text>
          </Pressable>
        ))}
      </View>
      {result.basis.printedText && <Text style={styles.hint}>사진 표기: {result.basis.printedText}</Text>}
      {['per_unit', 'per_serving', 'per_daily_intake'].includes(basis) && (
        <View style={styles.valueLine}>
          <Text style={styles.name}>기준 개수</Text>
          <TextInput accessibilityLabel="기준 개수" value={count} onChangeText={(s) => { if (numeric(s)) setCount(s); }} keyboardType="decimal-pad" style={styles.input} />
          <TextInput accessibilityLabel="개수 단위" value={countUnit} onChangeText={setCountUnit} placeholder="개·회분 등" style={[styles.input, { flex: 1 }]} />
        </View>
      )}
      <View style={styles.valueLine}>
        <Text style={styles.name}>기준 무게·부피</Text>
        <TextInput testID="nutrition-basis-quantity" accessibilityLabel="영양성분 기준량" value={quantity}
          onChangeText={(s) => { if (numeric(s)) setQuantity(s); }} keyboardType="decimal-pad" placeholder="미입력" style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel={`기준량 단위 ${unit}`}
          onPress={() => { const units = ['g', 'kg', 'mL', 'L']; setUnit(units[(units.indexOf(unit) + 1) % units.length]); }} style={styles.operator}>
          <Text style={styles.body}>{unit}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>기준을 수정해도 아래 함량은 자동 환산되지 않습니다. 사진에 표시된 기준과 함량을 함께 맞춰 주세요.</Text>
      {(result.basis.needsReview || result.basis.needsUnitWeight) && <Text style={styles.hint}>표시 기준 또는 기준량을 확인해 주세요.</Text>}
      {result.review.notes.map((note, i) => <Text key={i} style={styles.hint}>{note.includes('여러 기준') ? '여러 기준량이 감지됐습니다. 사용할 열 하나를 정하고 각 함량을 확인해 주세요.' : note}</Text>)}
      <Text style={styles.subtitle}>기본 영양성분</Text>
      {result.required.map((item) => <ValueRow key={item.code} item={item} id={`nutrition-value-${item.code}`} />)}
      {result.additional.length > 0 && <Text style={styles.subtitle}>추가 영양성분</Text>}
      {result.additional.map((item, i) => <ValueRow key={item.code ?? i} item={item} id={`nutrition-value-${item.code}`} />)}
      {unresolved.length > 0 && <Text style={styles.subtitle}>성분명 확인 필요</Text>}
      {unresolved.map((item, i) => <Text key={i} style={styles.body}>{item.printedName ?? item.name} · {item.printedValue ?? '값 확인 필요'}</Text>)}
      <Text style={styles.hint}>확인 안내는 최초 인식 결과를 기준으로 표시합니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  hint: { color: colors.body, fontSize: 14, lineHeight: 22 },
  valueRow: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 12, gap: 6 },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexGrow: 1, flexBasis: 90 },
  input: { minWidth: 76, maxWidth: 130, minHeight: 44, padding: 8, color: colors.text, fontSize: 17, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 8, backgroundColor: colors.background, textAlign: 'right' },
  unit: { color: colors.text, fontSize: 14, minWidth: 26 },
  operator: { minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8, padding: 8 },
  selected: { borderColor: colors.primary, backgroundColor: colors.background },
});
