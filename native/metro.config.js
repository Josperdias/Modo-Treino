// Deixa o Metro empacotar o globo (HTML autocontido) como arquivo de dados do app.
const {getDefaultConfig} = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html');
module.exports = config;
