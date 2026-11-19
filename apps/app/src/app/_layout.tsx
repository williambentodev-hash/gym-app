import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../aplicacao/contexto';
import { cores } from '../ui/tema';

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <View style={{ flex: 1, backgroundColor: cores.fundo }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: cores.fundo },
              headerTintColor: cores.acento,
              headerTitleStyle: { color: cores.texto, fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: cores.fundo },
              headerBackTitle: 'Voltar',
            }}
          >
            <Stack.Screen name="(abas)" options={{ headerShown: false }} />
            <Stack.Screen name="ficha/[fichaId]" options={{ title: 'Ficha' }} />
            <Stack.Screen name="catalogo" options={{ presentation: 'modal', title: 'Exercícios' }} />
            <Stack.Screen name="prescricao" options={{ presentation: 'modal', title: 'Prescrição' }} />
            <Stack.Screen name="execucao/[sessaoId]" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="privacidade" options={{ title: '' }} />
          </Stack>
        </View>
      </AppProvider>
    </SafeAreaProvider>
  );
}
