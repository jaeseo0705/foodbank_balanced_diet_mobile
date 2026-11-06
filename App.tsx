import { useState } from 'react';
import { Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';

export default function App() {
  // Session state stays in memory: a fresh launch always starts at login.
  const [hasEntered, setHasEntered] = useState(false);

  function enterApp() {
    Keyboard.dismiss();
    setHasEntered(true);
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {hasEntered ? (
        <WorkspaceScreen onLogout={() => setHasEntered(false)} />
      ) : (
        <LoginScreen onLogin={enterApp} />
      )}
    </SafeAreaProvider>
  );
}
