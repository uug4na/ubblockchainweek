import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'
import type { BackgroundAssetKey } from '../core/AssetKeys'

type GameBackgroundOptions = {
  scene: Phaser.Scene
}

export class GameBackground {
  private readonly scene: Phaser.Scene

  private current!: Phaser.GameObjects.TileSprite
  private next: Phaser.GameObjects.TileSprite | null = null
  private currentKey: BackgroundAssetKey = GameConfig.Background.StartKey
  private isTransitioning = false

  constructor({ scene }: GameBackgroundOptions) {
    this.scene = scene
  }

  create() {
    this.currentKey = GameConfig.Background.StartKey
    this.isTransitioning = false
    this.next = null
    this.current = this.createBackgroundLayer(this.currentKey)
  }

  update(cameraScrollX: number) {
    const tileX = cameraScrollX * GameConfig.Background.ParallaxSpeed

    this.current.tilePositionX = tileX

    if (this.next !== null) {
      this.next.tilePositionX = tileX
    }
  }

  updateByScore(score: number) {
    const backgroundIndex =
      Math.floor(score / GameConfig.Background.ScoreChangeEvery) %
      GameConfig.Background.Order.length

    const nextKey = GameConfig.Background.Order[backgroundIndex]

    if (this.currentKey === nextKey || this.isTransitioning) return

    this.transitionTo(nextKey)
  }

  destroy() {
    this.current?.destroy()

    if (this.next !== null) {
      this.next.destroy()
      this.next = null
    }
  }

  private createBackgroundLayer(key: BackgroundAssetKey) {
    const width = this.scene.scale.width
    const height = this.scene.scale.height
    const texture = this.scene.textures.get(key)
    const source = texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(width / source.width, height / source.height)
    const tileWidth = width / scale
    const tileHeight = height / scale

    return this.scene.add
      .tileSprite(width / 2, height / 2, tileWidth, tileHeight, key)
      .setOrigin(0.5)
      .setScale(scale)
      .setDepth(GameConfig.Depth.Background)
      .setScrollFactor(0)
  }

  private transitionTo(nextKey: BackgroundAssetKey) {
    this.isTransitioning = true

    const nextBackground = this.createBackgroundLayer(nextKey)

    nextBackground
      .setDepth(GameConfig.Depth.BackgroundTransition)
      .setAlpha(0)

    nextBackground.tilePositionX = this.current.tilePositionX
    this.next = nextBackground

    this.scene.tweens.add({
      targets: nextBackground,
      alpha: 1,
      duration: GameConfig.Background.TransitionDuration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.current.destroy()
        this.current = nextBackground
        this.current.setDepth(GameConfig.Depth.Background)
        this.next = null
        this.currentKey = nextKey
        this.isTransitioning = false
      },
    })
  }
}