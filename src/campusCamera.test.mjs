import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { CAMERA, CAMPUS, cameraPosition } = await vite.ssrLoadModule('/src/campusCamera.ts')
after(() => vite.close())

test('camera follows in every direction and settles smoothly after movement', () => {
  const center = { x: 400, y: 300 }
  for (const player of [{ x: 500, y: 316 }, { x: 300, y: 316 }, { x: 400, y: 416 }, { x: 400, y: 216 }]) {
    const target = { x: player.x, y: player.y - 16 }
    const next = cameraPosition(center, player, 100)
    const distance = (p) => Math.hypot(p.x - target.x, p.y - target.y)
    assert.ok(distance(next) < distance(center))
    assert.ok(distance(next) > 0)
    let settled = next
    for (let i = 0; i < 100; i++) settled = cameraPosition(settled, player, 16)
    assert.ok(distance(settled) < 1)
  }
})

test('camera stays inside map at all corners and smoothing is frame-rate independent', () => {
  const center = { x: 400, y: 300 }
  for (const player of [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 600 }, { x: 800, y: 600 }]) {
    let p = center
    for (let i = 0; i < 200; i++) p = cameraPosition(p, player, 16)
    const halfW = CAMPUS.viewportWidth / (2 * CAMERA.zoom), halfH = CAMPUS.viewportHeight / (2 * CAMERA.zoom)
    assert.ok(p.x >= halfW - 0.001 && p.x <= CAMPUS.width - halfW + 0.001)
    assert.ok(p.y >= halfH - 0.001 && p.y <= CAMPUS.height - halfH + 0.001)
    const once = cameraPosition(center, player, 100)
    let split = center
    for (let i = 0; i < 10; i++) split = cameraPosition(split, player, 10)
    assert.ok(Math.hypot(once.x - split.x, once.y - split.y) < 1e-9)
  }
})

test('returning from a building restores its entrance position or uses its portal', async () => {
  const { returnPosition } = await vite.ssrLoadModule('/src/campusReturn.ts')
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  for (const slug of ['backend', 'frontend', 'analytics']) {
    const portal = worldLocations[slug].campusPortal
    const entry = { slug, position: { x: portal.x + 10, y: portal.y + 10 } }
    assert.deepEqual(returnPosition(slug, entry), entry.position)
    assert.deepEqual(returnPosition(slug, null), { x: portal.x, y: portal.y })
    assert.deepEqual(returnPosition(slug, { ...entry, slug: 'other' }), { x: portal.x, y: portal.y })
    const center = cameraPosition({ x: 400, y: 300 }, entry.position, Infinity)
    assert.ok(center.x >= CAMPUS.viewportWidth / (2 * CAMERA.zoom))
    assert.ok(center.y <= CAMPUS.height - CAMPUS.viewportHeight / (2 * CAMERA.zoom))
  }
  assert.equal(returnPosition('unknown', null), undefined)
})
