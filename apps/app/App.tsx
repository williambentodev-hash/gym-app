import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { DOMAIN_SPIKE_OK, tonelagem } from '@gym/domain';

// Spike S2: prova que o app consome o pacote de domínio do workspace.
const volume = tonelagem([
  { reps: 8, cargaKg: 40, tipo: 'aquecimento' },
  { reps: 10, cargaKg: 60, tipo: 'trabalho' },
  { reps: 9, cargaKg: 60, tipo: 'trabalho' },
]);

export default function App() {
  return (
    <View style={styles.container}>
      <Text>{DOMAIN_SPIKE_OK}</Text>
      <Text>Tonelagem: {volume} kg (esperado: 1140)</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
