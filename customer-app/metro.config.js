const path = require('path');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig();
  return {
    ...defaultConfig,
    projectRoot: __dirname,
    watchFolders: [__dirname],
    serializer: {
      ...defaultConfig.serializer,
      getPolyfills: () => require('react-native/rn-get-polyfills')(),
      getModulesRunBeforeMainModule: () => [
        require.resolve('react-native/Libraries/Core/InitializeCore'),
      ],
    },
    transformer: {
      ...defaultConfig.transformer,
      assetRegistryPath: 'react-native/Libraries/Image/AssetRegistry',
      babelTransformerPath: require.resolve('@react-native/metro-babel-transformer'),
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
  };
})();
