import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { useFmsCloud } from '../context/FmsCloudContext';
import type { InventoryItem } from '../lib/fmsInventory';
import { colors } from '../theme';

export function InventoryScreen({ onBack }: { onBack: () => void }) {
  const client = useFmsCloud();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState(''), [stockOnly, setStockOnly] = useState(true);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date>();
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setBusy(true); setError('');
    try {
      const data = await client.loadInventory();
      if (current === sequence.current) { setItems(data); setLoadedAt(new Date()); }
    } catch (reason) {
      if (current === sequence.current) setError(reason instanceof Error ? reason.message : '재고를 불러오지 못했습니다.');
    } finally { if (current === sequence.current) setBusy(false); }
  }, [client]);
  useEffect(() => {
    void load();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { sequence.current++; subscription.remove(); };
  }, [load]);
  const key = query.trim().toLocaleLowerCase();
  const filtered = items.filter(item => (!stockOnly || item.quantity > 0) && (!key || [item.name, item.barcode, item.category].some(value => value.toLocaleLowerCase().includes(key))));
  return <SafeAreaView style={styles.screen} testID="section-screen">
    <View style={styles.content} testID="inventory-screen">
      <View style={styles.header}>
        <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.headerButton}><BackIcon /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>재고 현황</Text>
        <Pressable testID="inventory-refresh" accessibilityRole="button" accessibilityLabel="재고 새로고침" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => { void load(); }} style={[styles.headerButton, styles.refresh]}><Text style={[styles.link, busy && styles.disabled]}>새로고침</Text></Pressable>
      </View>
      <TextInput testID="inventory-search" accessibilityLabel="재고 물품명 또는 바코드 검색" placeholder="물품명 또는 바코드 검색" placeholderTextColor={colors.body} value={query} onChangeText={setQuery} autoCorrect={false} style={styles.search} />
      <View style={styles.filter}>
        <Text style={styles.body}>재고 있는 물품만</Text>
        <Switch testID="inventory-stock-only" accessibilityLabel="재고 있는 물품만" value={stockOnly} onValueChange={setStockOnly} trackColor={{ true: colors.primary }} />
      </View>
      {busy ? <View style={styles.status}><ActivityIndicator accessibilityLabel="재고 불러오는 중" color={colors.primary} /><Text style={styles.body}>재고를 불러오고 있습니다.</Text></View>
        : error ? <View style={styles.status} accessibilityRole="alert"><Text testID="inventory-error" style={styles.body}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="재고 다시 시도" onPress={() => { void load(); }} style={styles.retry}><Text style={styles.link}>다시 시도</Text></Pressable></View>
          : <>
            <View style={styles.summary}><Text testID="inventory-count" style={styles.body}>{filtered.length}개 물품</Text>{loadedAt && <Text style={styles.updated}>최근 조회 {loadedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>}</View>
            <FlatList testID="inventory-list" data={filtered} keyExtractor={item => item.id} refreshing={busy} onRefresh={() => { void load(); }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
              ListEmptyComponent={<Text testID="inventory-empty" style={styles.empty}>{key ? '검색 결과가 없습니다.' : stockOnly ? '현재 재고가 있는 물품이 없습니다.' : '등록된 물품이 없습니다.'}</Text>}
              renderItem={({ item }) => <View testID={`inventory-item-${item.id}`} style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.body}>바코드 {item.barcode || '없음'}</Text>
                {!!item.category && <Text style={styles.body}>{item.category}</Text>}
                <View style={styles.quantityRow}><Text style={styles.body}>현재 재고</Text><Text testID={`inventory-quantity-${item.id}`} style={styles.quantity}>{item.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}{item.unit ? ` ${item.unit}` : ''}</Text></View>
              </View>} />
          </>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 16 },
  headerButton: { minWidth: 64, minHeight: 48, justifyContent: 'center' },
  refresh: { alignItems: 'flex-end' },
  title: { flex: 1, color: colors.text, fontSize: 23, fontWeight: '700', textAlign: 'center' },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  search: { minHeight: 50, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, fontSize: 17, color: colors.text },
  filter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  body: { color: colors.body, fontSize: 15, lineHeight: 23 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  updated: { color: colors.body, fontSize: 13, lineHeight: 23 },
  list: { gap: 12, paddingBottom: 32 },
  card: { padding: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, borderRadius: 14, gap: 6 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  quantity: { color: colors.primary, fontSize: 22, fontWeight: '700', flexShrink: 1 },
  status: { paddingTop: 32, alignItems: 'center', gap: 16 },
  retry: { minHeight: 48, padding: 12, justifyContent: 'center' },
  empty: { color: colors.body, fontSize: 16, textAlign: 'center', paddingVertical: 32 },
});
