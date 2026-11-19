// Componentes primitivos do design system: só tokens do tema, nada de cor solta.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alvoToque, cores, espaco, margemTela, raio, tipo } from './tema';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

/** Aviso que funciona também na web (no react-native-web, Alert.alert não faz nada). */
export function avisar(titulo: string, mensagem?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
  else Alert.alert(titulo, mensagem);
}

/** Confirmação (destrutiva por padrão) que funciona também na web. */
export function confirmar(titulo: string, mensagem: string, acao = 'Confirmar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${titulo}\n\n${mensagem}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: acao, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export function vibrar(intensidade: 'leve' | 'sucesso' = 'leve') {
  if (Platform.OS === 'web') return;
  if (intensidade === 'sucesso') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Tela com título grande (padrão iOS), rolagem e respiro. */
export function Tela({ titulo, subtitulo, acao, children, rolar = true }: { titulo?: string; subtitulo?: string; acao?: ReactNode; children: ReactNode; rolar?: boolean }) {
  const conteudo = (
    <>
      {titulo ? (
        <View style={estilos.cabecalho}>
          <View style={{ flex: 1 }}>
            <Text style={tipo.tituloGrande}>{titulo}</Text>
            {subtitulo ? <Text style={[tipo.apoio, { marginTop: 2 }]}>{subtitulo}</Text> : null}
          </View>
          {acao}
        </View>
      ) : null}
      {children}
    </>
  );
  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      {rolar ? <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">{conteudo}</ScrollView> : <View style={[estilos.conteudo, { flex: 1 }]}>{conteudo}</View>}
    </SafeAreaView>
  );
}

export function Cartao({ children, style, onPress, destaque }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; destaque?: boolean }) {
  const base = [estilos.cartao, destaque && { backgroundColor: cores.superficieElevada, borderColor: cores.acento }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Secao({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <View style={{ gap: espaco.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espaco.xs }}>
        <Text style={tipo.rotulo}>{titulo}</Text>
        {acao}
      </View>
      {children}
    </View>
  );
}

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';

export function Botao({ titulo, onPress, variante = 'primario', icone, desabilitado, compacto, style }: {
  titulo: string; onPress: () => void; variante?: VarianteBotao; icone?: NomeIcone; desabilitado?: boolean; compacto?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fundo = { primario: cores.acento, secundario: cores.superficieElevada, fantasma: 'transparent', perigo: 'transparent' }[variante];
  const cor = { primario: cores.textoSobreAcento, secundario: cores.texto, fantasma: cores.acento, perigo: cores.erro }[variante];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={() => {
        vibrar();
        onPress();
      }}
      style={({ pressed }) => [
        estilos.botao,
        compacto && { minHeight: 36, paddingHorizontal: espaco.m },
        { backgroundColor: pressed && variante === 'primario' ? cores.acentoPressionado : fundo, opacity: desabilitado ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {icone ? <Ionicons name={icone} size={compacto ? 16 : 18} color={cor} /> : null}
      <Text style={[tipo.destaque, { color: cor, fontSize: compacto ? 15 : 17 }]}>{titulo}</Text>
    </Pressable>
  );
}

export function BotaoIcone({ icone, onPress, cor = cores.textoSecundario, rotulo }: { icone: NomeIcone; onPress: () => void; cor?: string; rotulo: string }) {
  return (
    <Pressable accessibilityLabel={rotulo} hitSlop={8} onPress={() => { vibrar(); onPress(); }} style={({ pressed }) => [estilos.botaoIcone, pressed && { backgroundColor: cores.superficieElevada }]}>
      <Ionicons name={icone} size={20} color={cor} />
    </Pressable>
  );
}

export function Chip({ texto, ativo, onPress, cor }: { texto: string; ativo?: boolean; onPress?: () => void; cor?: string }) {
  const corTexto = ativo ? cores.acento : (cor ?? cores.textoSecundario);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[estilos.chip, ativo && { backgroundColor: cores.acentoSuave, borderColor: cores.acento }]}>
      <Text style={[tipo.nota, { color: corTexto, fontWeight: '600' }]}>{texto}</Text>
    </Pressable>
  );
}

export function Linha({ titulo, detalhe, direita, onPress, icone }: { titulo: string; detalhe?: string; direita?: ReactNode; onPress?: () => void; icone?: NomeIcone }) {
  const corpo = (
    <View style={estilos.linha}>
      {icone ? <Ionicons name={icone} size={20} color={cores.acento} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={tipo.corpo} numberOfLines={2}>{titulo}</Text>
        {detalhe ? <Text style={tipo.nota} numberOfLines={2}>{detalhe}</Text> : null}
      </View>
      {direita ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={cores.textoTerciario} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>{corpo}</Pressable> : corpo;
}

export const Separador = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: cores.separador, marginLeft: espaco.l }} />;

/** Número grande com − / + (carga, repetições, tempo): o protagonista da tela de execução. */
export function Ajustador({ rotulo, valor, onChange, passo, min = 0, max = 9999, formatar = String, sufixo }: {
  rotulo: string; valor: number; onChange: (v: number) => void; passo: number; min?: number; max?: number; formatar?: (v: number) => string; sufixo?: string;
}) {
  const ajustar = (d: number) => onChange(Math.min(max, Math.max(min, Math.round((valor + d) * 100) / 100)));
  return (
    <View style={estilos.ajustador}>
      <Text style={tipo.rotulo}>{rotulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.xs }}>
        <Pressable accessibilityLabel={`diminuir ${rotulo}`} onPress={() => { vibrar(); ajustar(-passo); }} style={estilos.passo}><Ionicons name="remove" size={22} color={cores.texto} /></Pressable>
        <View style={{ minWidth: 64, flexShrink: 1, alignItems: 'center' }}>
          <Text style={[tipo.numeroGrande, { fontSize: 40 }]} adjustsFontSizeToFit numberOfLines={1}>{formatar(valor)}</Text>
          {sufixo ? <Text style={tipo.nota}>{sufixo}</Text> : null}
        </View>
        <Pressable accessibilityLabel={`aumentar ${rotulo}`} onPress={() => { vibrar(); ajustar(passo); }} style={estilos.passo}><Ionicons name="add" size={22} color={cores.texto} /></Pressable>
      </View>
    </View>
  );
}

export function Campo(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={cores.textoTerciario} {...props} style={[estilos.campo, props.style]} />;
}

export function Vazio({ icone, titulo, texto, children }: { icone: NomeIcone; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: espaco.m, paddingVertical: espaco.xxl }}>
      <View style={estilos.vazioIcone}><Ionicons name={icone} size={28} color={cores.acento} /></View>
      <Text style={tipo.destaque}>{titulo}</Text>
      <Text style={[tipo.apoio, { textAlign: 'center', maxWidth: 300 }]}>{texto}</Text>
      {children}
    </View>
  );
}

export function Aviso({ texto, tom = 'erro' }: { texto: string; tom?: 'erro' | 'alerta' | 'sucesso' }) {
  const cor = { erro: cores.erro, alerta: cores.alerta, sucesso: cores.sucesso }[tom];
  return (
    <View style={[estilos.aviso, { borderColor: cor }]}>
      <Ionicons name={tom === 'sucesso' ? 'checkmark-circle' : 'alert-circle'} size={18} color={cor} />
      <Text style={[tipo.apoio, { color: cores.texto, flex: 1 }]}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: margemTela, gap: espaco.xl, paddingBottom: 120 },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco.m, marginTop: espaco.s },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.cartao, padding: espaco.l, gap: espaco.m, borderWidth: 1, borderColor: 'transparent' },
  botao: { minHeight: alvoToque + 6, borderRadius: raio.botao, paddingHorizontal: espaco.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.s },
  botaoIcone: { width: alvoToque, height: alvoToque, borderRadius: raio.pilula, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: espaco.m, paddingVertical: 6, borderRadius: raio.pilula, backgroundColor: cores.superficieElevada, borderWidth: 1, borderColor: 'transparent' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, minHeight: alvoToque, paddingVertical: espaco.s },
  ajustador: { alignItems: 'center', gap: espaco.xs, flex: 1 },
  passo: { width: 40, height: 40, borderRadius: raio.pilula, backgroundColor: cores.superficieElevada, alignItems: 'center', justifyContent: 'center' },
  campo: { minHeight: alvoToque + 4, borderRadius: raio.botao, backgroundColor: cores.superficieElevada, color: cores.texto, paddingHorizontal: espaco.l, fontSize: 17 },
  vazioIcone: { width: 56, height: 56, borderRadius: raio.pilula, backgroundColor: cores.acentoSuave, alignItems: 'center', justifyContent: 'center' },
  aviso: { flexDirection: 'row', gap: espaco.s, alignItems: 'center', padding: espaco.m, borderRadius: raio.botao, borderWidth: 1, backgroundColor: cores.superficie },
});
