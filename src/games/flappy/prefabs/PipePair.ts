import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'
import { GameConfig } from '../core/GameConfig'

type PipePairOptions = {
  scene: Phaser.Scene
  group: Phaser.Physics.Arcade.Group
  x: number
  gapCenterY: number
  gapSize: number
  index: number
}

type PipePartConfig = {
  y: number
  height: number
  frame: number
  isScorePipe: boolean
  depth: number
}

export class PipePair {
  public readonly sprites: Phaser.Physics.Arcade.Sprite[] = []
  private readonly options: PipePairOptions

  constructor(options: PipePairOptions) {
    this.options = options
    this.create()
  }

  private create() {
    const topPipeBottomY = Math.round(
      this.options.gapCenterY - this.options.gapSize / 2,
    )

    const bottomPipeTopY = Math.round(
      this.options.gapCenterY + this.options.gapSize / 2,
    )

    this.createTopPipe(topPipeBottomY)
    this.createBottomPipe(bottomPipeTopY)
  }

  private createTopPipe(pipeBottomY: number) {
    const capTopY = pipeBottomY - GameConfig.Pipe.CapHeight
    const bodyTopY = -GameConfig.Pipe.TopExtraHeight
    const bodyHeight = capTopY + GameConfig.Pipe.SegmentOverlap - bodyTopY

    this.createPipePart({
      y: bodyTopY,
      height: bodyHeight,
      frame: 1,
      isScorePipe: false,
      depth: GameConfig.Depth.PipeBody,
    })

    this.createPipePart({
      y: capTopY,
      height: GameConfig.Pipe.CapHeight,
      frame: 0,
      isScorePipe: false,
      depth: GameConfig.Depth.PipeCap,
    })
  }

  private createBottomPipe(pipeTopY: number) {
    const bodyTopY =
      pipeTopY + GameConfig.Pipe.CapHeight - GameConfig.Pipe.SegmentOverlap

    const bodyHeight =
      this.options.scene.scale.height - bodyTopY + GameConfig.Pipe.BottomExtraHeight

    this.createPipePart({
      y: pipeTopY,
      height: GameConfig.Pipe.CapHeight,
      frame: 2,
      isScorePipe: true,
      depth: GameConfig.Depth.PipeCap,
    })

    this.createPipePart({
      y: bodyTopY,
      height: bodyHeight,
      frame: 1,
      isScorePipe: false,
      depth: GameConfig.Depth.PipeBody,
    })
  }

  private createPipePart(config: PipePartConfig): Phaser.Physics.Arcade.Sprite {
    const pipe = this.options.group.create(
      this.options.x,
      config.y,
      AssetKeys.Sprite.Pipe,
      config.frame,
    ) as Phaser.Physics.Arcade.Sprite

    pipe.setOrigin(0.5, 0)
    pipe.setDisplaySize(GameConfig.Pipe.Width, config.height)
    pipe.refreshBody()

    const body = pipe.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    pipe.setImmovable(true)
    pipe.setVelocity(0, 0)
    pipe.setDepth(config.depth)
    pipe.setData('scorePipe', config.isScorePipe)
    pipe.setData('pipeIndex', this.options.index)
    this.sprites.push(pipe)

    return pipe
  }
}
