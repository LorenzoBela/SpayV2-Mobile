import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-native': path.resolve(__dirname, './src/tests/__mocks__/react-native.js'),
      'expo-application': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'expo-constants': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'expo-file-system/legacy': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'expo-intent-launcher': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'expo-updates': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'react-native-exit-app': path.resolve(__dirname, './src/tests/__mocks__/expo.js'),
      'react-native-shimmer-placeholder': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      'expo-linear-gradient': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      '@expo/vector-icons': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      'react-native-svg': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      'expo-blur': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      'react-native-gesture-handler': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
      'react-native-reanimated': path.resolve(__dirname, './src/tests/__mocks__/ui-libs.js'),
    },
  },
});
