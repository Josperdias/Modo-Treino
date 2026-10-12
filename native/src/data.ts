import type {ImageSourcePropType} from 'react-native';
import raw from '../exercises.json';

export type Persona = 'vinho' | 'loira';
export type Treino = 'A' | 'B';
export type Exercise = {
  id: string; treino: Treino; grupo: string; nome: string; peso: string; series: number; reps: number;
  imagem: string | null; imagemAlternativa: string | null; nota: string; orientacao: string; codigo: string;
};

export const EXERCISES = raw as Exercise[];

// Cada nome de arquivo é uma chave técnica herdada das ilustrações; "loira" é só o id do arquivo da Camila Camomila (a ruivinha).
const FILES: Record<string, ImageSourcePropType> = {
  'alta_loira.png': require('../assets/exercicios/alta_loira.jpg'),
  'alta_vinho.png': require('../assets/exercicios/alta_vinho.jpg'),
  'barra_w_vinho.png': require('../assets/exercicios/barra_w_vinho.jpg'),
  'concentrada_loira.png': require('../assets/exercicios/concentrada_loira.jpg'),
  'concentrada_vinho.png': require('../assets/exercicios/concentrada_vinho.jpg'),
  'crucifixo_loira.png': require('../assets/exercicios/crucifixo_loira.jpg'),
  'crucifixo_vinho.png': require('../assets/exercicios/crucifixo_vinho.jpg'),
  'encolhimento_loira.png': require('../assets/exercicios/encolhimento_loira.jpg'),
  'encolhimento_barra_vinho.png': require('../assets/exercicios/encolhimento_barra_vinho.jpg'),
  'frontal_loira.png': require('../assets/exercicios/frontal_loira.jpg'),
  'frontal_vinho.png': require('../assets/exercicios/frontal_vinho.jpg'),
  'lateral_loira.png': require('../assets/exercicios/lateral_loira.jpg'),
  'lateral_vinho.png': require('../assets/exercicios/lateral_vinho.jpg'),
  'martelo_frente_loira.png': require('../assets/exercicios/martelo_frente_loira.jpg'),
  'martelo_frente_vinho.png': require('../assets/exercicios/martelo_frente_vinho.jpg'),
  'martelo_loira.png': require('../assets/exercicios/martelo_loira.jpg'),
  'martelo_vinho.png': require('../assets/exercicios/martelo_vinho.jpg'),
  'pullover_loira.png': require('../assets/exercicios/pullover_loira.jpg'),
  'pullover_vinho.png': require('../assets/exercicios/pullover_vinho.jpg'),
  'scott_vinho.png': require('../assets/exercicios/scott_vinho.jpg'),
  'supino_vinho.png': require('../assets/exercicios/supino_vinho.jpg'),
  'unilateral_vinho.png': require('../assets/exercicios/unilateral_vinho.jpg'),
};

export const file = (name: string): ImageSourcePropType => FILES[name] || FILES['lateral_vinho.png'];
const asset = (path: string | null) => file(path?.split('/').at(-1) || '');

export type ImageStatus = 'ok' | 'fallback' | 'missing';
export type ImageInfo = {image: ImageSourcePropType; status: ImageStatus; label: string; note: string};

/** Escolhe a ilustração certa e diz com honestidade quando ela é um substituto ou apenas capa decorativa. */
export function imageInfo(e: Exercise, persona: Persona): ImageInfo {
  if (!e.imagem) return {image: file('lateral_vinho.png'), status: 'missing', label: 'SEM IMAGEM DO EXERCÍCIO', note: 'Imagem do movimento indisponível. Josperd aparece apenas como capa.'};
  if (persona === 'loira') {
    return e.imagemAlternativa
      ? {image: asset(e.imagemAlternativa), status: 'ok', label: 'CAMILA CAMOMILA', note: 'Ilustração da Camila'}
      : {image: asset(e.imagem), status: 'fallback', label: 'CAMILA SEM IMAGEM', note: 'Ilustração da Camila indisponível — exibindo Josperd.'};
  }
  return {image: asset(e.imagem), status: 'ok', label: 'JOSPERD', note: 'Ilustração de Josperd'};
}

export const personaName = (p: Persona) => (p === 'loira' ? 'Camila Camomila, a ruivinha' : 'Josperd');
export const personaShort = (p: Persona) => (p === 'loira' ? 'Camila' : 'Josperd');
export const treinoTitle = (t: Treino) => (t === 'A' ? 'Bíceps, costas e trapézio' : 'Bíceps, peito e ombro');
