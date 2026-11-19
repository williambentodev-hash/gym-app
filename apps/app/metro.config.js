// Metro: configuração automática de monorepo do Expo (SDK 52+) + requisitos do expo-sqlite na web.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SQLite na web roda em WebAssembly: o .wasm precisa ser tratado como asset.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer (usado pelo SQLite WASM) exige isolamento cross-origin.
// Em produção, os mesmos cabeçalhos precisam ser servidos pelo Worker (ver ADR-0007 / spike S1).
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
