const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const packages = path.resolve(__dirname, '../../packages');

// The Tala package lives outside this folder: watch it and name it like a dependency.
config.watchFolders = [...(config.watchFolders ?? []), packages];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { '@sailix/tala': path.join(packages, 'tala/src/index.ts') };

module.exports = config;
