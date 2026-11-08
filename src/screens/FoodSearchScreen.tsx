import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../components/TaskIcons';
import { publicFoodSearchUrl } from '../lib/manualNutrition';
import { colors } from '../theme';

export function FoodSearchScreen({ onBack, onManual }: { onBack: () => void; onManual: () => void }) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  async function openSearch() {
    if (opening) return;
    setOpening(true); setError('');
    try { await Linking.openURL(publicFoodSearchUrl); }
    catch { setError('검색 페이지를 열지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'); }
    finally { setOpening(false); }
  }
  return (
    <SafeAreaView testID="section-screen" style={styles.screen}>
      <ScrollView testID="food-search-screen" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}><BackIcon /></Pressable>
            <Text accessibilityRole="header" style={styles.title}>식품 검색</Text><View style={styles.back} />
          </View>
          <View style={styles.card}>
            <Text style={styles.subtitle}>식약처 식품영양성분 DB</Text>
            <Text style={styles.body}>성분표가 없는 식품은 공식 DB에서 식품명으로 찾아볼 수 있습니다.</Text>
            <Text style={styles.body}>검색은 브라우저에서 진행합니다. 식품 종류와 조리 상태를 고른 뒤 함량 기준량을 확인해 주세요.</Text>
            <Pressable testID="open-public-food-search" accessibilityRole="button" accessibilityLabel="공식 DB에서 식품 검색" disabled={opening} onPress={() => { void openSearch(); }} style={styles.primary}>
              <Text style={styles.primaryText}>{opening ? '여는 중…' : '공식 DB에서 식품 검색'}</Text>
            </Pressable>
            {error !== '' && <Text testID="food-search-error" accessibilityRole="alert" style={styles.body}>{error}</Text>}
          </View>
          <Pressable testID="food-search-manual" accessibilityRole="button" accessibilityLabel="조회한 영양정보 입력" onPress={onManual} style={styles.secondary}>
            <Text style={styles.secondaryText}>조회한 영양정보 입력</Text>
          </Pressable>
          <Text style={styles.note}>검색 결과는 자동으로 불러오지 않습니다. 앱으로 돌아와 조회한 값을 입력하면 공공 DB 참고값으로 표시됩니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
  content: { width: '100%', maxWidth: 460, paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  back: { width: 44, minHeight: 44, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 23, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, borderRadius: 16, padding: 20, gap: 16 },
  subtitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 26 },
  primary: { minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.background, fontSize: 17, fontWeight: '700' },
  secondary: { minHeight: 54, borderRadius: 14, borderColor: colors.cardBorder, borderWidth: 1, padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  note: { color: colors.body, fontSize: 14, lineHeight: 23 },
});
