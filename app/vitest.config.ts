import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [{
    name: 'simulate-metro-native-resolution',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './feedback' && importer?.endsWith('/feedback.native.ts')) {
        throw new Error(`native feedback dependency resolved from ${importer}`)
      }
      return null
    },
  }],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
