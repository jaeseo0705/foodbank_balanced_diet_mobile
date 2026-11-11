import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon, ProfileAvatar, type TaskId } from '../components/TaskIcons';
import { colors } from '../theme';
import { TaskSelectionScreen, tasks } from './TaskSelectionScreen';
import { FmsNutritionScreen } from './FmsNutritionScreen';

type Screen = 'home' | TaskId | 'profile' | 'settings' | 'about';

export function WorkspaceScreen({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('home');
  const backTarget = screen === 'settings' || screen === 'about' ? 'profile' : 'home';

  useEffect(() => {
    if (screen === 'home') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(backTarget);
      return true;
    });
    return () => subscription.remove();
  }, [screen, backTarget]);

  if (screen === 'home') {
    return <TaskSelectionScreen onSelectTask={setScreen} onOpenProfile={() => setScreen('profile')} />;
  }

  if (screen === 'nutrition-registration') {
    return <FmsNutritionScreen onBack={() => setScreen('home')} />;
  }

  const title = screen === 'profile' ? '프로필'
    : screen === 'settings' ? '설정'
    : screen === 'about' ? '앱 정보'
    : tasks.find((task) => task.id === screen)?.label ?? '';

  return (
    <SafeAreaView style={styles.screen} testID={screen === 'profile' ? 'profile-screen' : 'section-screen'}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            testID="back-button"
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={() => setScreen(backTarget)}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <BackIcon />
          </Pressable>
          <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
        </View>

        {screen === 'profile' && (
          <ScrollView contentContainerStyle={styles.profileContent}>
            <View style={styles.avatar}><ProfileAvatar size={72} /></View>
            <View style={styles.menu}>
              <MenuRow label="설정" onPress={() => setScreen('settings')} />
              <MenuRow label="앱 정보" onPress={() => setScreen('about')} />
              <MenuRow label="로그아웃" onPress={onLogout} last />
            </View>
          </ScrollView>
        )}

        {screen === 'about' && (
          <View style={styles.about}>
            <Text style={styles.appName}>영양성분 등록</Text>
            <Text style={styles.aboutText}>버전 1.0.0</Text>
            <Text style={styles.aboutText}>푸드뱅크 업무 개선을 위한 학습·시연용 앱입니다.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function MenuRow({ label, onPress, last = false }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, !last && styles.separator, pressed && styles.pressed]}
    >
      <Text style={styles.menuLabel}>{label}</Text>
      <Text accessible={false} style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 500, flex: 1, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 20, minHeight: 68 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  heading: { fontSize: 23, fontWeight: '700', color: colors.text, flexShrink: 1 },
  profileContent: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32 },
  avatar: { alignItems: 'center', paddingBottom: 32 },
  menu: { borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardTop, overflow: 'hidden' },
  menuRow: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  menuLabel: { color: colors.text, fontSize: 17 },
  chevron: { color: colors.avatarPerson, fontSize: 24 },
  about: { padding: 28, gap: 14 },
  appName: { fontSize: 21, fontWeight: '600', color: colors.text },
  aboutText: { fontSize: 16, lineHeight: 25, color: colors.body },
  pressed: { opacity: 0.65 },
});

