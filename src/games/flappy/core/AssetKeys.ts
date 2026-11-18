export const AssetKeys = {
  Background: {
    Day1: 'background',
    Day2: 'background2',
    Day3: 'background3',
  },
  GameOverBird: 'game-over-sparky',
  GameOverBackground: 'game-over-background',
  GameOverButton: 'game-over-button',
  Font: {
    Chewy: 'chewy',
    Shantel: 'shantel',
  },
  Audio: {
    IngameMusic: 'ingame-music',
    ItemPickup: 'item-pickup-sfx',
    BirdDamaged: 'bird-damaged-sfx',
    GameOver: 'game-over-sfx',
    PipeScore: 'pipe-score-sfx',
  },
  Sprite: {
    Health: 'health',
    Heart: 'heart',
    Star: 'star',
    Pipe: 'pipe',
  },
} as const

export type BackgroundAssetKey =
  (typeof AssetKeys.Background)[keyof typeof AssetKeys.Background]
