const S = (n: number) => `/sprites/Sorcerer Ascendant-${n}.png.png`

export type MoveSprite = {
  frames: string[]
  flip?: 'with-idle' | 'always' | 'never'   // 'with-idle' = flip follows the character's natural facing
}

export type Character = {
  id: string
  name: string
  sprite: string
  shieldedSprite?: string
  buffedSprite?: string  
  facesRight: boolean
  moves: string[]
  moveSprites: Record<string, MoveSprite>
}

export const characters: Character[] = [
  {
    id: 'yuji',
    name: 'Yuji',
    sprite: S(3),
    facesRight: true,
    moves: ['divergent-fist', 'black-flash', 'manji-kick'],
    moveSprites: {
      'divergent-fist': { frames: [S(5), S(6), '/sprites/Yuji-Punch.png', '/sprites/Yuji-Punch-Divergent.png'] },
      'black-flash':    { frames: ['/sprites/Yuji-Punch.png', '/sprites/Black-Flash-Punch.png'] },
      'manji-kick':     { frames: ['/sprites/Manji-Kick.png'], flip: 'always' },
    },
  },
  {
    id: 'megumi',
    name: 'Megumi',
    sprite: S(1),
    shieldedSprite: S(2),
    facesRight: true,
    moves: ['divine-dogs', 'nue', 'toad', 'rabbit-escape'],
    moveSprites: {
      'divine-dogs':   { frames: ['/sprites/Megumi-cast.png'] },
      'nue':           { frames: ['/sprites/Megumi-cast.png'] },
      'toad':          { frames: [S(2)] },
      'rabbit-escape': { frames: ['/sprites/Megumi-cast.png'] },
    },
  },
  {
    id: 'wilson',
    name: 'Sensei Wilson',
    sprite: S(7),
    facesRight: false, // naturally faces left
    buffedSprite: S(13),
    moves: ['debug', 'ai-assist', 'glitch'],
    moveSprites: {
      'debug':     { frames: [S(9), S(10), S(11)] },
      'ai-assist': { frames: [S(12), S(13)] },
      'glitch':    { frames: [S(14)] },
    },
  },
]

