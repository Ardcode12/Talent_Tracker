// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Shim Node.js built-ins that expo-notifications dependencies require
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  assert: require.resolve('browser-assert'),
};

module.exports = config;
