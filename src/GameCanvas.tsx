import { playerAppearance } from './playerAppearance'
import { moveToward, type Point } from './clickMovement'
import { useEffect, useRef } from 'react'
import { locationFor } from './world'
import { cameraPosition } from './campusCamera'

interface GameCanvasProps { directionSlug: string, onInteract: () => void, onExit: () => void, onPositionChange?: (position: { x: number, y: number }) => void, initialPosition?: { x: number, y: number }, onActionChange?: (label: string | null) => void, blocked?: boolean, onReady?: () => void, onActionReady?: (action: () => void) => void, onObject?: (object: 'server' | 'terminal') => void, stationSolved?: boolean }

export function GameCanvas({ directionSlug, onInteract, onExit, onPositionChange = () => {}, initialPosition, onActionChange = () => {}, blocked = false, onReady = () => {}, onActionReady, onObject, stationSolved = false }: GameCanvasProps) {
  const solvedRef = useRef(stationSolved)
  useEffect(() => { solvedRef.current = stationSolved }, [stationSolved])
  const objectRef = useRef(onObject)
  useEffect(() => { objectRef.current = onObject }, [onObject])
  const host = useRef<HTMLDivElement>(null)
  const onInteractRef = useRef(onInteract)
  const onExitRef = useRef(onExit)
  const actionRef = useRef(onActionChange)
  const blockedRef = useRef(blocked)
  const readyRef = useRef(onReady)
  const actionReadyRef = useRef(onActionReady)
  const positionRef = useRef(onPositionChange)
  const spawnRef = useRef(initialPosition)
  const lastSavedAt = useRef(0)
  spawnRef.current = initialPosition

  useEffect(() => { onInteractRef.current = onInteract }, [onInteract])
  useEffect(() => { onExitRef.current = onExit }, [onExit])
  useEffect(() => { actionRef.current = onActionChange }, [onActionChange])
  useEffect(() => { blockedRef.current = blocked }, [blocked])
  useEffect(() => { readyRef.current = onReady }, [onReady])
  useEffect(() => { actionReadyRef.current = onActionReady }, [onActionReady])
  useEffect(() => { positionRef.current = onPositionChange }, [onPositionChange])

  useEffect(() => {
    if (typeof Element === 'undefined') return
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false

    const location = locationFor(directionSlug)
    const station = location?.workstation
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return

      const renderScale = 3
      const interiorZoom = 1.85 / 1.5
      const world = { width: 800, height: 800 * 941 / 1672 }

      class SliceScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image
        private npc!: Phaser.GameObjects.Image
        private stationGlow?: Phaser.GameObjects.Rectangle
        private serverGlow?: Phaser.GameObjects.Rectangle
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private action: 'npc' | 'exit' | 'server' | 'terminal' | undefined
        private facing = 'front'
        private target?: Point
        private cameraCenter = cameraPosition({ x: 400, y: 250 }, { x: 400, y: 390 }, Infinity, world, interiorZoom)

        constructor() { super('slice') }

        preload() {
          if (location) { this.load.image('interior', location.interior); this.load.image('npc', location.npcBase) }
          for (const [face, image] of Object.entries(playerAppearance)) this.load.image(`player-${face}`, image)
        }

        create() {
          if (!location) return
          this.add.image(0, 0, 'interior').setOrigin(0).setDisplaySize(world.width, world.height)
          this.cameras.main.setZoom(interiorZoom * renderScale).setBounds(0, 0, world.width, world.height).centerOn(this.cameraCenter.x, this.cameraCenter.y)
          const spawn = spawnRef.current ?? { x: 400, y: 390 }
          this.player = this.add.image(spawn.x, spawn.y, 'player-front').setOrigin(.5, 1)
          this.npc = this.add.image(location.npc.x, location.npc.y, 'npc').setOrigin(.5, 1)
          this.player.setScale(location.scale.max * .6).setDepth(this.player.y)
          this.npc.setScale(location.scale.max * .6).setDepth(this.npc.y)
          if (station) this.stationGlow = this.add.rectangle(station.x, station.y - 12, 38, 26, 0x75d9ef, .07).setStrokeStyle(1, 0x75d9ef, .45)
          if (directionSlug === 'backend') this.serverGlow = this.add.rectangle(620, 92, 72, 100, 0x75d9ef, .04).setStrokeStyle(1, 0x75d9ef, .35)
          this.cursors = this.input.keyboard?.createCursorKeys()
          const interact = () => { if (blockedRef.current) return; if (this.action) this.target = undefined; if (this.action === 'npc') onInteractRef.current(); if (this.action === 'exit') onExitRef.current(); if (this.action === 'server' || this.action === 'terminal') objectRef.current?.(this.action) }
          actionReadyRef.current?.(interact)
          this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!blockedRef.current) { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); this.target = { x: Phaser.Math.Clamp(point.x, 0, world.width), y: Phaser.Math.Clamp(point.y, 0, world.height) } } })
          readyRef.current()
          positionRef.current({ x: spawn.x, y: spawn.y })
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
          if (Date.now() - lastSavedAt.current > 2000) { lastSavedAt.current = Date.now(); positionRef.current({ x: this.player.x, y: this.player.y }) }
          this.npc.setDepth(this.npc.y)
          const nearNpc = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 50
          const nearExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, location.exit.x, location.exit.y) < 35
          const nearServer = directionSlug === 'backend' && Phaser.Math.Distance.Between(this.player.x, this.player.y, 620, 135) < 65
          const nearTerminal = !!station && Phaser.Math.Distance.Between(this.player.x, this.player.y, station.x, station.y) < 45
          this.stationGlow?.setStrokeStyle(nearTerminal ? 2 : 1, solvedRef.current ? 0x79dfad : 0x75d9ef, nearTerminal ? .9 : .35)
          this.serverGlow?.setStrokeStyle(nearServer ? 2 : 1, solvedRef.current ? 0x79dfad : 0x75d9ef, nearServer ? .9 : .35)
          this.action = nearNpc ? 'npc' : nearServer ? 'server' : nearTerminal ? 'terminal' : nearExit ? 'exit' : undefined
          this.cameraCenter = cameraPosition(this.cameraCenter, this.player, delta, world, interiorZoom)
          this.cameras.main.centerOn(this.cameraCenter.x, this.cameraCenter.y)
          actionRef.current(nearServer ? 'Осмотреть сервер' : nearTerminal ? 'Открыть рабочую станцию' : nearNpc ? (location.slug === 'narrator' ? 'Поговорить с Дядей Дебагом' : `Поговорить с мастером ${location.label}`) : nearExit ? 'Выйти в главный хаб' : null)
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
