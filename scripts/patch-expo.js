const fs = require('fs');

const filesToPatch = [
  'node_modules/expo/bin/cli',
  'node_modules/expo/node_modules/@expo/cli/bin/cli.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/index.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/ExpoMiddleware.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/metro/dev-server/createMessageSocket.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/resolvePlatform.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/RuntimeRedirectMiddleware.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/ServeStaticMiddleware.js'
];

const polyfillCode = "if (typeof URL !== 'undefined' && !URL.parse) {\n  URL.parse = function(url, base) {\n    try {\n      return new URL(url, base);\n    } catch {\n      return null;\n    }\n  };\n}\n";

filesToPatch.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('URL.parse = function')) {
      content = polyfillCode + content;
      fs.writeFileSync(file, content, 'utf8');
      console.log('Patched:', file);
    } else {
      console.log('Already patched:', file);
    }
  } else {
    console.log('File not found:', file);
  }
});

// Polyfill react-native/asset-registry
const assetRegistryCode = `'use strict';

const assets = (globalThis.__reactNativeAssets = globalThis.__reactNativeAssets || []);

function registerAsset(asset) {
  return assets.push(asset);
}

function getAssetByID(assetId) {
  return assets[assetId - 1];
}

const AssetRegistry = {
  registerAsset,
  getAssetByID,
};

module.exports = {
  AssetRegistry,
  registerAsset,
  getAssetByID,
  default: AssetRegistry,
};
module.exports.AssetRegistry = AssetRegistry;
`;

const assetPaths = [
  'node_modules/react-native/asset-registry.js',
  'node_modules/react-native/src/asset-registry.js',
  'node_modules/react-native/src/private/assets/AssetRegistry.js',
  'node_modules/react-native/Libraries/Image/AssetRegistry.js'
];

assetPaths.forEach(p => {
  fs.writeFileSync(p, assetRegistryCode, 'utf8');
  console.log('Verified', p);
});

// Polyfill query-string
const qsDir = 'node_modules/query-string';
if (!fs.existsSync(qsDir)) {
  fs.mkdirSync(qsDir, { recursive: true });
  fs.writeFileSync(qsDir + '/package.json', JSON.stringify({ name: 'query-string', version: '7.1.3', main: 'index.js' }, null, 2), 'utf8');
  fs.writeFileSync(qsDir + '/index.js', fs.readFileSync(__dirname + '/../node_modules/query-string/index.js', 'utf8'), 'utf8');
  console.log('Created query-string module');
}


