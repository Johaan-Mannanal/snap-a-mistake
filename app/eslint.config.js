const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*'] },
  // React Native forwards object refs to native controls during render. These
  // components do not read `.current` while rendering; the compiler rule
  // cannot distinguish that supported ref-forwarding shape yet.
  {
    files: ['app/**/*.tsx', 'src/components/AppScreen.tsx'],
    rules: { 'react-hooks/refs': 'off' },
  },
  // Reanimated shared values are intentionally mutated from gesture worklets.
  {
    files: ['src/components/ZoomablePhoto.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
