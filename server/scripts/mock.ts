import { buildApp } from '../src/app.js'
import {
  MOCK_MODES,
  createMockDeps,
  isMockMode,
} from './mock-fixtures.js'

const pick = process.env.MOCK ?? 'error'
if (!isMockMode(pick)) throw new Error(`unknown MOCK fixture "${pick}" (valid: ${MOCK_MODES.join(', ')})`)

const app = buildApp({
  ...createMockDeps(pick),
  logger: true,
})
app.listen({ port: 3000, host: '0.0.0.0' }).then(() => {
  console.log(`mock server on :3000 serving fixture "${pick}"`)
})
