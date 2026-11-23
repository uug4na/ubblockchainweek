import Phaser from 'phaser'

import { GameConfig } from './GameConfig'

export type SeededPipeSpawnData = {
  index: number
  spawnX: number
  gapCenterY: number
  gapSize: number
}

type SeededPipeGeneratorOptions = {
  seed: string
  sceneHeight: number
}

export class SeededPipeGenerator {
  private readonly seed: string
  private readonly sceneHeight: number

  constructor({ seed, sceneHeight }: SeededPipeGeneratorOptions) {
    this.seed = seed
    this.sceneHeight = sceneHeight
  }

  getPipeSpawnData(index: number): SeededPipeSpawnData {
    const rng = new Phaser.Math.RandomDataGenerator([
      `${this.seed}-pipe-${index}`,
    ])

    const gapSize = this.getGapSize(rng)

    return {
      index,
      spawnX: GameConfig.Pipe.StartX + index * GameConfig.Pipe.Spacing,
      gapCenterY: this.getSafeGapCenterY(rng, gapSize),
      gapSize,
    }
  }

  private getGapSize(rng: Phaser.Math.RandomDataGenerator): number {
    const targetGapSize = Phaser.Math.Clamp(
      Math.round(this.sceneHeight * 0.25),
      GameConfig.Pipe.MinGapSize,
      GameConfig.Pipe.MaxGapSize,
    )
    const minGapSize = Math.max(
      GameConfig.Pipe.MinGapSize,
      targetGapSize - GameConfig.Pipe.GapVariation,
    )
    const maxGapSize = Math.min(
      GameConfig.Pipe.MaxGapSize,
      targetGapSize + GameConfig.Pipe.GapVariation,
    )

    return rng.between(minGapSize, maxGapSize)
  }

  private getSafeGapCenterY(
    rng: Phaser.Math.RandomDataGenerator,
    gapSize: number,
  ): number {
    const halfGap = gapSize / 2

    const minCenterY = Math.max(
      GameConfig.Pipe.MinGapCenterY,
      halfGap + GameConfig.Pipe.CapHeight,
    )

    const maxCenterY = Math.min(
      GameConfig.Pipe.MaxGapCenterY,
      this.sceneHeight - halfGap - GameConfig.Pipe.CapHeight,
    )

    return rng.between(Math.round(minCenterY), Math.round(maxCenterY))
  }
}
