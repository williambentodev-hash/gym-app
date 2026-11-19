// Curadoria do catálogo (ADR-0013): os 100 exercícios mais comuns em treinos de academia.
// Nomes em português, modalidade, grupos e composto/isolado definidos À MÃO (não vêm da origem).
// Da origem (ADR-0011) usamos apenas o ID estável e as URLs das mídias, que são referenciadas, não copiadas.

export type Modalidade = 'carga_repeticoes' | 'peso_corporal' | 'tempo' | 'cardio';
export type Grupo =
  | 'peito' | 'costas' | 'lombar' | 'trapezio' | 'ombros' | 'biceps' | 'triceps' | 'antebracos'
  | 'quadriceps' | 'posteriores' | 'gluteos' | 'adutores' | 'abdutores' | 'panturrilhas' | 'abdomen' | 'cardio';
export type Equipamento = 'barra' | 'barra_w' | 'halteres' | 'polia' | 'maquina' | 'smith' | 'kettlebell' | 'peso_corporal' | 'cardio';

/** [idNaOrigem, nome, modalidade, composto, grupoPrincipal, gruposSecundarios, equipamento] */
type Linha = [string, string, Modalidade, boolean, Grupo, Grupo[], Equipamento];

const CR = 'carga_repeticoes', PC = 'peso_corporal', TP = 'tempo', CA = 'cardio';
const C = true, I = false;

