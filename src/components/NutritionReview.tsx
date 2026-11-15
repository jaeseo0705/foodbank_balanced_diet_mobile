import { useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { OcrLine } from '../lib/ocr.types';
import type { NutritionLabelResult, NutritionValue } from '../lib/nutrition.types';
import { describeNutritionBasis, orderNutritionValues } from '../lib/nutritionReview';
import { makeManualNutrient } from '../lib/nutrientCatalog';
import { NutrientPicker } from './NutrientPicker';
import { QuantityInput, UnitPicker } from './QuantityInput';
import { isNutritionNumber } from '../lib/nutritionValidation';
import type { FmsFood } from '../lib/nutritionValidation';
import { FmsCloudContext } from '../context/FmsCloudContext';
import { prepareNutritionRegistration, resolveNutritionBasis, type NormalizedNutrition, type NutritionRegistration } from '../lib/nutritionNormalization';

const boundNames = { lt: '미만', lte: '이하', gt: '초과', gte: '이상' };

function ValueRow({ item, id, value, locked, operator, onOperatorChange, onChange, onRemove, onMoveUp, onMoveDown }: {
  item: NutritionValue; operator?: NutritionValue['operator']; onOperatorChange: (operator: NutritionValue['operator']) => void; id: string; value: string; locked: boolean; onChange: (value: string) => void; onRemove?: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const uncertain = item.state === 'conflict' || item.alternatives.length > 0;
  const bound = operator ? boundNames[operator] : '';
  const [editingBound, setEditingBound] = useState(false);
  const unit = [item.unit, item.unitQualifier].filter(Boolean).join(' ');
  return (
    <View testID={`nutrition-row-${item.code}`} style={styles.valueRow}>
      <View style={styles.valueLine}>
        <Text style={styles.name}>{item.name}</Text>
        <QuantityInput testID={id} accessibilityLabel={`${item.name} 함량`} value={value}
          editable={!locked} onChangeText={onChange}
          placeholderTextColor={colors.body} style={[styles.input, locked && styles.inputLocked]} />
        <Text style={styles.unit}>{unit}</Text>
        {(item.operator || operator) && <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 범위 수정`} disabled={locked}
          onPress={() => setEditingBound(true)} style={styles.bound}><Text style={styles.body}>{bound || '범위 없음'}</Text></Pressable>}
      </View>
      {onRemove && <View style={styles.addedActions}>
        <Pressable testID={`move-up-${item.code}`} accessibilityRole="button" accessibilityLabel={`${item.name} 위로 이동`} disabled={!onMoveUp} onPress={onMoveUp} style={styles.smallAction}><Text style={[styles.removeText, !onMoveUp && { opacity: 0.4 }]}>위로</Text></Pressable>
        <Pressable testID={`move-down-${item.code}`} accessibilityRole="button" accessibilityLabel={`${item.name} 아래로 이동`} disabled={!onMoveDown} onPress={onMoveDown} style={styles.smallAction}><Text style={[styles.removeText, !onMoveDown && { opacity: 0.4 }]}>아래로</Text></Pressable>
        <Pressable testID={`remove-added-${item.code}`} accessibilityRole="button" accessibilityLabel={`${item.name} 추가 취소`} onPress={onRemove} style={styles.smallAction}><Text style={styles.removeText}>추가 취소</Text></Pressable>
      </View>}
      {item.printedValue && uncertain && <Text style={styles.hint}>읽은 값: {item.printedValue}</Text>}
      {item.needsReview && <Text style={styles.hint}>{item.reviewReasons.join(' · ') || '사진 확인 필요'}</Text>}
      {item.notices.map((notice, i) => <Text key={i} style={styles.hint}>{notice}</Text>)}
      {item.alternatives.map((choice, i) => (
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${item.name} ${choice.value} ${choice.unit} 선택`}
          disabled={locked} onPress={() => onChange(choice.value)} style={[styles.choice, locked && { opacity: 0.5 }]}>
          <Text style={styles.body}>{choice.value} {choice.unit} — {choice.label}</Text>
        </Pressable>
      ))}
      <Modal visible={editingBound} transparent animationType="fade" onRequestClose={() => setEditingBound(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal>
          <Text style={styles.title}>{item.name} 범위</Text>
          {['범위 없음', '미만', '이하', '초과', '이상'].map(label => <Pressable key={label} accessibilityRole="button"
            onPress={() => { onOperatorChange((Object.keys(boundNames) as Array<keyof typeof boundNames>).find(key => boundNames[key] === label)); setEditingBound(false); }} style={styles.choice}>
            <Text style={styles.body}>{label}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setEditingBound(false)} style={styles.choice}><Text style={styles.body}>닫기</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function NutritionReview({ result, lines = [], entryMode = 'photo', food, onCancel, provenance, onSaved }: { onSaved?: (revision: number) => void; provenance?: NutritionRegistration['provenance']; food?: FmsFood; result: NutritionLabelResult; lines?: OcrLine[]; entryMode?: 'photo' | 'manual' | 'reference'; onCancel?: () => void }) {
  const [basisText, setBasisText] = useState(entryMode === 'manual' ? '총 내용량당' : describeNutritionBasis(result.basis));
  const [packageQuantity, setPackageQuantity] = useState(result.package?.quantity ?? (result.basis.type === 'total_package' ? result.basis.quantity : '') ?? '');
  const [packageUnit, setPackageUnit] = useState(result.package?.unit ?? (result.basis.type === 'total_package' ? result.basis.unit : '') ?? 'g');
  const [editingBasis, setEditingBasis] = useState(false);
  const [draftBasis, setDraftBasis] = useState(basisText);
  const [draftQuantity, setDraftQuantity] = useState(packageQuantity);
  const [draftUnit, setDraftUnit] = useState(packageUnit);
  const [registrationNotice, setRegistrationNotice] = useState(false);
  // Photo results are read-only until the user presses 수정; manual entry starts from empty fields, so it stays editable.
  const [editingValues, setEditingValues] = useState(false);
  const valuesLocked = entryMode === 'reference' || (entryMode === 'photo' && !editingValues);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualValues, setManualValues] = useState<NutritionValue[]>([]);
  const unresolved = [...result.review.unmatched, ...result.review.ambiguous];
  const originalValues = orderNutritionValues(result, lines);
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>(() => Object.fromEntries(originalValues.map(item => [item.code ?? item.name, item.state === 'conflict' || item.alternatives.length ? '' : item.value ?? ''])));
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  const client = useContext(FmsCloudContext);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false), mounted = useRef(true);
  const [savedRevision, setSavedRevision] = useState(food?.nutritionRevision ?? 0);
  const [basisConfirmed, setBasisConfirmed] = useState(entryMode !== 'photo' || (!result.basis.needsReview && !result.basis.needsUnitWeight && !result.review.notes.some(note => /여러 기준|기준량이 여러 개/.test(note))));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [operatorDrafts, setOperatorDrafts] = useState<Record<string, NutritionValue['operator']>>(() => Object.fromEntries(originalValues.map(item => [item.code ?? item.name, item.operator])));
  async function register() {
    if (savingRef.current) return;
    if (!normalized || normalizationError) { setNoticeText(normalizationError || '총 내용량과 원본 기준량을 확인해 주세요.'); setRegistrationNotice(true); return; }
    if (!basisConfirmed) { setNoticeText('영양정보 수정에서 사용할 원본 기준과 기준량을 확인해 주세요.'); setRegistrationNotice(true); return; }
    if (!food || !client) { setNoticeText('저장할 FMS 물품을 먼저 선택해 주세요.'); setRegistrationNotice(true); return; }
    savingRef.current = true; setSaving(true);
    try {
      const payload: NutritionRegistration = { ...normalized, valueBasis: entryMode === 'reference' ? 'fms_unit' : 'label', origin: entryMode, fmsUnit: food.unit ?? '', provenance,
        original: entryMode === 'manual' ? undefined : { basis: result.basis, package: result.package, required: result.required, additional: result.additional } };
      const revision = await client.saveNutrition(food, payload, savedRevision);
      if (mounted.current) { setSavedRevision(revision); onSaved?.(revision); setNoticeText(entryMode === 'reference' ? `${food.name}의 1${food.unit || '개'} 전체 기준 영양정보를 저장했습니다.` : `${food.name}의 영양성분표 기준과 함량을 그대로 저장했습니다.`); setRegistrationNotice(true); }
    } catch (error) {
      if (mounted.current) { setNoticeText(error instanceof Error ? error.message : '저장 결과를 확인하지 못했습니다. 물품을 다시 선택해 확인해 주세요.'); setRegistrationNotice(true); }
    } finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  }
  const [rowOrder, setRowOrder] = useState(() => originalValues.map(item => item.code));
  const values = [...originalValues, ...manualValues].sort((a, b) => rowOrder.indexOf(a.code) - rowOrder.indexOf(b.code));
  let normalized: NormalizedNutrition | undefined, normalizationError = '';
  const sourceValues = values.map(item => {
    const text = (valueDrafts[item.code ?? item.name] ?? '').trim();
    const operator = operatorDrafts[item.code ?? item.name];
    const valueChanged = !!touched[item.code ?? item.name] || text !== (item.value ?? '');
    return { ...item, operator, value: text || undefined,
      ...(valueChanged && text ? { needsReview: false, reviewReasons: [], alternatives: [] } : {}),
      state: text ? (operator ? 'bounded' : valueChanged || item.state === 'bounded' ? (/^0*(?:\.0*)?$/.test(text) ? 'explicit_zero' : 'exact') : item.state) : (item.state === 'exact' || item.state === 'explicit_zero' || item.state === 'bounded' ? 'not_detected' : item.state),
    } as NutritionValue;
  });
  try {
    const invalid = sourceValues.find(v => v.value !== undefined && !isNutritionNumber(v.value));
    if (invalid) throw Error(`${invalid.name}의 숫자를 확인해 주세요.`);
    if (!sourceValues.some(v => v.value !== undefined)) throw Error('저장할 영양정보를 입력해 주세요. 빈값을 0으로 채우지 않습니다.');
    normalized = prepareNutritionRegistration({ package: { quantity: packageQuantity, unit: packageUnit }, basis: resolveNutritionBasis(basisText, result.basis),
      required: sourceValues.filter(v => result.required.some(r => r.code === v.code)),
      additional: sourceValues.filter(v => !result.required.some(r => r.code === v.code)) }, entryMode);
  } catch (error) { normalizationError = error instanceof Error ? error.message : '내용량과 원본 기준을 확인해 주세요.'; }
  function moveNutrient(code: string | undefined, delta: number) {
    setRowOrder(previous => {
      const next = [...previous], index = next.indexOf(code), target = index + delta;
      if (index < 0 || target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function removeNutrient(code: string | undefined) {
    setValueDrafts(previous => { const next = { ...previous }; delete next[code ?? '']; return next; });
    setManualValues(previous => previous.filter(item => item.code !== code));
    setRowOrder(previous => previous.filter(item => item !== code));
  }
  const selectedCodes = new Set(values.map(item => item.code).filter((code): code is string => !!code));
  function addNutrient(code: string) {
    const item = makeManualNutrient(code);
    if (!item || originalValues.some(value => value.code === code)) return;
    setManualValues(previous => previous.some(value => value.code === code) ? previous : [...previous, item]);
    setRowOrder(previous => previous.includes(code) ? previous : [...previous, code]);
    setValueDrafts(previous => ({ ...previous, [code]: '' }));
    setEditingValues(true);
    setPickerOpen(false);
  }
  const multipleBases = result.review.notes.some(note => note.includes('여러 기준') || note.includes('기준량이 여러 개'));
  function editBasis() {
    setDraftBasis(basisText); setDraftQuantity(packageQuantity); setDraftUnit(packageUnit); setEditingBasis(true);
  }
  function toggleEditing() {
    if (editingValues) setEditingValues(false);
    else { setEditingValues(true); editBasis(); }
  }
  return (
    <View testID="nutrition-review" pointerEvents={saving ? "none" : "auto"} style={styles.section}>
      <View testID="nutrition-info-card" style={styles.card}>
        {entryMode !== 'manual' && <View testID="photo-fms-food-summary"><Text style={styles.body}>{food ? `${food.name} · 바코드 ${food.barcode || '없음'}` : '영양정보를 입력할 식품'}</Text></View>}
        <Text accessibilityRole="header" style={styles.title}>영양정보{entryMode === 'manual' ? ' 입력' : ' 확인'}</Text>
        {entryMode === 'photo' ? <View style={styles.summary}>
          <View style={{ flex: 1, gap: 6 }}>
            {packageQuantity !== '' && <Text style={styles.body}>총 내용량 {packageQuantity} {packageUnit}</Text>}
            <Text testID="nutrition-basis-summary" style={styles.body}>영양정보 기준: {basisText}</Text>
          </View>
          <Pressable testID="nutrition-edit-basis" accessibilityRole="button" accessibilityLabel={editingValues ? '수정 완료' : '영양정보 수정'} onPress={toggleEditing} style={styles.edit}>
            <Text style={styles.editText}>{editingValues ? '완료' : '수정'}</Text>
          </Pressable>
        </View> : <View style={styles.manualFields}>
          <Text style={styles.body}>FMS 1{food?.unit || '개'}당 총 내용량</Text>
          <View style={styles.quantityLine}>
            <QuantityInput testID="manual-package-quantity" accessibilityLabel="총 내용량" value={packageQuantity}
              onChangeText={setPackageQuantity} style={styles.input} />
            <UnitPicker id="manual-package-unit" value={packageUnit} onChange={setPackageUnit} />
          </View>
          {entryMode !== 'reference' && <><Text style={styles.body}>영양정보 기준</Text>
          <View style={styles.basisOptions}>{[['총 내용량당', 'total'], ['100 g당', '100g'], ['100 mL당', '100ml']].map(([label, id]) => <Pressable key={id} testID={`basis-${id}`} accessibilityRole="button" onPress={() => setBasisText(label)} style={styles.choice}><Text style={styles.editText}>{label}</Text></Pressable>)}</View>
          <TextInput testID="manual-basis-text" accessibilityLabel="영양정보 기준" value={basisText} onChangeText={setBasisText}
            placeholder="예: 총 내용량당, 100 g당, 1봉(40 g)당" style={styles.basisInput} /></>}
        </View>}
        {multipleBases && <Text style={styles.hint}>사진에 기준량이 여러 개 있습니다. 사용할 열 하나와 각 함량을 확인해 주세요.</Text>}
        {entryMode === 'photo' && !multipleBases && (result.basis.needsReview || result.basis.needsUnitWeight) && <Text style={styles.hint}>사진에 적힌 기준을 확인해 주세요.</Text>}
        {entryMode === 'reference' && normalized && normalized.factor !== '1' && <Text style={styles.hint}>{basisText} 값을 물품 1{food?.unit || '개'}의 총 내용량 기준으로 환산했습니다.</Text>}
        {normalizationError !== '' && <Text testID="nutrition-normalization-error" style={styles.hint}>{normalizationError}</Text>}
        {(entryMode === 'reference' ? normalized ? [...normalized.required, ...(previewExpanded ? normalized.additional : [])] : values.map(v => ({ ...v, value: undefined })) : values).map((item, i) => <ValueRow key={item.code ?? i} item={item} id={`nutrition-value-${item.code}`} value={entryMode === 'reference' ? item.value ?? '' : valueDrafts[item.code ?? item.name] ?? ''} locked={valuesLocked}
          operator={entryMode === 'reference' ? item.operator : operatorDrafts[item.code ?? item.name]} onOperatorChange={operator => setOperatorDrafts(previous => ({ ...previous, [item.code ?? item.name]: operator }))}
          onChange={value => { setTouched(previous => ({ ...previous, [item.code ?? item.name]: true })); setValueDrafts(previous => ({ ...previous, [item.code ?? item.name]: value })); }}
          onRemove={entryMode !== 'reference' && manualValues.some(value => value.code === item.code) ? () => removeNutrient(item.code) : undefined}
          onMoveUp={i > 0 ? () => moveNutrient(item.code, -1) : undefined}
          onMoveDown={i < values.length - 1 ? () => moveNutrient(item.code, 1) : undefined} />)}
        {entryMode === 'reference' && normalized && normalized.additional.length > 0 && <Pressable accessibilityRole="button" onPress={() => setPreviewExpanded(!previewExpanded)} style={styles.edit}><Text style={styles.editText}>{previewExpanded ? '추가 성분 접기' : `추가 성분 ${normalized.additional.length}개 보기`}</Text></Pressable>}
        {entryMode !== 'reference' && <Pressable testID="add-nutrient" accessibilityRole="button" accessibilityLabel="영양성분 추가" onPress={() => setPickerOpen(true)} style={styles.addNutrient}>
          <Text style={styles.editText}>＋ 영양성분 추가</Text>
        </Pressable>}
        {entryMode === 'reference' && provenance && <View style={styles.attribution} testID="public-food-attribution">
          <Text style={styles.hint}>참고 식품: {provenance.name}</Text>
          <Text style={styles.hint}>출처: {provenance.publisher} · {provenance.title} · {provenance.version}</Text>
        </View>}
        {unresolved.length > 0 && <Text style={styles.subtitle}>성분명 확인 필요</Text>}
        {unresolved.map((item, i) => <Text key={i} style={styles.body}>{item.printedName ?? item.name} · {item.printedValue ?? '값 확인 필요'}</Text>)}
      </View>
      <View style={styles.registration}>
        <Pressable testID="register-nutrition" accessibilityRole="button" accessibilityLabel="등록"
          disabled={saving} onPress={register} style={({ pressed }) => [styles.register, pressed && { opacity: 0.8 }]}>
          <Text style={styles.registerText}>{saving ? '저장 중…' : '등록'}</Text>
        </Pressable>
        {onCancel && <Pressable testID="cancel-nutrition" accessibilityRole="button" accessibilityLabel="취소"
          onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.8 }]}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>}
        <Text style={styles.registrationHint}>{entryMode === 'reference' ? `물품 1${food?.unit || '개'}의 총 내용량에 해당하는 함량으로 등록합니다.` : '영양성분표의 기준과 함량을 확인한 후 등록해 주세요.'}</Text>
      </View>
      {pickerOpen && <NutrientPicker selectedCodes={selectedCodes} onSelect={addNutrient} onClose={() => setPickerOpen(false)} />}
      <Modal visible={editingBasis} transparent animationType="fade" onRequestClose={() => setEditingBasis(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal testID="nutrition-basis-editor">
          <Text accessibilityRole="header" style={styles.title}>영양정보 기준 수정</Text>
          <Text style={styles.body}>FMS 1{food?.unit || '개'}당 총 내용량</Text>
          <View style={styles.quantityLine}>
            <QuantityInput testID="nutrition-package-quantity" accessibilityLabel="총 내용량" value={draftQuantity}
              onChangeText={setDraftQuantity} style={styles.input} />
            <UnitPicker id="nutrition-package-unit" value={draftUnit} onChange={setDraftUnit} />
          </View>
          <Text style={styles.body}>영양정보 기준</Text>
          <TextInput testID="nutrition-basis-text" accessibilityLabel="영양정보 기준" value={draftBasis} onChangeText={setDraftBasis}
            placeholder="예: 총 내용량당, 100 g당, 1봉(40 g)당" style={styles.basisInput} />
          <Text style={styles.hint}>영양성분표에 적힌 기준과 함량을 그대로 등록합니다.</Text>
          <View style={styles.summary}>
            <Pressable accessibilityRole="button" accessibilityLabel="기준 수정 취소" onPress={() => setEditingBasis(false)} style={styles.edit}><Text style={styles.editText}>취소</Text></Pressable>
            <Pressable testID="nutrition-basis-apply" accessibilityRole="button" accessibilityLabel="기준 수정 적용"
              disabled={!draftBasis.trim() || !draftUnit.trim() || (!!draftQuantity && (!isNutritionNumber(draftQuantity) || Number(draftQuantity) <= 0))}
              onPress={() => { setBasisText(draftBasis.trim()); setPackageQuantity(draftQuantity); setPackageUnit(draftUnit.trim()); setBasisConfirmed(true); setEditingBasis(false); }} style={styles.edit}>
              <Text style={styles.editText}>적용</Text>
            </Pressable>
          </View>
        </View></KeyboardAvoidingView>
      </Modal>
      <Modal visible={registrationNotice} transparent animationType="fade" onRequestClose={() => setRegistrationNotice(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal testID="nutrition-register-notice">
          <Text accessibilityRole="header" style={styles.title}>등록 안내</Text>
          <Text testID="nutrition-registration-message" style={styles.body}>{noticeText}</Text>
          <Pressable testID="nutrition-register-close" accessibilityRole="button" accessibilityLabel="등록 안내 확인" onPress={() => setRegistrationNotice(false)} style={styles.edit}><Text style={styles.editText}>확인</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 20 },
  attribution: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder, paddingTop: 12, gap: 4 },
  manualFields: { gap: 8 },
  basisOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, padding: 18, gap: 12 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  hint: { color: colors.body, fontSize: 14, lineHeight: 22 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  edit: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  editText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  valueRow: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 14, paddingBottom: 4, gap: 6 },
  quantityLine: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'nowrap' },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.text, fontSize: 17, fontWeight: '600', flexGrow: 1, flexBasis: 90 },
  input: { minWidth: 76, maxWidth: 130, minHeight: 46, padding: 10, color: colors.text, fontSize: 18, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, backgroundColor: colors.background, textAlign: 'right' },
  inputLocked: { backgroundColor: 'transparent', borderColor: 'transparent' },
  unit: { color: colors.text, fontSize: 16, minWidth: 28 },
  bound: { minHeight: 44, justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8, padding: 10 },
  addNutrient: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 8 },
  addedActions: { flexDirection: 'row', alignSelf: 'flex-end', gap: 12 },
  smallAction: { minHeight: 44, justifyContent: 'center' },
  removeText: { color: colors.body, fontSize: 14 },
  registration: { gap: 10 },
  register: { minHeight: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  registerText: { color: colors.background, fontSize: 20, fontWeight: '700' },
  cancel: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  registrationHint: { color: colors.body, textAlign: 'center', fontSize: 14, lineHeight: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,40,65,0.25)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 420, borderRadius: 20, backgroundColor: colors.background, padding: 24, gap: 14 },
  basisInput: { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, padding: 10, color: colors.text, fontSize: 17 },
});


