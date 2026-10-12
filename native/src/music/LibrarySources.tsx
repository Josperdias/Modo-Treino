import React from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {Btn, Icon} from '../ui';
import {C, R, T} from '../theme';
import {useMusic} from './MusicProvider';

/** De onde vêm as fitas: lista do Android, uma pasta escolhida uma vez, ou arquivos soltos. Nada é importado em massa nem apagado. */
export function SourceButtons() {
  const m = useMusic();
  return (
    <View style={S.sources}>
      <Btn kind="ghost" small icon="folder-open-outline" text="PASTA" label="Escolher uma pasta de músicas" onPress={() => { void m.addFolder(); }} style={{flex: 1}} />
      <Btn kind="ghost" small icon="document-attach-outline" text="ARQUIVOS" label="Escolher arquivos de áudio" onPress={() => { void m.importFiles(); }} style={{flex: 1}} />
      {m.permission !== 'unavailable' && <Btn kind="ghost" small icon="refresh" text="ATUALIZAR" label="Atualizar a lista de músicas do celular" onPress={() => { void m.scan(); }} style={{flex: 1}} />}
    </View>
  );
}

export function PermissionCard() {
  const m = useMusic();
  return (
    <View style={S.perm}>
      <Icon name={m.permission === 'unavailable' ? 'information-circle-outline' : 'lock-closed-outline'} size={34} color={C.ink} />
      <Text style={[T.h3, {textAlign: 'center', marginTop: 10}]}>
        {m.permission === 'unavailable' ? 'Leitura automática indisponível aqui' : 'Permita o acesso às músicas'}
      </Text>
      <Text style={[T.body, {textAlign: 'center', marginTop: 6, marginBottom: 16}]}>
        {m.permission === 'blocked' ? 'O Android bloqueou o pedido. Abra as configurações do app e libere “Música e áudio”, ou escolha uma PASTA acima (não precisa de permissão).'
          : m.permission === 'unavailable' ? 'Use PASTA ou ARQUIVOS para trazer músicas do armazenamento.'
          : 'O Modo Treino só lê a lista de músicas para mostrar suas fitas. Nada sai do aparelho. Se preferir, escolha uma PASTA acima.'}
      </Text>
      {m.permission === 'blocked'
        ? <Btn text="ABRIR CONFIGURAÇÕES" icon="settings-sharp" onPress={() => { Linking.openSettings().catch(() => {}); }} />
        : m.permission !== 'unavailable' && <Btn text={m.scanning ? 'PROCURANDO…' : 'PERMITIR E LISTAR'} icon="musical-notes" disabled={m.scanning} onPress={() => { void m.scan(); }} />}
    </View>
  );
}

const S = StyleSheet.create({
  sources: {flexDirection: 'row', gap: 8, marginBottom: 10},
  perm: {alignItems: 'center', padding: 22, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.ink},
});
