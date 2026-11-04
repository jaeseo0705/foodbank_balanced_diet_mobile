import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';

export default function App() {
  // Keep navigation in memory only. A new process always starts at login.
  // Backgrounding the app does not reset the current screen.
  const [hasEntered, setHasEntered] = useState(false);

  function enterApp() {
    Keyboard.dismiss();
    setHasEntered(true);
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {hasEntered ? (
        <View
          testID="blank-screen"
          accessibilityLabel="빈 화면"
          style={styles.blank}
        />
      ) : (
        <LoginScreen onLogin={enterApp} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: '#FFFFFF' },
});
