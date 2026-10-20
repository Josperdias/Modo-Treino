// Deixa o Metro empacotar o globo (HTML autocontido) e os áudios .ogg do Arcade como arquivos de dados do app.
const {getDefaultConfig} = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html', 'ogg');
module.exports = config;
