import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { FmsFoodSummary } from '../components/FmsFoodSummary';
import { NutritionReview } from '../components/NutritionReview';
import { createManualNutrition } from '../lib/manualNutrition';
import type { FmsFood } from '../lib/nutritionValidation';
import { colors } from '../theme';

export function ManualNutritionScreen({ onBack, food, onChangeFood }: { onBack: () => void; food?: FmsFood; onChangeFood?: () => void }) {
  const [result] = useState(createManualNutrition);
  return (
    <SafeAreaView testID="section-screen" style={styles.screen}>
      <ScrollView testID="manual-nutrition-screen" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}><BackIcon /></Pressable>
            <Text accessibilityRole="header" style={styles.title}>직접 입력</Text><View style={styles.back} />
          </View>
          {food && <FmsFoodSummary food={food} onChange={onChangeFood} />}
          <NutritionReview food={food} result={result} entryMode="manual" onCancel={onBack} />
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
});


