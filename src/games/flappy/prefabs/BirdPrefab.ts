import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'
import { SPARKY } from '../types'

type BirdOptions = {
  scene: Phaser.Scene
  x: number
  y: number
}

export class Bird {
  public readonly sprite: Phaser.Physics.Arcade.Sprite
  public readonly body: Phaser.Physics.Arcade.Body

  constructor({ scene, x, y }: BirdOptions) {
    if (!scene.anims.exists(SPARKY.flyAnim)) {
      scene.anims.create({
        key: SPARKY.flyAnim,
        frames: scene.anims.generateFrameNumbers(SPARKY.texture, {
          start: 0,
          end: 2,
        }),
        frameRate: 4,
        repeat: -1,
      })
    }

    this.sprite = scene.physics.add.sprite(x, y, SPARKY.texture, 1)
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body

    this.sprite
      .setDisplaySize(GameConfig.Bird.Width, GameConfig.Bird.Height)
      .setDepth(GameConfig.Depth.Bird)
      .setGravityY(GameConfig.Bird.GravityY)
      .setCollideWorldBounds(false)
      .play(SPARKY.flyAnim)

    this.body.setSize(GameConfig.Bird.Body.Width, GameConfig.Bird.Body.Height)
    this.body.setOffset(GameConfig.Bird.Body.OffsetX, GameConfig.Bird.Body.OffsetY)
  }

  setDeadFrame() {
    this.sprite.anims.stop()
    this.sprite.setTexture(SPARKY.texture, 3)
  }

  destroy() {
    this.sprite.destroy()
  }
}
