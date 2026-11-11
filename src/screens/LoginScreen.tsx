import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EyeIcon } from '../components/Icons';
import { NutritionIllustration } from '../components/NutritionIllustration';

export function LoginScreen({ onLogin, message = '' }: { onLogin: (email: string, password: string) => Promise<void>; message?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    if (!username.trim() || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await onLogin(username.trim(), password); }
    catch (error) { setError(error instanceof Error ? error.message : '로그인하지 못했습니다.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const [showRecovery, setShowRecovery] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width, 460);
  const artworkSize = Math.min(230, contentWidth * 0.51);
  const heroHeight = Math.max(230, Math.min(height * 0.45, 340));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(36, insets.bottom + 20) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' ? false : true}
        >
          <View style={styles.content} testID="login-screen">
            <View style={[styles.hero, { height: heroHeight }]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <NutritionIllustration size={artworkSize} />
            </View>

            <View style={styles.fields}>
              <TextInput
                accessibilityLabel="이메일"
                testID="username-input"
                value={username}
                onChangeText={setUsername}
                placeholder="FMS 계정 이메일"
                placeholderTextColor="#777777"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="email-address"
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                underlineColorAndroid="transparent"
              />
              <View style={styles.passwordField}>
                <TextInput
                  ref={passwordRef}
                  accessibilityLabel="비밀번호"
                  testID="password-input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="비밀번호"
                  placeholderTextColor="#777777"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  editable={!busy}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  underlineColorAndroid="transparent"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  accessibilityState={{ expanded: showPassword }}
                  testID="password-visibility"
                  onPress={() => setShowPassword((value) => !value)}
                  style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                >
                  <EyeIcon visible={showPassword} />
                </Pressable>
              </View>
            </View>

            {!!(error || message) && <Text testID="login-error" accessibilityRole="alert" style={styles.modalText}>{error || message}</Text>}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="로그인"
              testID="login-button"
              onPress={submit}
              disabled={busy}
              accessibilityState={{ busy, disabled: busy }}
              style={({ pressed }) => [styles.loginButton, pressed && styles.loginPressed]}
            >
              <LinearGradient colors={['#5C70AA', '#53669F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loginGradient}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginText}>로그인</Text>}
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="아이디 · 비밀번호 찾기"
              testID="recovery-button"
              onPress={() => setShowRecovery(true)}
              style={({ pressed }) => [styles.recoveryButton, pressed && styles.pressed]}
            >
              <Text style={styles.recoveryText}>아이디 · 비밀번호 찾기</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showRecovery} transparent animationType="fade" onRequestClose={() => setShowRecovery(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle} accessibilityRole="header">아이디 · 비밀번호 찾기</Text>
            <Text style={styles.modalText}>FMS에 사용하는 이메일 계정으로 로그인해 주세요. 계정이나 비밀번호를 모르면 계정을 만든 관리자에게 문의해 주세요.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="확인" onPress={() => setShowRecovery(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  content: { width: '100%', maxWidth: 460, paddingHorizontal: 24 },
  hero: { alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 14, marginHorizontal: 5 },
  input: {
    borderWidth: 1, borderColor: '#C1C7D5', borderRadius: 12,
    minHeight: 54, paddingHorizontal: 16, paddingVertical: 13,
    color: '#666666', fontSize: 18, fontWeight: '600',
  },
  passwordField: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#C1C7D5', borderRadius: 12, minHeight: 54,
  },
  passwordInput: {
    flex: 1, minWidth: 0, minHeight: 52, paddingLeft: 16,
    paddingRight: 4, paddingVertical: 13, fontSize: 18,
    fontWeight: '600', color: '#666666',
  },
  eyeButton: { width: 50, minHeight: 52, justifyContent: 'center', alignItems: 'center' },
  rememberRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 16, marginLeft: 5, minHeight: 44, gap: 13, paddingRight: 12,
  },
  checkbox: {
    width: 23, height: 23, borderRadius: 5, borderWidth: 1.3,
    borderColor: '#AEB8D0', justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#586AA7', borderColor: '#586AA7' },
  rememberText: { color: '#777777', fontSize: 17, fontWeight: '600', flexShrink: 1 },
  loginButton: { marginTop: 18, borderRadius: 12, overflow: 'hidden' },
  loginGradient: { minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  loginText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  recoveryButton: { alignSelf: 'flex-end', marginTop: 21, paddingVertical: 12, paddingHorizontal: 5, minHeight: 44 },
  recoveryText: { color: '#777777', fontSize: 16, fontWeight: '600', textAlign: 'right' },
  pressed: { opacity: 0.65 },
  loginPressed: { opacity: 0.85 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(35, 44, 68, 0.25)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: '#4F608E' },
  modalText: { marginTop: 16, fontSize: 16, lineHeight: 25, color: '#666666' },
  modalClose: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingVertical: 12, marginTop: 16, minHeight: 44 },
  modalCloseText: { color: '#53669F', fontSize: 17, fontWeight: '700' },
});

