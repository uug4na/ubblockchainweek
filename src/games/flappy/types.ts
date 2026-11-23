import { ASSETS } from './core/Paths'

export const SPARKY = {
  texture: 'bird-sparky',
  flyAnim: 'sparky-fly',
  asset: ASSETS + '/bird1.png',
} as const

// UBBW: one run, as the game reports it when the bird dies.
export type FlappyStats = {
  score: number
  hits: number
  hearts: number
  stars: number
  cause: 'pipe' | 'fall'
}
