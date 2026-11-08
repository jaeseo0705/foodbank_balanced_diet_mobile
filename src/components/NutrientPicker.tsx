import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchNutrients } from '../lib/nutrientCatalog';
import { colors } from '../theme';

export function NutrientPicker({ selectedCodes, onSelect, onClose }: {
  selectedCodes: ReadonlySet<string>; onSelect: (code: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const options = searchNutrients(query);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.backdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.sheet} accessibilityViewIsModal testID="nutrient-picker">
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>영양성분 추가</Text>
            <Pressable testID="nutrient-picker-close" accessibilityRole="button" accessibilityLabel="영양성분 목록 닫기" onPress={onClose} style={styles.close}>
              <Text style={styles.actionText}>닫기</Text>
            </Pressable>
          </View>
          <TextInput testID="nutrient-search" accessibilityLabel="영양성분 검색" value={query} onChangeText={setQuery}
            placeholder="성분명 검색 · 예: 식이섬유" placeholderTextColor={colors.body} autoCorrect={false}
            style={styles.search} clearButtonMode="while-editing" />
          <FlatList data={options} keyExtractor={item => item.code} keyboardShouldPersistTaps="handled"
            style={styles.list} contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text testID="nutrient-search-empty" style={styles.hint}>일치하는 성분이 없습니다. 검색어를 확인해 주세요.</Text>}
            renderItem={({ item }) => {
              const selected = selectedCodes.has(item.code);
              return (
                <Pressable testID={`nutrient-option-${item.code}`} accessibilityRole="button"
                  accessibilityLabel={`${item.name}${selected ? ' 추가됨' : ' 추가'}`}
                  accessibilityState={{ disabled: selected }} disabled={selected}
                  onPress={() => onSelect(item.code)} style={[styles.row, selected && styles.selected]}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.hint}>{selected ? '추가됨' : [item.unit, item.unitQualifier].filter(Boolean).join(' ')}</Text>
                </Pressable>
              );
            }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(31,40,65,0.25)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '100%', flexShrink: 1, backgroundColor: colors.background, borderRadius: 20, padding: 20, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  search: { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, padding: 12, color: colors.text, fontSize: 17 },
  list: { flexShrink: 1, minHeight: 80, maxHeight: 380 },
  listContent: { paddingBottom: 4 },
  row: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 17, lineHeight: 25 },
  hint: { color: colors.body, fontSize: 14, lineHeight: 22 },
  selected: { opacity: 0.55 },
});
