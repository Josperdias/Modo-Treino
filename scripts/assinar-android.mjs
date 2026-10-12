#!/usr/bin/env node
// Faz o build "release" do projeto Android gerado pelo Expo (expo prebuild) assinar com a chave própria,
// lida de variáveis de ambiente no momento do Gradle (nada de senha gravada em arquivo).
// Uso: node scripts/assinar-android.mjs native/android/app/build.gradle
// Sem MT_KEYSTORE_FILE no ambiente não altera nada (o build segue com a chave de teste do template).
import fs from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('uso: assinar-android.mjs <app/build.gradle>'); process.exit(2); }
if (!process.env.MT_KEYSTORE_FILE) { console.log('assinatura: sem chave própria, mantendo a chave de teste do template'); process.exit(0); }
let g = fs.readFileSync(file, 'utf8');
if (g.includes('MT_KEYSTORE_FILE')) { console.log('assinatura: build.gradle já preparado'); process.exit(0); }
const release = `
        release {
            storeFile file(System.getenv('MT_KEYSTORE_FILE'))
            storePassword System.getenv('MT_KEYSTORE_PASSWORD')
            keyAlias System.getenv('MT_KEY_ALIAS')
            keyPassword System.getenv('MT_KEY_PASSWORD')
        }`;
// 1) novo signingConfig "release" depois do "debug"
const sc = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
if (!sc.test(g)) { console.error('ERRO: bloco signingConfigs.debug não encontrado; o template do Expo mudou.'); process.exit(1); }
g = g.replace(sc, `$1${release}`);
// 2) buildTypes.release passa a usar a chave própria
const bt = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
if (!bt.test(g)) { console.error('ERRO: buildTypes.release sem signingConfig debug; o template do Expo mudou.'); process.exit(1); }
g = g.replace(bt, '$1signingConfig signingConfigs.release');
fs.writeFileSync(file, g);
console.log('assinatura: release configurado para a chave própria');
