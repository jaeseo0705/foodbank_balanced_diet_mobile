import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileAvatar, TaskIcon, type TaskId } from '../components/TaskIcons';
import { colors } from '../theme';

export const tasks: ReadonlyArray<{ id: TaskId; label: string }> = [
  { id: 'nutrition-registration', label: '영양성분 등록' },
  { id: 'inventory', label: '재고 현황' },
  { id: 'distribution', label: '배분 추천' },
  { id: 'nutrition-calculation', label: '영양 계산' },
];

type Props = {
  onSelectTask: (task: TaskId) => void;
  onOpenProfile: () => void;
};

export function TaskSelectionScreen({ onSelectTask, onOpenProfile }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, 500);
  const sideInset = contentWidth * 0.09;
  const cardWidth = contentWidth - sideInset * 2;
  const cardHeight = Math.max(92, Math.min(140, contentWidth * 0.29));
  const iconSize = cardHeight * 0.78;
  const labelSize = Math.max(16, Math.min(20, contentWidth * 0.046));
  const gap = Math.max(12, contentWidth * 0.032);
  const availableHeight = height - insets.top - insets.bottom;
  const headerTop = Math.max(24, Math.min(80, availableHeight * 0.08));
  const listTop = Math.max(32, Math.min(76, availableHeight * 0.09));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        testID="task-selection-screen"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth, paddingTop: headerTop }]}>
          <View style={[styles.header, { paddingHorizontal: contentWidth * 0.06 }]}>
            <Text accessibilityRole="header" style={styles.title}>업무 선택</Text>
            <Pressable
              testID="profile-button"
              accessibilityRole="button"
              accessibilityLabel="프로필"
              onPress={onOpenProfile}
              style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
            >
              <ProfileAvatar size={40} />
            </Pressable>
          </View>

          <View
            testID="task-list"
            style={{ marginTop: listTop, paddingHorizontal: sideInset, gap }}
          >
            {tasks.map((task) => (
              <Pressable
                key={task.id}
                testID={`task-${task.id}`}
                accessibilityRole="button"
                accessibilityLabel={task.label}
                onPress={() => onSelectTask(task.id)}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth },
                  pressed && styles.cardPressed,
                ]}
              >
                <LinearGradient
                  colors={[colors.cardTop, colors.cardBottom]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={[
                    styles.cardSurface,
                    { minHeight: cardHeight, paddingHorizontal: cardWidth * 0.075, gap: cardWidth * 0.065 },
                  ]}
                >
                  <View
                    testID={`icon-${task.id}`}
                    style={[styles.iconSlot, { width: iconSize, height: iconSize }]}
                  >
                    <TaskIcon task={task.id} size={iconSize} />
                  </View>
                  <Text
                    testID={`label-${task.id}`}
                    style={[styles.taskLabel, { fontSize: labelSize, lineHeight: labelSize * 1.4 }]}
                  >
                    {task.label}
                  </Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
  content: { alignSelf: 'center' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, flexShrink: 1, marginRight: 12 },
  profileButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  iconSlot: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: 16,
    backgroundColor: colors.cardTop,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSurface: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder,
    paddingVertical: 12,
  },
  taskLabel: {
    flex: 1, color: colors.text, fontWeight: '600', textAlign: 'left',
    includeFontPadding: false,
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.7 },
});
