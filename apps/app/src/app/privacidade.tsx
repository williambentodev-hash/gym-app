// Política de privacidade (ADR-0014). Texto curto e honesto, coerente com a arquitetura real.
import { Text, View } from 'react-native';
import { Cartao, Tela } from '../ui/componentes';
import { espaco, tipo } from '../ui/tema';

const SECOES: Array<[string, string]> = [
  ['Quem somos', 'O gym.app é um aplicativo pessoal, sem fins comerciais, usado pelo seu criador e por familiares convidados.'],
  ['O que coletamos', 'Da sua conta Google: nome, e-mail e foto (para identificar você). Do uso do app: fichas, treinos, séries, cargas e exercícios personalizados que você registra. Tecnicamente: um identificador aleatório de cada aparelho e dados da sessão de login (data, navegador/aparelho).'],
  ['O que NÃO coletamos', 'Não guardamos os tokens de acesso da sua conta Google (usamos o Google só para entrar), não acessamos contatos, localização, câmera nem microfone, e não há anúncios nem rastreadores.'],
  ['Para que usamos', 'Exclusivamente para o funcionamento do app: guardar seus treinos, sincronizá-los entre seus aparelhos, calcular sugestões de carga e seu progresso e, quando você pedir, gerar uma proposta de ficha com IA. Não vendemos seus dados.'],
  ['Inteligência artificial', 'Ao usar "Montar com IA", enviamos à Anthropic (provedora do modelo Claude) apenas os parâmetros de treino que você preencher: objetivo, nível, dias, tempo, local, prioridades e, se você escrever, limitações e observações. Não enviamos nome, e-mail nem seu identificador. A IA só propõe a ficha: nada é salvo sem a sua confirmação.'],
  ['Onde ficam', 'Primeiro no seu aparelho. Quando você está logado, uma cópia é sincronizada com um armazenamento isolado, só seu, na Cloudflare (provedor de nuvem), possivelmente em servidores fora do Brasil, com proteção em trânsito (HTTPS).'],
  ['Por quanto tempo', 'Enquanto sua conta existir. Ao excluir a conta, apagamos seus treinos e dados de login da nuvem e do aparelho em que você fez a exclusão.'],
  ['Seus direitos', 'Na aba Conta você pode, a qualquer momento: exportar todos os seus dados (arquivo JSON), apagar os dados de um aparelho e excluir sua conta. Esses são os direitos de acesso, portabilidade e eliminação previstos na LGPD (art. 18).'],
  ['Saúde', 'Os registros de treino não são aconselhamento médico. As sugestões são regras de treino simples e você sempre decide.'],
];

export default function Privacidade() {
  return (
    <Tela titulo="Privacidade" subtitulo="Versão de 19/11/2026">
      {SECOES.map(([titulo, texto]) => (
        <Cartao key={titulo}>
          <Text style={tipo.destaque}>{titulo}</Text>
          <Text style={[tipo.apoio, { lineHeight: 22 }]}>{texto}</Text>
        </Cartao>
      ))}
      <View style={{ height: espaco.l }} />
    </Tela>
  );
}
