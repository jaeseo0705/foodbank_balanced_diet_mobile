import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon } from '../components/TaskIcons';
import { RegistrationActionIcon, RegistrationArtwork, type RegistrationMethod } from '../components/RegistrationArtwork';
import { colors } from '../theme';

const methods: ReadonlyArray<{ id: RegistrationMethod; label: string; message: string }> = [
  { id: 'camera', label: '영양성분표 촬영', message: '촬영 기능을 준비 중입니다.' },
  { id: 'photo', label: '사진 불러오기', message: '사진 불러오기 기능을 준비 중입니다.' },
  { id: 'manual', label: '직접 입력', message: '직접 입력 기능을 준비 중입니다.' },
];

export function NutritionRegistrationScreen({ onBack }: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<RegistrationMethod | null>(null);
  const availableHeight = height - insets.top - insets.bottom;
  const contentWidth = Math.min(width - insets.left - insets.right, 460);
  const artworkSize = Math.min(250, contentWidth * 0.68);
  const heroHeight = Math.max(210, Math.min(350, availableHeight * 0.46));
  const selectedMethod = methods.find((method) => method.id === selected);

  return (
    <SafeAreaView style={styles.screen} testID="section-screen">
      <ScrollView
        testID="nutrition-registration-screen"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth, paddingTop: Math.max(24, Math.min(54, availableHeight * 0.06)) }]}>
          <View style={styles.header}>
            <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <BackIcon />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>영양성분 등록</Text>
            <View style={styles.headerBalance} />
          </View>

          <View style={[styles.hero, { minHeight: heroHeight }]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <RegistrationArtwork size={artworkSize} />
          </View>

          <View style={styles.actions}>
            {methods.map((method, index) => {
              const primary = index === 0;
              return (
                <Pressable
                  key={method.id}
                  testID={`registration-${method.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={method.label}
                  onPress={() => setSelected(method.id)}
                  style={({ pressed }) => [styles.action, primary && styles.primaryShadow, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={primary ? [colors.primary, colors.primary] : [colors.cardTop, colors.cardBottom]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.actionSurface, primary && styles.primaryBorder]}
                  >
                    <RegistrationActionIcon method={method.id} color={primary ? colors.background : colors.primary} />
                    <Text style={[styles.actionText, primary && styles.primaryText]}>{method.label}</Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal testID="registration-notice">
            <Text accessibilityRole="header" style={styles.modalTitle}>{selectedMethod?.label}</Text>
            <Text style={styles.modalText}>{selectedMethod?.message}</Text>
            <Pressable testID="registration-notice-close" accessibilityRole="button" accessibilityLabel="확인" onPress={() => setSelected(null)} style={styles.close}>
              <Text style={styles.closeText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  back: { width: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerBalance: { width: 44 },
  title: { flex: 1, textAlign: 'center', fontSize: 23, fontWeight: '700', color: colors.text },
  hero: { alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 18 },
  action: { borderRadius: 17, backgroundColor: colors.cardTop, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  primaryShadow: { shadowOpacity: 0.12 },
  actionSurface: { flexDirection: 'row', alignItems: 'center', minHeight: 66, paddingHorizontal: 24, paddingVertical: 16, gap: 18, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 17 },
  primaryBorder: { borderColor: colors.primary },
  actionText: { flex: 1, color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: '700', includeFontPadding: false },
  primaryText: { color: colors.background },
  pressed: { opacity: 0.72 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(35,44,68,0.25)', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.background, borderRadius: 18, padding: 24 },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  modalText: { color: colors.body, fontSize: 16, lineHeight: 25, marginTop: 16 },
  close: { minHeight: 44, padding: 12, marginTop: 16, alignSelf: 'flex-end' },
  closeText: { color: colors.primary, fontSize: 17, fontWeight: '700' },
});
