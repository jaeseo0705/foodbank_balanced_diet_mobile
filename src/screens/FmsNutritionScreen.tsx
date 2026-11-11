import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { useFmsCloud } from '../context/FmsCloudContext';
import type { FmsFood } from '../lib/nutritionValidation';
import { colors } from '../theme';
import { NutritionRegistrationScreen } from './NutritionRegistrationScreen';

export function FmsNutritionScreen({ onBack }: { onBack: () => void }) {
  const client = useFmsCloud();
  const [products, setProducts] = useState<FmsFood[]>([]);
  const [food, setFood] = useState<FmsFood>();
  const [choosing, setChoosing] = useState(true), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current; setBusy(true); setError('');
    try { const values = await client.loadProducts(); if (current === sequence.current) setProducts(values); }
    catch (error) { if (current === sequence.current) setError(error instanceof Error ? error.message : '물품을 불러오지 못했습니다.'); }
    finally { if (current === sequence.current) setBusy(false); }
  }, [client]);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  const closePicker = () => { if (food) setChoosing(false); else onBack(); };
  useEffect(() => {
    if (!choosing || food) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [choosing, food, onBack]);
  function choose(product: FmsFood) { setFood(product); setChoosing(false); setQuery(''); }
  const key = query.trim().toLocaleLowerCase();
  const filtered = products.filter(p => [p.name, p.barcode, p.id, p.brand].some(v => v?.toLocaleLowerCase().includes(key)));
  const selector = <SafeAreaView testID="section-screen" style={styles.screen}>
    <View testID="fms-product-picker" style={styles.content}>
      <View style={styles.header}>
        <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={closePicker} style={styles.back}><BackIcon /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>물품 선택</Text>
        <Pressable testID="fms-products-refresh" accessibilityRole="button" accessibilityLabel="물품 새로고침" disabled={busy} onPress={load} style={styles.back}><Text style={styles.link}>새로고침</Text></Pressable>
      </View>
      <Text style={styles.body}>영양정보를 등록할 FMS 물품을 선택해 주세요.</Text>
      <TextInput testID="fms-product-search" accessibilityLabel="물품명 또는 바코드 검색" value={query} onChangeText={setQuery} placeholder="물품명 또는 바코드 검색" autoCorrect={false} style={styles.search} />
      {busy ? <ActivityIndicator accessibilityLabel="물품 불러오는 중" color={colors.primary} /> : error ? <View accessibilityRole="alert"><Text testID="fms-products-error" style={styles.body}>{error}</Text><Pressable onPress={load} accessibilityRole="button" style={styles.back}><Text style={styles.link}>다시 시도</Text></Pressable></View> :
        <FlatList data={filtered} keyExtractor={p => `${p.workspaceUserId}:${p.id}`} keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list} ListEmptyComponent={<Text testID="fms-products-empty" style={styles.body}>{products.length ? '검색 결과가 없습니다.' : '등록된 물품이 없습니다. FMS에서 물품을 등록한 뒤 새로고침해 주세요.'}</Text>}
          renderItem={({ item }) => <Pressable testID={`fms-product-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.name} 선택`} onPress={() => choose(item)} style={styles.product}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.body}>바코드 {item.barcode || '없음'}</Text>
            <Text style={styles.body}>{[item.category, item.unit, item.brand].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.meta}>물품코드 {item.id}</Text>
          </Pressable>} />}
    </View>
  </SafeAreaView>;
  if (!food) return selector;
  return <View style={styles.screen}>
    <NutritionRegistrationScreen food={food} onChangeFood={() => { setChoosing(true); void load(); }} onBack={() => { setFood(undefined); setChoosing(true); void load(); }} />
    <Modal visible={choosing} animationType="slide" onRequestClose={closePicker}>{selector}</Modal>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 16 },
  back: { minWidth: 54, minHeight: 48, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 23, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  body: { color: colors.body, fontSize: 15, lineHeight: 23 },
  search: { minHeight: 50, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, color: colors.text, fontSize: 17 },
  list: { gap: 12, paddingBottom: 32 },
  product: { padding: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, borderRadius: 14, gap: 6 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.body, fontSize: 13 },
});
