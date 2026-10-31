import { moveToward, type Point } from './clickMovement'
import { useEffect, useRef } from 'react'
import { locationFor } from './world'
import { cameraPosition } from './campusCamera'

interface GameCanvasProps { directionSlug: string, onInteract: () => void, onExit: () => void, onActionChange?: (label: string | null) => void, blocked?: boolean, onReady?: () => void, onActionReady?: (action: () => void) => void }

export function GameCanvas({ directionSlug, onInteract, onExit, onActionChange = () => {}, blocked = false, onReady = () => {}, onActionReady }: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const onInteractRef = useRef(onInteract)
  const onExitRef = useRef(onExit)
  const actionRef = useRef(onActionChange)
  const blockedRef = useRef(blocked)
  const readyRef = useRef(onReady)
  const actionReadyRef = useRef(onActionReady)

  useEffect(() => { onInteractRef.current = onInteract }, [onInteract])
  useEffect(() => { onExitRef.current = onExit }, [onExit])
  useEffect(() => { actionRef.current = onActionChange }, [onActionChange])
  useEffect(() => { blockedRef.current = blocked }, [blocked])
  useEffect(() => { readyRef.current = onReady }, [onReady])
  useEffect(() => { actionReadyRef.current = onActionReady }, [onActionReady])

  useEffect(() => {
    if (typeof Element === 'undefined') return
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false

    const location = locationFor(directionSlug)
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return

      const renderScale = 3
      const interiorZoom = 1.85 / 1.5
      const world = { width: 800, height: 800 * 941 / 1672 }

      class SliceScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image
        private npc!: Phaser.GameObjects.Image
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private action: 'npc' | 'exit' | undefined
        private facing = 'front'
        private target?: Point
        private cameraCenter = cameraPosition({ x: 400, y: 250 }, { x: 400, y: 390 }, Infinity, world, interiorZoom)

        constructor() { super('slice') }

        preload() {
          if (location) { this.load.image('interior', location.interior); this.load.image('npc', location.npcBase) }
          for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`)
        }

        create() {
          if (!location) return
          this.add.image(0, 0, 'interior').setOrigin(0).setDisplaySize(world.width, world.height)
          this.cameras.main.setZoom(interiorZoom * renderScale).setBounds(0, 0, world.width, world.height).centerOn(this.cameraCenter.x, this.cameraCenter.y)
          this.player = this.add.image(400, 390, 'player-front').setOrigin(.5, 1)
          this.npc = this.add.image(location.npc.x, location.npc.y, 'npc').setOrigin(.5, 1)
          this.player.setScale(location.scale.max * .6).setDepth(this.player.y)
          this.npc.setScale(location.scale.max * .6).setDepth(this.npc.y)
          this.cursors = this.input.keyboard?.createCursorKeys()
          const interact = () => { if (blockedRef.current) return; if (this.action) this.target = undefined; if (this.action === 'npc') onInteractRef.current(); if (this.action === 'exit') onExitRef.current() }
          actionReadyRef.current?.(interact)
          this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!blockedRef.current) { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); this.target = { x: Phaser.Math.Clamp(point.x, 0, world.width), y: Phaser.Math.Clamp(point.y, 0, world.height) } } })
          readyRef.current()
        }

        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (!keyboard || !this.cursors || !location) return
          if (blockedRef.current) { this.cameraCenter = cameraPosition(this.cameraCenter, this.player, delta, world, interiorZoom); this.cameras.main.centerOn(this.cameraCenter.x, this.cameraCenter.y); return }
          const speed = .19 * delta
          let facing = this.facing
          const previous = { x: this.player.x, y: this.player.y }
          if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { this.player.x -= speed; facing = 'left' }
          if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { this.player.x += speed; facing = 'right' }
          if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { this.player.y -= speed; facing = 'back' }
          if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { this.player.y += speed; facing = 'front' }
          if (this.player.x !== previous.x || this.player.y !== previous.y) this.target = undefined
          else if (this.target) { const point = moveToward(this.player, this.target, speed); const dx = point.x - this.player.x, dy = point.y - this.player.y; this.player.setPosition(point.x, point.y); if (dx || dy) facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'back' : 'front'); if (point.x === this.target.x && point.y === this.target.y) this.target = undefined }
          if (facing !== this.facing) { this.facing = facing; this.player.setTexture(`player-${facing}`) }
          this.player.setPosition(Phaser.Math.Clamp(this.player.x, 0, world.width), Phaser.Math.Clamp(this.player.y, 0, world.height))
          this.player.setDepth(this.player.y)
          this.npc.setDepth(this.npc.y)
          const nearNpc = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 50
          const nearExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, location.exit.x, location.exit.y) < 35
          this.action = nearNpc ? 'npc' : nearExit ? 'exit' : undefined
          this.cameraCenter = cameraPosition(this.cameraCenter, this.player, delta, world, interiorZoom)
          this.cameras.main.centerOn(this.cameraCenter.x, this.cameraCenter.y)
          actionRef.current(nearNpc ? (location.slug === 'narrator' ? 'Поговорить с Дядей Дебагом' : `Поговорить с мастером ${location.label}`) : nearExit ? 'Выйти в главный хаб' : null)
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800 * renderScale,
        height: 500 * renderScale,
        render: { antialias: true, pixelArt: false },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800 * renderScale, height: 500 * renderScale },
        backgroundColor: '#101829',
        scene: SliceScene,
      })
    })

    return () => { cancelled = true; game?.destroy(true) }
  }, [directionSlug])

  return <div className="game-canvas" ref={host} aria-label="Игровая сцена" />
}
