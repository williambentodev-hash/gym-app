import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { cores } from '../../ui/tema';

export default function Abas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.acento,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.separador },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: ({ color, size }) => <Ionicons name="flash" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="fichas" options={{ title: 'Fichas', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="progresso" options={{ title: 'Progresso', tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={String(color)} /> }} />
    </Tabs>
  );
}
