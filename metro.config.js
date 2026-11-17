const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultGetTransformOptions = config.transformer.getTransformOptions;

config.transformer = {
  ...config.transformer,
  getTransformOptions: async (...args) => {
    const defaults = defaultGetTransformOptions ? await defaultGetTransformOptions(...args) : {};
    return {
      ...defaults,
      transform: {
        ...defaults?.transform,
        inlineRequires: true,
      },
    };
  },
};

module.exports = config;
