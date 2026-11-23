import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'

export type CollectibleType = 'heart' | 'star'

type CollectibleItemOptions = {
  scene: Phaser.Scene
  group: Phaser.Physics.Arcade.Group
  x: number
  y: number
  type: CollectibleType
}

const COLLECTIBLE_CONFIG: Record<
  CollectibleType,
  {
    texture: string
    animKey: string
    frameStart: number
    frameEnd: number
    frameRate: number
  }
> = {
  heart: {
    texture: AssetKeys.Sprite.Heart,
    animKey: 'heart-idle',
    frameStart: 0,
    frameEnd: 1,
    frameRate: 4,
  },
  star: {
    texture: AssetKeys.Sprite.Star,
    animKey: 'star-idle',
    frameStart: 0,
    frameEnd: 2,
    frameRate: 8,
  },
}

export class CollectibleItem {
  public readonly sprite: Phaser.Physics.Arcade.Sprite
  public readonly body: Phaser.Physics.Arcade.Body

  constructor({ scene, group, x, y, type }: CollectibleItemOptions) {
    const config = COLLECTIBLE_CONFIG[type]

    if (!scene.anims.exists(config.animKey)) {
      scene.anims.create({
        key: config.animKey,
        frames: scene.anims.generateFrameNumbers(config.texture, {
          start: config.frameStart,
          end: config.frameEnd,
        }),
        frameRate: config.frameRate,
        repeat: -1,
      })
    }

    this.sprite = group.create(
      Math.round(x),
      Math.round(y),
      config.texture,
      0,
    ) as Phaser.Physics.Arcade.Sprite

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body

    this.sprite
      .setOrigin(0.5, 0.5)
      .setDisplaySize(128, 80)
      .setDepth(3)
      .setData('type', type)

    this.sprite.refreshBody()
    this.body.setAllowGravity(false)
    this.sprite.setVelocity(0, 0)
    this.sprite.play(config.animKey)
  }
}
