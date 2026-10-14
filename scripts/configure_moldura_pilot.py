#!/usr/bin/env python3
"""APK de LABORATÓRIO "moldura": mesmo app, mas com outro applicationId (.moldura) e targetSdk 30.

Por quê: a partir do Android 12 o sistema põe a moldura padrão (cabeçalho + seta) em notificações personalizadas de apps que
declaram targetSdk 31 ou mais. Apps com targetSdk antigo (como alguns antivírus) continuam podendo ocupar a notificação inteira.
Este build serve só para testar, no aparelho do dono, se o cartão ilustrado sai sem moldura. Nunca vai para release.
Execute APÓS `expo prebuild --platform android --clean`, ANTES de `assembleRelease`.

  python3 scripts/configure_moldura_pilot.py native/android/app/build.gradle native/android/gradle.properties
"""
import argparse
import pathlib
import re
import sys

SUFFIX = '.moldura'
NAME_SUFFIX = '-moldura'
TARGET = '30'


def apply_gradle(text: str) -> str:
    if f'applicationIdSuffix "{SUFFIX}"' in text:
        return text
    match = list(re.finditer(r'(?m)^([ \t]*)release[ \t]*\{[ \t]*$', text))
    if len(match) != 1:
        raise ValueError(f'Esperava um único bloco release, encontrei {len(match)}')
    m = match[0]
    addition = (f'{m.group(1)}    applicationIdSuffix "{SUFFIX}"\n'
                f'{m.group(1)}    versionNameSuffix "{NAME_SUFFIX}"\n')
    text = text[:m.end()] + '\n' + addition + text[m.end():]
    # targetSdk 30 faz o lint "vital" do release reclamar (ExpiredTargetSdkVersion, regra da Play Store): este APK nunca vai à Play.
    android = list(re.finditer(r'(?m)^android[ \t]*\{[ \t]*$', text))
    if len(android) != 1:
        raise ValueError(f'Esperava um único bloco android, encontrei {len(android)}')
    a = android[0]
    return text[:a.end()] + '\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n' + text[a.end():]


def apply_properties(text: str) -> str:
    line = f'android.targetSdkVersion={TARGET}'
    if re.search(r'(?m)^android\.targetSdkVersion=', text):
        return re.sub(r'(?m)^android\.targetSdkVersion=.*$', line, text)
    return text.rstrip('\n') + '\n' + line + '\n'


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('gradle_file', type=pathlib.Path)
    p.add_argument('properties_file', type=pathlib.Path)
    a = p.parse_args()
    for f in (a.gradle_file, a.properties_file):
        if not f.is_file():
            sys.exit(f'Erro: arquivo não encontrado: {f}')
    try:
        a.gradle_file.write_text(apply_gradle(a.gradle_file.read_text()))
        a.properties_file.write_text(apply_properties(a.properties_file.read_text()))
    except ValueError as e:
        sys.exit(f'Erro: {e}')
    print(f'APK de laboratório: package ...{SUFFIX}, targetSdk {TARGET}')
