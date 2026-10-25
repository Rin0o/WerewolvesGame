const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');

const isFirebaseModule = (moduleName) => moduleName.startsWith('firebase/') || moduleName.startsWith('@firebase/');

config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    isFirebaseModule(moduleName) ? { ...context, unstable_enablePackageExports: false } : context,
    moduleName,
    platform,
  );

module.exports = config;
