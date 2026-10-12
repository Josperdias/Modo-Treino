/** Tipografia do app: Barlow Condensed (títulos, números, rótulos fortes) e DM Sans (texto). Fontes OFL embutidas.
 * O peso pedido no estilo escolhe a fonte; assim as telas continuam escrevendo `fontWeight: '900'` e funciona igual no Android e no navegador. */
import React from 'react';
import {StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, TextStyle} from 'react-native';

export const FONT = {
  display: 'BarlowCondensed_900Black',
  displayBold: 'BarlowCondensed_800ExtraBold',
  bold: 'DMSans_700Bold',
  medium: 'DMSans_500Medium',
  regular: 'DMSans_400Regular',
} as const;

/** Barlow Condensed é mais estreita: aumenta o corpo para ter o mesmo peso visual do DM Sans. */
const DISPLAY_SCALE = 1.2;

function resolve(style: TextStyle): TextStyle {
  const {fontWeight, fontFamily, fontSize, lineHeight, letterSpacing, ...rest} = style;
  if (fontFamily) return style;
  const w = String(fontWeight ?? '400');
  const display = w === '900' || w === '800' && !!fontSize && fontSize >= 28;
  const family = display ? FONT.display : w === '800' || w === '700' || w === 'bold' ? FONT.bold : w === '600' || w === '500' ? FONT.medium : FONT.regular;
  const out: TextStyle = {...rest, fontFamily: family};
  if (fontSize != null) out.fontSize = display ? Math.round(fontSize * DISPLAY_SCALE) : fontSize;
  if (lineHeight != null) out.lineHeight = display ? Math.round(lineHeight * DISPLAY_SCALE) : lineHeight;
  if (letterSpacing != null) out.letterSpacing = display ? (letterSpacing < 0 ? letterSpacing * 0.25 : letterSpacing) : letterSpacing;
  return out;
}

const Nested = React.createContext(false);
export function Text({style, children, ...props}: TextProps) {
  const nested = React.useContext(Nested);
  const flat = StyleSheet.flatten(style) || {};
  // Texto dentro de outro Text herda a fonte do pai (só cor/tamanho mudam), como no HTML.
  const inherit = nested && flat.fontWeight == null && flat.fontFamily == null;
  return (
    <RNText {...props} style={inherit ? flat : resolve(flat)}>
      <Nested.Provider value>{children}</Nested.Provider>
    </RNText>
  );
}
export function TextInput({style, ...props}: TextInputProps) {
  return <RNTextInput {...props} style={[{fontFamily: FONT.medium}, style]} />;
}
