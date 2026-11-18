import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'
import { SeededPipeGenerator } from '../core/SeededPipeGenerator'
import { CollectibleItem, type CollectibleType } from '../prefabs/CollectibleItem'
import { PipePair } from '../prefabs/PipePair'

type WorldSystemOptions = {
  scene: Phaser.Scene
  seed: string
  isRunning: () => boolean
  getPlayerX: () => number
  canScorePlayer: () => boolean
  getCollectibleType: () => CollectibleType
  onPlayerHitPipe: () => void
  onCollectible: (type: CollectibleType) => void
  onPlayerPassedPipe: () => void
}

export class WorldSystem {
  private readonly scene: Phaser.Scene
  private readonly options: WorldSystemOptions
  private readonly pipeGenerator: SeededPipeGenerator

  private pipes!: Phaser.Physics.Arcade.Group
  private items!: Phaser.Physics.Arcade.Group

  private nextPipeIndexToSpawn = 0
  private shouldSpawnItemOnNextPipe = false

  constructor(options: WorldSystemOptions) {
    this.scene = options.scene
    this.options = options

    this.pipeGenerator = new SeededPipeGenerator({
      seed: options.seed,
      sceneHeight: options.scene.scale.height,
    })
  }

  create(
    playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {
    this.pipes = this.scene.physics.add.group()
    this.items = this.scene.physics.add.group()

    this.bindCollisions(playerSprite)
    this.spawnPipesAhead()
  }

  update() {
    this.spawnPipesAhead()
    this.updatePipes()
    this.cleanupGroup(this.items)
  }

  requestCollectibleOnNextPipe() {
    this.shouldSpawnItemOnNextPipe = true
  }

  stopObjects() {
    this.forEachArcadeSprite(this.pipes, (sprite) => sprite.setVelocityX(0))
    this.forEachArcadeSprite(this.items, (sprite) => sprite.setVelocityX(0))
  }

  destroy() {
    this.pipes?.destroy(true)
    this.items?.destroy(true)
  }

  private bindCollisions(
    playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {
    this.scene.physics.add.overlap(playerSprite, this.pipes, () => {
      this.options.onPlayerHitPipe()
    })

    this.scene.physics.add.overlap(playerSprite, this.items, (_player, item) => {
      if (!this.options.isRunning()) return

      const itemSprite = item as Phaser.Physics.Arcade.Sprite
      const type = itemSprite.getData('type') as CollectibleType

      itemSprite.destroy()
      this.options.onCollectible(type)
    })
  }

  private spawnPipesAhead() {
    if (!this.options.isRunning()) return

    const targetX =
      this.options.getPlayerX() + GameConfig.Pipe.SpawnAheadDistance

    while (this.getNextPipeSpawnX() < targetX) {
      this.spawnPipePair()
    }
  }

  private getNextPipeSpawnX(): number {
    return (
      GameConfig.Pipe.StartX +
      this.nextPipeIndexToSpawn * GameConfig.Pipe.Spacing
    )
  }

  private spawnPipePair() {
    const spawnData = this.pipeGenerator.getPipeSpawnData(
      this.nextPipeIndexToSpawn,
    )

    new PipePair({
      scene: this.scene,
      group: this.pipes,
      x: spawnData.spawnX,
      gapCenterY: spawnData.gapCenterY,
      gapSize: spawnData.gapSize,
      index: spawnData.index,
    })

    this.nextPipeIndexToSpawn += 1

    if (!this.shouldSpawnItemOnNextPipe) return
    new CollectibleItem({
      scene: this.scene,
      group: this.items,
      x: spawnData.spawnX,
      y: Math.round(spawnData.gapCenterY),
      type: this.options.getCollectibleType(),
    })

    this.shouldSpawnItemOnNextPipe = false
  }

  private updatePipes() {
    const backmostX = this.options.getPlayerX()
    const playerX = this.options.getPlayerX()

    this.forEachArcadeSprite(this.pipes, (pipe) => {
      if (pipe.x < backmostX - GameConfig.Pipe.CleanupBehindDistance) {
        pipe.destroy()
        return
      }

      if (!this.options.canScorePlayer()) return
      if (pipe.getData('scorePipe') !== true) return
      if (pipe.x >= playerX) return

      pipe.setData('scorePipe', false)
      this.options.onPlayerPassedPipe()
    })
  }

  private cleanupGroup(group: Phaser.Physics.Arcade.Group) {
    const backmostX = this.options.getPlayerX()

    this.forEachArcadeSprite(group, (sprite) => {
      if (sprite.x < backmostX - GameConfig.Pipe.CleanupBehindDistance) {
        sprite.destroy()
      }
    })
  }

  private forEachArcadeSprite(
    group: Phaser.Physics.Arcade.Group,
    callback: (sprite: Phaser.Physics.Arcade.Sprite) => void,
  ) {
    group.getChildren().forEach((child) => {
      callback(child as Phaser.Physics.Arcade.Sprite)
    })
  }
}
