import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon } from '../components/TaskIcons';
import { RegistrationActionIcon, RegistrationArtwork, type RegistrationMethod } from '../components/RegistrationArtwork';
import { colors } from '../theme';
import { selectNutritionPhoto, type PhotoMethod } from '../lib/nutritionPhoto';
import { recognizeNutritionText } from '../lib/ocr';
import { OcrError, type OcrResult } from '../lib/ocr.types';

const methods: ReadonlyArray<{ id: RegistrationMethod; label: string }> = [
  { id: 'camera', label: '영양성분표 촬영' },
  { id: 'photo', label: '사진 불러오기' },
  { id: 'manual', label: '직접 입력' },
];
type Notice = { title: string; message: string; settings?: boolean };


export function NutritionRegistrationScreen({ onBack }: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState<PhotoMethod | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const ocrToken = useRef(0);
  const ocrInFlight = useRef(false);
  const picking = useRef(false);
  const mounted = useRef(true);
  const interacted = useRef(false);

  function updatePhoto(asset: ImagePicker.ImagePickerAsset | null) {
    ocrToken.current += 1;
    ocrInFlight.current = false;
    setPhoto(asset);
    setOcrResult(null);
    setOcrBusy(false);
  }

  async function readPhoto() {
    if (!photo || ocrInFlight.current || picking.current) return;
    ocrInFlight.current = true;
    const token = ++ocrToken.current;
    setOcrBusy(true);
    try {
      const result = await recognizeNutritionText(photo.uri);
      if (!mounted.current || token !== ocrToken.current) return;
      setOcrResult(result);
    } catch (error) {
      if (!mounted.current || token !== ocrToken.current) return;
      setNotice({
        title: '영양정보 읽기',
        message: error instanceof OcrError
          ? error.message
          : '글자를 읽지 못했습니다. 다른 사진으로 다시 시도해 주세요.',
      });
    } finally {
      if (mounted.current && token === ocrToken.current) {
        ocrInFlight.current = false;
        setOcrBusy(false);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === 'android') {
      void ImagePicker.getPendingResultAsync().then((result) => {
        if (!mounted.current || !result || interacted.current) return;
        if ('code' in result) {
          setNotice({ title: '사진 불러오기', message: '사진을 복구하지 못했습니다. 다시 선택해 주세요.' });
        } else if (!result.canceled && result.assets?.[0]?.uri) {
          updatePhoto(result.assets[0]);
        }
      }).catch(() => {
        if (mounted.current) setNotice({ title: '사진 불러오기', message: '사진을 불러오지 못했습니다. 다시 선택해 주세요.' });
      });
    }
    return () => { mounted.current = false; ocrToken.current += 1; };
  }, []);

  useEffect(() => {
    if (!photo) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      updatePhoto(null);
      return true;
    });
    return () => subscription.remove();
  }, [photo]);

  async function choosePhoto(method: PhotoMethod) {
    if (picking.current) return;
    picking.current = true;
    interacted.current = true;
    setBusy(method);
    try {
      const result = await selectNutritionPhoto(method);
      if (!mounted.current) return;
      if (result.kind === 'picked') updatePhoto(result.asset);
      if (result.kind === 'permission-denied') {
        setNotice({
          title: '카메라 접근 권한',
          message: result.canAskAgain
            ? '영양성분표를 촬영하려면 카메라 접근을 허용해 주세요. 사진 불러오기도 이용할 수 있습니다.'
            : '기기 설정에서 카메라 접근을 허용해 주세요. 사진 불러오기도 이용할 수 있습니다.',
          settings: !result.canAskAgain,
        });
      }
    } catch {
      if (mounted.current) {
        setNotice({
          title: method === 'camera' ? '촬영 안내' : '사진 불러오기',
          message: method === 'camera'
            ? (Platform.OS === 'ios'
              ? '카메라를 열지 못했습니다. iPhone 시뮬레이터에서는 사진 불러오기를 이용해 주세요.'
              : '카메라를 열지 못했습니다. 기기의 카메라를 확인하거나 사진 불러오기를 이용해 주세요.')
            : '사진을 불러오지 못했습니다. 다른 사진을 선택하거나 다시 시도해 주세요.',
        });
      }
    } finally {
      picking.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function chooseMethod(method: RegistrationMethod) {
    if (method === 'manual') {
      setNotice({ title: '직접 입력', message: '직접 입력 기능을 준비 중입니다.' });
    } else {
      void choosePhoto(method);
    }
  }

  async function openSettings() {
    try {
      await Linking.openSettings();
      if (mounted.current) setNotice(null);
    } catch {
      if (mounted.current) setNotice({ title: '카메라 접근 권한', message: '기기의 설정 앱에서 카메라 접근을 허용해 주세요.' });
    }
  }

  const availableHeight = height - insets.top - insets.bottom;
  const contentWidth = Math.min(width - insets.left - insets.right, 460);
  const artworkSize = Math.min(250, contentWidth * 0.68);
  const heroHeight = Math.max(210, Math.min(350, availableHeight * 0.46));

  return (
    <SafeAreaView style={styles.screen} testID="section-screen">
      <ScrollView
        testID="nutrition-registration-screen"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth, paddingTop: Math.max(24, Math.min(54, availableHeight * 0.06)) }]}>
          <View style={styles.header}>
            <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => photo ? updatePhoto(null) : onBack()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <BackIcon />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>영양성분 등록</Text>
            <View style={styles.headerBalance} />
          </View>

          {photo ? (
            <View style={[styles.hero, { minHeight: heroHeight }]}>
              <Image
                key={photo.uri}
                testID="picked-nutrition-image"
                accessibilityLabel="선택한 영양성분표 사진"
                source={{ uri: photo.uri }}
                resizeMode="contain"
                style={{ width: '100%', height: Math.max(180, heroHeight - 60), borderRadius: 12 }}
                onError={() => {
                  updatePhoto(null);
                  setNotice({ title: '사진 확인', message: '사진을 표시하지 못했습니다. 다른 사진을 선택해 주세요.' });
                }}
              />
              <Pressable
                testID="remove-nutrition-photo"
                accessibilityRole="button"
                accessibilityLabel="사진 선택 해제"
                disabled={busy !== null}
                onPress={() => updatePhoto(null)}
                style={styles.removePhoto}
              >
                <Text style={styles.removePhotoText}>선택 해제</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.hero, { minHeight: heroHeight }]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <RegistrationArtwork size={artworkSize} />
            </View>
          )}

          {photo && (
            <View style={styles.ocrSection}>
              <Pressable
                testID="read-nutrition-text"
                accessibilityRole="button"
                accessibilityLabel={ocrBusy ? '영양정보 읽는 중' : '영양정보 읽기'}
                accessibilityState={{ disabled: ocrBusy || busy !== null, busy: ocrBusy }}
                disabled={ocrBusy || busy !== null}
                onPress={() => { void readPhoto(); }}
                style={({ pressed }) => [styles.readButton, pressed && styles.pressed]}
              >
                {ocrBusy && <ActivityIndicator color={colors.background} />}
                <Text style={styles.readButtonText}>{ocrBusy ? '영양정보 읽는 중…' : '영양정보 읽기'}</Text>
              </Pressable>
              {ocrResult !== null && (
                <View testID="ocr-result" style={styles.resultCard}>
                  <Text accessibilityRole="header" style={styles.resultTitle}>인식한 글자</Text>
                  {ocrResult.text.trim() ? (
                    <>
                      <Text style={styles.resultHint}>사진과 비교해 확인해 주세요.</Text>
                      <Text testID="ocr-text" selectable style={styles.resultText}>{ocrResult.text}</Text>
                    </>
                  ) : (
                    <Text testID="ocr-empty" style={styles.resultHint}>글자를 찾지 못했습니다. 영양성분표가 선명하게 보이도록 다시 촬영해 주세요.</Text>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            {methods.map((method, index) => {
              const primary = index === 0 && !photo;
              return (
                <Pressable
                  key={method.id}
                  testID={`registration-${method.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={method.label}
                  disabled={busy !== null}
                  accessibilityState={{ disabled: busy !== null, busy: busy === method.id }}
                  onPress={() => chooseMethod(method.id)}
                  style={({ pressed }) => [styles.action, primary && styles.primaryShadow, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={primary ? [colors.primary, colors.primary] : [colors.cardTop, colors.cardBottom]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.actionSurface, primary && styles.primaryBorder]}
                  >
                    {busy === method.id
                      ? <ActivityIndicator size={32} color={primary ? colors.background : colors.primary} />
                      : <RegistrationActionIcon method={method.id} color={primary ? colors.background : colors.primary} />}
                    <Text style={[styles.actionText, primary && styles.primaryText]}>{method.label}</Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal testID="registration-notice">
            <Text accessibilityRole="header" style={styles.modalTitle}>{notice?.title}</Text>
            <Text style={styles.modalText}>{notice?.message}</Text>
            {notice?.settings && Platform.OS !== 'web' && (
              <Pressable testID="camera-open-settings" accessibilityRole="button" accessibilityLabel="설정 열기" onPress={() => { void openSettings(); }} style={styles.close}>
                <Text style={styles.closeText}>설정 열기</Text>
              </Pressable>
            )}
            <Pressable testID="registration-notice-close" accessibilityRole="button" accessibilityLabel="확인" onPress={() => setNotice(null)} style={styles.close}>
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
  ocrSection: { gap: 16, marginBottom: 20 },
  readButton: { minHeight: 56, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14 },
  readButtonText: { color: colors.background, fontSize: 19, fontWeight: '700' },
  resultCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, padding: 20, gap: 12 },
  resultTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  resultHint: { color: colors.body, fontSize: 16, lineHeight: 25 },
  resultText: { color: colors.text, fontSize: 17, lineHeight: 28 },
  removePhoto: { minHeight: 44, padding: 12, alignSelf: 'center', justifyContent: 'center' },
  removePhotoText: { color: colors.text, fontSize: 16, fontWeight: '600' },
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
