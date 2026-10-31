import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { moveToward } = await vite.ssrLoadModule('/src/clickMovement.ts')
after(() => vite.close())
test('click movement approaches the point at constant speed and stops without overshooting', () => {
  assert.deepEqual(moveToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 2), { x: 1.2, y: 1.6 })
  assert.deepEqual(moveToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 6), { x: 3, y: 4 })
  assert.deepEqual(moveToward({ x: 3, y: 4 }, { x: 3, y: 4 }, 1), { x: 3, y: 4 })
})