export const CURADORIA: readonly Linha[] = [
  // Peito (13)
  ['pectorals/barbell-bench-press', 'Supino reto com barra', CR, C, 'peito', ['triceps', 'ombros'], 'barra'],
  ['pectorals/barbell-incline-bench-press', 'Supino inclinado com barra', CR, C, 'peito', ['ombros', 'triceps'], 'barra'],
  ['pectorals/barbell-decline-bench-press', 'Supino declinado com barra', CR, C, 'peito', ['triceps'], 'barra'],
  ['pectorals/dumbbell-bench-press', 'Supino reto com halteres', CR, C, 'peito', ['triceps', 'ombros'], 'halteres'],
  ['pectorals/dumbbell-incline-bench-press', 'Supino inclinado com halteres', CR, C, 'peito', ['ombros', 'triceps'], 'halteres'],
  ['pectorals/smith-bench-press', 'Supino reto no Smith', CR, C, 'peito', ['triceps', 'ombros'], 'smith'],
  ['pectorals/lever-chest-press', 'Supino na máquina', CR, C, 'peito', ['triceps', 'ombros'], 'maquina'],
  ['pectorals/dumbbell-fly', 'Crucifixo reto com halteres', CR, I, 'peito', ['ombros'], 'halteres'],
  ['pectorals/dumbbell-incline-fly', 'Crucifixo inclinado com halteres', CR, I, 'peito', ['ombros'], 'halteres'],
  ['pectorals/cable-standing-fly', 'Crossover na polia', CR, I, 'peito', ['ombros'], 'polia'],
  ['pectorals/lever-seated-fly', 'Voador (peck deck)', CR, I, 'peito', ['ombros'], 'maquina'],
  ['pectorals/push-up', 'Flexão de braço', PC, C, 'peito', ['triceps', 'ombros'], 'peso_corporal'],
  ['pectorals/chest-dip', 'Paralelas (ênfase no peito)', PC, C, 'peito', ['triceps', 'ombros'], 'peso_corporal'],

  // Costas (15)
  ['lats/pull-up', 'Barra fixa pronada', PC, C, 'costas', ['biceps'], 'peso_corporal'],
  ['lats/chin-up', 'Barra fixa supinada', PC, C, 'costas', ['biceps'], 'peso_corporal'],
  ['lats/assisted-pull-up', 'Barra fixa assistida', PC, C, 'costas', ['biceps'], 'maquina'],
  ['lats/cable-lat-pulldown-full-range-of-motion', 'Puxada frontal na polia', CR, C, 'costas', ['biceps'], 'polia'],
  ['lats/cable-lateral-pulldown-with-v-bar', 'Puxada com triângulo', CR, C, 'costas', ['biceps'], 'polia'],
  ['lats/reverse-grip-machine-lat-pulldown', 'Puxada supinada na máquina', CR, C, 'costas', ['biceps'], 'maquina'],
  ['lats/cable-straight-arm-pulldown', 'Pulldown com braços estendidos', CR, I, 'costas', [], 'polia'],
  ['upper-back/barbell-bent-over-row', 'Remada curvada com barra', CR, C, 'costas', ['biceps', 'lombar'], 'barra'],
  ['upper-back/dumbbell-one-arm-bent-over-row', 'Remada unilateral com halter (serrote)', CR, C, 'costas', ['biceps'], 'halteres'],
  ['upper-back/cable-seated-row', 'Remada baixa na polia', CR, C, 'costas', ['biceps'], 'polia'],
  ['upper-back/lever-t-bar-row', 'Remada cavalinho (T-bar)', CR, C, 'costas', ['biceps', 'lombar'], 'maquina'],
  ['upper-back/lever-seated-row', 'Remada sentada na máquina', CR, C, 'costas', ['biceps'], 'maquina'],
  ['upper-back/barbell-pendlay-row', 'Remada Pendlay', CR, C, 'costas', ['biceps', 'lombar'], 'barra'],
  ['upper-back/inverted-row', 'Remada invertida', PC, C, 'costas', ['biceps'], 'peso_corporal'],
  ['lats/barbell-pullover', 'Pullover com barra', CR, I, 'costas', ['peito'], 'barra'],

  // Cadeia posterior e trapézio (5)
  ['glutes/barbell-deadlift', 'Levantamento terra', CR, C, 'posteriores', ['gluteos', 'lombar', 'costas', 'trapezio'], 'barra'],
  ['spine/hyperextension', 'Hiperextensão lombar (banco romano)', PC, I, 'lombar', ['gluteos', 'posteriores'], 'peso_corporal'],
  ['hamstrings/barbell-good-morning', 'Bom-dia com barra', CR, C, 'posteriores', ['lombar', 'gluteos'], 'barra'],
  ['traps/barbell-shrug', 'Encolhimento com barra', CR, I, 'trapezio', [], 'barra'],
  ['traps/dumbbell-shrug', 'Encolhimento com halteres', CR, I, 'trapezio', [], 'halteres'],

  // Ombros (11)
  ['delts/barbell-seated-overhead-press', 'Desenvolvimento com barra', CR, C, 'ombros', ['triceps'], 'barra'],
  ['delts/dumbbell-seated-shoulder-press', 'Desenvolvimento com halteres', CR, C, 'ombros', ['triceps'], 'halteres'],
  ['delts/lever-shoulder-press', 'Desenvolvimento na máquina', CR, C, 'ombros', ['triceps'], 'maquina'],
  ['delts/dumbbell-arnold-press', 'Desenvolvimento Arnold', CR, C, 'ombros', ['triceps'], 'halteres'],
  ['delts/dumbbell-lateral-raise', 'Elevação lateral com halteres', CR, I, 'ombros', [], 'halteres'],
  ['delts/cable-lateral-raise', 'Elevação lateral na polia', CR, I, 'ombros', [], 'polia'],
  ['delts/dumbbell-front-raise', 'Elevação frontal com halteres', CR, I, 'ombros', [], 'halteres'],
  ['delts/dumbbell-reverse-fly', 'Crucifixo invertido com halteres', CR, I, 'ombros', ['costas'], 'halteres'],
  ['delts/lever-seated-reverse-fly', 'Crucifixo invertido na máquina', CR, I, 'ombros', ['costas'], 'maquina'],
  ['delts/cable-rear-delt-row-with-rope', 'Face pull na polia', CR, I, 'ombros', ['costas', 'trapezio'], 'polia'],
  ['delts/barbell-upright-row', 'Remada alta com barra', CR, C, 'ombros', ['trapezio'], 'barra'],

  // Bíceps (9)
  ['biceps/barbell-curl', 'Rosca direta com barra', CR, I, 'biceps', ['antebracos'], 'barra'],
  ['biceps/ez-barbell-curl', 'Rosca direta com barra W', CR, I, 'biceps', ['antebracos'], 'barra_w'],
  ['biceps/dumbbell-alternate-biceps-curl', 'Rosca alternada com halteres', CR, I, 'biceps', ['antebracos'], 'halteres'],
  ['biceps/dumbbell-hammer-curl', 'Rosca martelo', CR, I, 'biceps', ['antebracos'], 'halteres'],
  ['biceps/barbell-preacher-curl', 'Rosca Scott com barra', CR, I, 'biceps', [], 'barra'],
  ['biceps/dumbbell-concentration-curl', 'Rosca concentrada', CR, I, 'biceps', [], 'halteres'],
  ['biceps/cable-curl', 'Rosca na polia', CR, I, 'biceps', ['antebracos'], 'polia'],
  ['biceps/dumbbell-incline-curl', 'Rosca inclinada com halteres', CR, I, 'biceps', [], 'halteres'],
  ['biceps/barbell-reverse-curl', 'Rosca inversa com barra', CR, I, 'antebracos', ['biceps'], 'barra'],

  // Tríceps (8)
  ['triceps/cable-pushdown', 'Tríceps pulley (barra)', CR, I, 'triceps', [], 'polia'],
  ['triceps/cable-pushdown-with-rope-attachment', 'Tríceps na corda', CR, I, 'triceps', [], 'polia'],
  ['triceps/barbell-lying-triceps-extension-skull-crusher', 'Tríceps testa com barra', CR, I, 'triceps', [], 'barra'],
  ['triceps/cable-overhead-triceps-extension-rope-attachment', 'Tríceps francês na polia (corda)', CR, I, 'triceps', [], 'polia'],
  ['triceps/barbell-seated-overhead-triceps-extension', 'Tríceps francês com barra', CR, I, 'triceps', [], 'barra'],
  ['triceps/dumbbell-kickback', 'Tríceps coice com halter', CR, I, 'triceps', [], 'halteres'],
  ['triceps/triceps-dip', 'Paralelas (ênfase no tríceps)', PC, C, 'triceps', ['peito', 'ombros'], 'peso_corporal'],
  ['triceps/barbell-close-grip-bench-press', 'Supino fechado', CR, C, 'triceps', ['peito', 'ombros'], 'barra'],

  // Pernas e glúteos (24)
  ['glutes/barbell-full-squat', 'Agachamento livre com barra', CR, C, 'quadriceps', ['gluteos', 'posteriores', 'lombar'], 'barra'],
  ['glutes/barbell-front-squat', 'Agachamento frontal com barra', CR, C, 'quadriceps', ['gluteos'], 'barra'],
  ['glutes/smith-squat', 'Agachamento no Smith', CR, C, 'quadriceps', ['gluteos'], 'smith'],
  ['quads/dumbbell-goblet-squat', 'Agachamento goblet', CR, C, 'quadriceps', ['gluteos'], 'halteres'],
  ['glutes/sled-hack-squat', 'Hack squat', CR, C, 'quadriceps', ['gluteos'], 'maquina'],
  ['glutes/sled-45-leg-press', 'Leg press 45°', CR, C, 'quadriceps', ['gluteos', 'posteriores'], 'maquina'],
  ['quads/lever-leg-extension', 'Cadeira extensora', CR, I, 'quadriceps', [], 'maquina'],
  ['hamstrings/lever-lying-leg-curl', 'Mesa flexora', CR, I, 'posteriores', [], 'maquina'],
  ['hamstrings/lever-seated-leg-curl', 'Cadeira flexora', CR, I, 'posteriores', [], 'maquina'],
  ['glutes/barbell-romanian-deadlift', 'Stiff com barra', CR, C, 'posteriores', ['gluteos', 'lombar'], 'barra'],
  ['glutes/dumbbell-romanian-deadlift', 'Stiff com halteres', CR, C, 'posteriores', ['gluteos', 'lombar'], 'halteres'],
  ['glutes/barbell-sumo-deadlift', 'Levantamento terra sumô', CR, C, 'gluteos', ['quadriceps', 'posteriores', 'adutores', 'lombar'], 'barra'],
  ['glutes/barbell-lunge', 'Avanço com barra', CR, C, 'quadriceps', ['gluteos'], 'barra'],
  ['glutes/dumbbell-lunge', 'Avanço com halteres', CR, C, 'quadriceps', ['gluteos'], 'halteres'],
  ['quads/dumbbell-single-leg-split-squat', 'Agachamento búlgaro com halteres', CR, C, 'quadriceps', ['gluteos'], 'halteres'],
  ['glutes/dumbbell-step-up', 'Subida no banco com halteres', CR, C, 'quadriceps', ['gluteos'], 'halteres'],
  ['glutes/barbell-glute-bridge-two-legs-on-bench-male', 'Elevação pélvica com barra (hip thrust)', CR, C, 'gluteos', ['posteriores'], 'barra'],
  ['glutes/low-glute-bridge-on-floor', 'Ponte de glúteo', PC, I, 'gluteos', ['posteriores'], 'peso_corporal'],
  ['abductors/lever-seated-hip-abduction', 'Cadeira abdutora', CR, I, 'abdutores', ['gluteos'], 'maquina'],
  ['adductors/lever-seated-hip-adduction', 'Cadeira adutora', CR, I, 'adutores', [], 'maquina'],
  ['glutes/cable-standing-hip-extension', 'Glúteo na polia (coice)', CR, I, 'gluteos', ['posteriores'], 'polia'],
  ['calves/lever-standing-calf-raise', 'Panturrilha em pé na máquina', CR, I, 'panturrilhas', [], 'maquina'],
  ['calves/lever-seated-calf-raise', 'Panturrilha sentado na máquina', CR, I, 'panturrilhas', [], 'maquina'],
  ['calves/sled-calf-press-on-leg-press', 'Panturrilha no leg press', CR, I, 'panturrilhas', [], 'maquina'],

  // Core (8)
  ['abs/weighted-front-plank', 'Prancha', TP, I, 'abdomen', [], 'peso_corporal'],
  ['abs/side-bridge-v-2', 'Prancha lateral', TP, I, 'abdomen', [], 'peso_corporal'],
  ['abs/crunch-floor', 'Abdominal supra (crunch)', PC, I, 'abdomen', [], 'peso_corporal'],
  ['abs/hanging-leg-raise', 'Elevação de pernas na barra', PC, I, 'abdomen', [], 'peso_corporal'],
  ['abs/lying-leg-raise-flat-bench', 'Elevação de pernas no banco', PC, I, 'abdomen', [], 'peso_corporal'],
  ['abs/russian-twist', 'Abdominal russo (rotação)', PC, I, 'abdomen', [], 'peso_corporal'],
  ['abs/cable-kneeling-crunch', 'Abdominal na polia', CR, I, 'abdomen', [], 'polia'],
  ['abs/wheel-rollerout', 'Roda abdominal', PC, I, 'abdomen', [], 'peso_corporal'],

  // Condicionamento e cardio (7)
  ['glutes/kettlebell-swing', 'Kettlebell swing', CR, C, 'gluteos', ['posteriores', 'lombar'], 'kettlebell'],
  ['cardio/burpee', 'Burpee', PC, C, 'cardio', ['peito', 'quadriceps'], 'peso_corporal'],
  ['cardio/mountain-climber', 'Escalador', PC, C, 'abdomen', ['ombros'], 'peso_corporal'],
  ['cardio/jump-rope', 'Pular corda', CA, I, 'cardio', ['panturrilhas'], 'cardio'],
  ['cardio/walking-on-incline-treadmill', 'Esteira', CA, I, 'cardio', [], 'cardio'],
  ['cardio/stationary-bike-walk', 'Bicicleta ergométrica', CA, I, 'cardio', [], 'cardio'],
  ['cardio/walk-elliptical-cross-trainer', 'Elíptico', CA, I, 'cardio', [], 'cardio'],
];
