import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { NutritionReview } from '../components/NutritionReview';
import { createManualNutrition } from '../lib/manualNutrition';
import type { FmsFood } from '../lib/nutritionValidation';
import { colors } from '../theme';

export function ManualNutritionScreen({ onBack, reference = false, food }: { onBack: () => void; reference?: boolean; food?: FmsFood }) {
  const [result] = useState(createManualNutrition);
  return (
    <SafeAreaView testID="section-screen" style={styles.screen}>
      <ScrollView testID="manual-nutrition-screen" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}><BackIcon /></Pressable>
            <Text accessibilityRole="header" style={styles.title}>직접 입력</Text><View style={styles.back} />
          </View>
          {reference && <View style={styles.source}>
            <Text style={styles.sourceTitle}>공공 DB 참고값</Text>
            <Text style={styles.body}>출처: 식약처 K-FIND 식품영양성분 DB</Text>
            <Text style={styles.body}>조회한 식품의 종류·조리 상태·함량 기준량을 확인해 입력해 주세요. 해당 제품의 실제 함량과 다를 수 있습니다.</Text>
          </View>}
          <View testID="fms-food-summary" style={styles.source}>
            <Text style={styles.label}>{food?.name ?? '영양정보를 입력할 식품'}</Text>
            <Text style={styles.body}>{food ? `FMS 식품 번호: ${food.id}` : '추후 FMS에서 불러온 식품 정보가 여기에 표시됩니다.'}</Text>
          </View>
          <NutritionReview food={food} result={result} entryMode={reference ? 'reference' : 'manual'} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
  content: { width: '100%', maxWidth: 460, paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { width: 44, minHeight: 44, justifyContent: 'center' },
  title: { flex: 1, color: colors.text, textAlign: 'center', fontSize: 23, fontWeight: '700' },
  label: { color: colors.text, fontSize: 17, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, fontSize: 17, color: colors.text },
  source: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, gap: 6 },
  sourceTitle: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  body: { color: colors.body, fontSize: 14, lineHeight: 22 },
});
