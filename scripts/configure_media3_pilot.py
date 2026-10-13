#!/usr/bin/env python3
"""Marca somente o APK release experimental com outro applicationId, evitando sobrescrever a produção.
Execute APÓS `expo prebuild --platform android --clean`, ANTES de `assembleRelease`.
"""
import argparse
import pathlib
import re
import sys

SUFFIX = '.pilot'
NAME_SUFFIX = '-media3-s05'

def apply(text: str) -> str:
    if text.count('applicationIdSuffix ".pilot"') == 1 and text.count('versionNameSuffix "-media3-s05"') == 1:
        return text
    if 'applicationIdSuffix ".pilot"' in text or 'versionNameSuffix "-media3-s05"' in text:
        raise ValueError('Configuração piloto parcialmente aplicada; não sobrescrever automaticamente')
    # Âncora do buildType release: Expo prebuild gera o android/app/build.gradle.
    match = list(re.finditer(r'(?m)^([ \t]*)release[ \t]*\{[ \t]*$', text))
    if len(match) != 1:
        raise ValueError(f'Esperava um único bloco release, encontrei {len(match)}')
    m = match[0]
    addition = (f'{m.group(1)}    applicationIdSuffix "{SUFFIX}"\n'
                f'{m.group(1)}    versionNameSuffix "{NAME_SUFFIX}"\n')
    return text[:m.end()] + '\n' + addition + text[m.end():]

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('gradle_file', type=pathlib.Path)
    a = p.parse_args()
    if not a.gradle_file.is_file():
        sys.exit('Erro: arquivo Gradle não encontrado')
    original = a.gradle_file.read_text()
    try:
        patched = apply(original)
    except ValueError as e:
        sys.exit(f'Erro: {e}')
    if patched != original:
        a.gradle_file.write_text(patched)
        print('APK piloto terá package art.josperd.modotreino.pilot e versão -media3-s05')
    else:
        print('APK piloto já configurado')
