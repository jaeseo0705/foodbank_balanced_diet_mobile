import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FmsFood } from '../lib/nutritionValidation';
import { colors } from '../theme';
export function FmsFoodSummary({ food, onChange }: { food: FmsFood; onChange?: () => void }) {
  return <View testID="fms-food-summary" style={styles.card}>
    <Text style={styles.name}>{food.name}</Text>
    <Text style={styles.body}>바코드 {food.barcode || '없음'} · 물품코드 {food.id}</Text>
    {onChange && <Pressable testID="change-fms-food" accessibilityRole="button" accessibilityLabel="물품 변경" onPress={onChange} style={styles.button}><Text style={styles.link}>물품 변경</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, gap: 6 }, name: { fontSize: 18, fontWeight: '700', color: colors.text }, body: { fontSize: 14, lineHeight: 22, color: colors.body }, button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end' }, link: { color: colors.primary, fontWeight: '600', fontSize: 15 } });
