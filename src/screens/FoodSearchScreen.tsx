import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { NutritionReview } from '../components/NutritionReview';
import { useFmsCloud } from '../context/FmsCloudContext';
import { publicFoodId, publicFoodNutrition, type PublicFood } from '../lib/publicFood';
import type { FmsFood } from '../lib/nutritionValidation';
import { colors } from '../theme';

export function FoodSearchScreen({ onBack, onManual, food, onSaved }: { onSaved?: (revision: number) => void; onBack: () => void; onManual: () => void; food?: FmsFood }) {
  const client = useFmsCloud();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [rows, setRows] = useState<PublicFood[]>([]);
  const [selected, setSelected] = useState<PublicFood>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [more, setMore] = useState(false);
  const sequence = useRef(0), offset = useRef(0), loading = useRef(false);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(undefined); } else onBack();
      return true;
    });
    return () => sub.remove();
  }, [selected, onBack]);
  function changeQuery(text: string) {
    sequence.current++; loading.current = false; setBusy(false);
    setQuery(text); setRows([]); setSearched(''); setMore(false); setError(''); offset.current = 0;
  }
  async function search(append = false) {
    if (loading.current) return;
    const term = query.trim();
    if (!term || term.length > 100) { setError('식품명을 1~100자로 입력해 주세요.'); return; }
    const current = ++sequence.current, start = append ? offset.current : 0;
    loading.current = true; setBusy(true); setError(''); Keyboard.dismiss();
    if (!append) { setRows([]); setSearched(term); setMore(false); }
    try {
      const results = await client.searchFoods(term, start);
      if (current !== sequence.current) return;
      setRows(previous => {
        const combined = append ? [...previous, ...results] : results;
        return combined.filter((r, i) => combined.findIndex(x => publicFoodId(x) === publicFoodId(r)) === i);
      });
      offset.current = start + results.length;
      setMore(results.length === 30);
    } catch (e) {
      if (current === sequence.current) setError(e instanceof Error ? e.message : '검색하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (current === sequence.current) { loading.current = false; setBusy(false); }
    }
  }
  const back = () => { if (selected) { setSelected(undefined); } else onBack(); };
  const header = <View style={styles.header}>
    <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={styles.back}><BackIcon /></Pressable>
    <Text accessibilityRole="header" style={styles.title}>{selected ? '영양정보 확인' : '유사 식품 검색'}</Text><View style={styles.back} />
  </View>;
  if (selected) return <SafeAreaView testID="section-screen" style={styles.screen}>
    <ScrollView testID="food-search-detail" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.detail}>
      {header}
      <NutritionReview onSaved={onSaved} key={publicFoodId(selected)} food={food} result={publicFoodNutrition(selected)} entryMode="reference" provenance={{ sourceKey: selected.source_key, recordKey: selected.record_key, name: selected.name,
        title: selected.title, publisher: selected.publisher, version: selected.version, basis: selected.basis, headers: selected.headers, rawValues: selected.raw_values }} onCancel={back} />
    </ScrollView>
  </SafeAreaView>;
  return <SafeAreaView testID="section-screen" style={styles.screen}>
    <View testID="food-search-screen" style={styles.content}>
      {header}
      <Text style={styles.body}>공공 DB 5종에서 식품명으로 검색합니다. 물품과 종류·조리 상태가 비슷한 식품을 선택해 주세요.</Text>
      <View style={styles.searchLine}>
        <TextInput testID="public-food-query" accessibilityLabel="유사 식품명 검색" value={query} onChangeText={changeQuery} placeholder="예: 고구마, 삶은 달걀" maxLength={100} autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { void search(); }} style={styles.input} />
        <Pressable testID="public-food-search" accessibilityRole="button" accessibilityLabel="검색" disabled={busy} onPress={() => search()} style={styles.primary}><Text style={styles.primaryText}>검색</Text></Pressable>
      </View>
      {error !== '' && <View accessibilityRole="alert"><Text testID="food-search-error" style={styles.body}>{error}</Text><Pressable testID="public-food-retry" accessibilityRole="button" onPress={() => search(rows.length > 0)} style={styles.linkButton}><Text style={styles.link}>다시 시도</Text></Pressable></View>}
      {busy && <ActivityIndicator accessibilityLabel="식품 검색 중" color={colors.primary} />}
      <FlatList data={rows} keyExtractor={publicFoodId} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
        ListEmptyComponent={!busy && !error ? <Text testID="public-food-empty" style={styles.note}>{searched ? '검색 결과가 없습니다. 다른 식품명으로 검색해 주세요.' : '식품명을 입력하고 검색해 주세요.'}</Text> : null}
        renderItem={({ item }) => <Pressable testID={`public-food-${publicFoodId(item)}`} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.title}, 선택`} onPress={() => { setSelected(item); }} style={styles.result}>
          <Text style={styles.name}>{item.name}</Text>
          {!!item.manufacturer && <Text style={styles.body}>{item.manufacturer}</Text>}
          <Text style={styles.body}>{[item.category, item.basis && `기준량 ${item.basis}`].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.note}>{item.publisher} · {item.title} · {item.version}</Text>
        </Pressable>}
        ListFooterComponent={more ? <Pressable testID="public-food-more" accessibilityRole="button" disabled={busy} onPress={() => search(true)} style={styles.linkButton}><Text style={styles.link}>더 보기</Text></Pressable> : null} />
      <Pressable testID="food-search-manual" accessibilityRole="button" accessibilityLabel="직접 입력" onPress={onManual} style={styles.manual}><Text style={styles.link}>직접 입력</Text></Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  detail: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, minHeight: 48, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 23, fontWeight: '700' },
  searchLine: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 },
  primary: { minWidth: 64, borderRadius: 12, backgroundColor: colors.primary, padding: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  list: { gap: 12, paddingBottom: 16 },
  result: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder, paddingVertical: 16, gap: 7 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  body: { color: colors.text, fontSize: 15, lineHeight: 24, flexShrink: 1 },
  note: { color: colors.body, fontSize: 13, lineHeight: 22 },
  linkButton: { minHeight: 44, paddingVertical: 12, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  manual: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder, minHeight: 54, justifyContent: 'center', marginBottom: 12 },
});
