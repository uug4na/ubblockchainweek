import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'

export type GameSfxKey = 'itemPickup' | 'birdDamaged' | 'gameOver' | 'pipeScore'

type GameAudioOptions = {
  scene: Phaser.Scene
}

type SoundWithVolume = Phaser.Sound.BaseSound & {
  setVolume: (volume: number) => Phaser.Sound.BaseSound
}

const AUDIO = {
  MusicVolume: 0.45,
  LowVolume: 0.05,
  Sfx: {
    itemPickup: { key: AssetKeys.Audio.ItemPickup, volume: 0.75 },
    birdDamaged: { key: AssetKeys.Audio.BirdDamaged, volume: 0.85 },
    gameOver: { key: AssetKeys.Audio.GameOver, volume: 0.9 },
    pipeScore: { key: AssetKeys.Audio.PipeScore, volume: 0.65 },
  },
} satisfies {
  MusicVolume: number
  LowVolume: number
  Sfx: Record<GameSfxKey, { key: string; volume: number }>
}

export class GameAudio {
  static readonly Music = {
    LowVolume: AUDIO.LowVolume,
  }

  private readonly scene: Phaser.Scene
  private music!: SoundWithVolume
  private readonly sfx = {} as Record<GameSfxKey, Phaser.Sound.BaseSound>

  constructor({ scene }: GameAudioOptions) {
    this.scene = scene
  }

  create() {
    this.music = this.scene.sound.add(AssetKeys.Audio.IngameMusic, {
      loop: true,
      volume: AUDIO.MusicVolume,
    }) as SoundWithVolume

    const sfxKeys = Object.keys(AUDIO.Sfx) as GameSfxKey[]

    sfxKeys.forEach((key) => {
      const config = AUDIO.Sfx[key]

      this.sfx[key] = this.scene.sound.add(config.key, {
        volume: config.volume,
      })
    })
  }

  playMusic() {
    if (this.music.isPlaying) {
      this.music.stop()
    }

    this.music.play()
  }

  setMusicVolume(volume: number) {
    this.music.setVolume(volume)
  }

  playSfx(key: GameSfxKey) {
    this.sfx[key].play()
  }

  destroy() {
    this.music?.stop()
    this.music?.destroy()

    const sfxKeys = Object.keys(this.sfx) as GameSfxKey[]

    sfxKeys.forEach((key) => {
      this.sfx[key].destroy()
    })
  }
}