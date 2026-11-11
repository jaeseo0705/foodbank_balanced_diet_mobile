import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';
import { createFmsClient } from './src/lib/fmsCloud';
import { FmsCloudContext } from './src/context/FmsCloudContext';

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const [client] = useState(() => createFmsClient(() => {
    if (mounted.current) { setHasEntered(false); setMessage('로그인이 만료됐습니다. 다시 로그인해 주세요.'); }
  }));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; client.clear(); }; }, [client]);
  async function enterApp(email: string, password: string) {
    await client.signIn(email, password);
    if (mounted.current) { Keyboard.dismiss(); setMessage(''); setHasEntered(true); }
  }
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <FmsCloudContext.Provider value={client}>
      {hasEntered ? <WorkspaceScreen onLogout={() => { client.clear(); setHasEntered(false); }} />
        : <LoginScreen onLogin={enterApp} message={message} />}
    </FmsCloudContext.Provider>
  </SafeAreaProvider>;
}
