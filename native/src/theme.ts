import {StyleSheet, useWindowDimensions} from 'react-native';

export const C = {
  ink: '#141B34',
  navy: '#101733',
  navy2: '#1B2547',
  paper: '#F5F2EB',
  card: '#FFFEFA',
  soft: '#EFEAE0',
  line: '#E6E1D7',
  muted: '#6B7389',
  yellow: '#FFD369',
  pink: '#E9A0BF',
  rose: '#F6C9D8',
  sky: '#AAC8F8',
  blue: '#4674DB',
  mint: '#B7EFCE',
  green: '#1B846A',
  white: '#FFFFFF',
};

export const R = {sm: 12, md: 18, lg: 24, xl: 30, pill: 999};
/** Contorno de tinta: assinatura visual do Modo Treino (cartões, botões, selos). */
export const INK = {borderWidth: 2, borderColor: '#141B34'} as const;

export const shadow = {
  soft: {shadowColor: '#141B34', shadowOpacity: 0.08, shadowOffset: {width: 0, height: 6}, shadowRadius: 16, elevation: 3},
  lift: {shadowColor: '#141B34', shadowOpacity: 0.16, shadowOffset: {width: 0, height: 10}, shadowRadius: 22, elevation: 8},
};

export const T = StyleSheet.create({
  kicker: {fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: C.muted, textTransform: 'uppercase'},
  h1: {fontSize: 36, fontWeight: '900', letterSpacing: -1.4, color: C.ink, lineHeight: 37, textTransform: 'uppercase'},
  h2: {fontSize: 22, fontWeight: '900', letterSpacing: -0.6, color: C.ink, textTransform: 'uppercase'},
  h3: {fontSize: 16, fontWeight: '800', color: C.ink},
  body: {fontSize: 14, lineHeight: 21, color: C.muted},
  small: {fontSize: 12, color: C.muted},
});

/** Celulares estreitos (≤ 360 dp): telas encolhem títulos e botões para nada ser cortado. */
export const useNarrow = () => useWindowDimensions().width <= 360;
