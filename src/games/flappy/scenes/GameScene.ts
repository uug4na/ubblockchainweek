import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'
import { GameConfig } from '../core/GameConfig'
import { EndlessGameplay } from '../gameplay/EndlessGameplay'
import { ASSETS } from '../core/Paths'
import { SPARKY } from '../types'

export class GameScene extends Phaser.Scene {
  private gameplay: EndlessGameplay | null = null
  private loadFailed = false

  constructor() {
    super('GameScene')
  }

  init() {
    this.gameplay = null
    this.loadFailed = false
  }

  preload() {
    this.game.events.emit('game-loading')
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)

    this.load.image(AssetKeys.Background.Day1, ASSETS + '/background.png')
    this.load.image(AssetKeys.Background.Day2, ASSETS + '/background2.png')
    this.load.image(AssetKeys.Background.Day3, ASSETS + '/background3.png')
    this.load.image(AssetKeys.GameOverBird, GameConfig.GameOver.BirdAsset)
    this.load.image(AssetKeys.GameOverBackground, GameConfig.GameOver.BackgroundAsset)
    this.load.image(AssetKeys.GameOverButton, GameConfig.GameOver.ButtonAsset)

    this.load.font(AssetKeys.Font.Chewy, ASSETS + '/fonts/Chewy-Regular.ttf')
    this.load.font(AssetKeys.Font.Shantel, ASSETS + '/fonts/ShantellSans.ttf')

    this.load.audio(AssetKeys.Audio.IngameMusic, ASSETS + '/Musics/InGame.mp3')
    this.load.audio(AssetKeys.Audio.ItemPickup, ASSETS + '/SFX/ItemPickup.mp3')
    this.load.audio(AssetKeys.Audio.BirdDamaged, ASSETS + '/SFX/Hurt.mp3')
    this.load.audio(AssetKeys.Audio.GameOver, ASSETS + '/SFX/GameOver.mp3')
    this.load.audio(AssetKeys.Audio.PipeScore, ASSETS + '/SFX/PipePassed.mp3')

    this.load.spritesheet(AssetKeys.Sprite.Pipe, ASSETS + '/PipeSpritesheet.png', {
      frameWidth: 177,
      frameHeight: 181,
    })
    this.load.spritesheet(SPARKY.texture, SPARKY.asset, {
      frameWidth: 224,
      frameHeight: 176,
    })
    this.load.spritesheet(AssetKeys.Sprite.Health, ASSETS + '/Health.png', {
      frameWidth: 80,
      frameHeight: 80,
    })
    this.load.spritesheet(AssetKeys.Sprite.Heart, ASSETS + '/Heart.png', {
      frameWidth: 128,
      frameHeight: 80,
    })
    this.load.spritesheet(AssetKeys.Sprite.Star, ASSETS + '/Star.png', {
      frameWidth: 160,
      frameHeight: 96,
    })
  }

  create() {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError, this)
    if (this.loadFailed) return

    try {
      this.gameplay = new EndlessGameplay({
        scene: this,
        seed: String(Math.floor(100000000 + Math.random() * 900000000)),
      })
      this.gameplay.create()
      this.game.events.emit('game-ready')
    } catch (error) {
      console.error('Failed to start game:', error)
      this.gameplay?.destroy()
      this.gameplay = null
      this.game.events.emit('game-error', 'Unable to start the game. Please reload.')
    }
  }

  update(time: number, delta: number) {
    this.gameplay?.update(time, delta)
  }

  private handleLoadError(file: Phaser.Loader.File) {
    if (
      file.key === AssetKeys.GameOverBird ||
      file.key === AssetKeys.GameOverBackground ||
      file.key === AssetKeys.GameOverButton ||
      file.type === 'font'
    ) return
    this.loadFailed = true
    this.game.events.emit('game-error', 'Some game assets could not load. Please reload.')
  }

  private shutdown() {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError, this)
    this.gameplay?.destroy()
    this.gameplay = null
  }
}
