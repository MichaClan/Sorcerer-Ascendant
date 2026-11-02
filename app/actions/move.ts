'use server'

import { verifySession } from '@/app/lib/dal'
import { prisma } from '@/src/lib/prisma'
import { pusher } from '@/src/lib/go-pusher-server'
import { characters } from '@/app/lib/characters'

type MoveEffect = 'stun' | 'shield' | 'buff' | 'glitch' | 'distracted' | 'ai-assist' | null

type MoveDefinition = {
  damage: number
  accuracy: number      // 0-100
  effect: MoveEffect
  effectChance?: number // 0-100, only relevant when effect is set
}

const MOVE_COOLDOWNS: Record<string, number> = {
  'manji-kick':     0,
  'divergent-fist': 1,
  'black-flash':    1,
  'toad':           2,
  'divine-dogs':    1,
  'rabbit-escape':  3,
  'nue':            0,
  'debug':          1,
  'ai-assist':      3,
  'glitch':         0,
}

const MOVES: Record<string, MoveDefinition> = {
  // Yuji 
  'divergent-fist':  { damage: 22, accuracy: 75, effect: null },
  'black-flash':     { damage: 30, accuracy: 50, effect: null },
  'manji-kick':      { damage: 13, accuracy: 95, effect: null },
  // Megumi 
  'divine-dogs':     { damage: 20, accuracy: 85, effect: null },
  'nue':             { damage: 16, accuracy: 75, effect: 'stun', effectChance: 30 },
  'toad':            { damage: 0,  accuracy: 100, effect: 'shield', effectChance: 100 },
  'rabbit-escape':   { damage: 8,  accuracy: 80, effect: 'distracted', effectChance: 90 },
  // Wilson 
  'debug':           { damage: 22, accuracy: 85, effect: null },
  'ai-assist':       { damage: 0,  accuracy: 100, effect: 'ai-assist', effectChance: 100 },
  'glitch':          { damage: 12, accuracy: 80, effect: 'glitch', effectChance: 35 },
}

const STUNNED_ACCURACY_MOD    = 0.5  // stunned lasts 1 turn 
const GLITCHED_ACCURACY_MOD   = 0.7  // glitched lasts 2 turns 
const DISTRACTED_ACCURACY_MOD = 0.75  // distracted lasts 2 turns 
const BUFF_DAMAGE_BONUS = 10         // bonus damage while ai-assisted

export async function makeMove(gameId: string, move: string) {
  const session = await verifySession()

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { player: true },
  })
  if (!user?.player) throw new Error('Geen speler gevonden')

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  })
  if (!game) throw new Error('Game niet gevonden')
  if (game.phase !== 'battle') throw new Error('Game is niet bezig')
  if (game.turn !== user.player.id) throw new Error('Niet jouw beurt')

  const me = game.players.find((p) => p.playerId === user.player!.id)
  const opponent = game.players.find((p) => p.playerId !== user.player!.id)
  if (!me || !opponent) throw new Error('Spelers niet gevonden')
  if (!me.character || !opponent.character) {
    throw new Error('Personage niet geselecteerd')
  }

  const myCharacter = characters.find((c) => c.id === me.character)
  if (!myCharacter) throw new Error('Onbekend personage')

  if (!myCharacter.moves.includes(move)) {
    throw new Error('Move niet beschikbaar voor dit personage')
  }

  const moveDef = MOVES[move]
  if (!moveDef) throw new Error('Ongeldige move')

  // parse and validate cooldowns
  const myCooldowns: Record<string, number> = JSON.parse(me.cooldowns ?? '{}')
  if ((myCooldowns[move] ?? 0) > 0) {
    throw new Error(`Move ${move} is on cooldown for ${myCooldowns[move]} more turn(s)`)
  }

// self-targeting moves (toad, ai-assist) always land - skip accuracy penalty
const isSelfTargeting = moveDef.effect === 'shield' || moveDef.effect === 'ai-assist'

// each status reduces the attacker's accuracy by a configurable multiplier
const attackerAccuracyMod =
  isSelfTargeting                          ? 1 :
  me.status === 'stunned'                  ? STUNNED_ACCURACY_MOD :
  me.status?.startsWith('glitched')        ? GLITCHED_ACCURACY_MOD :
  me.status?.startsWith('distracted')      ? DISTRACTED_ACCURACY_MOD : 1
const effectiveAccuracy = moveDef.accuracy * attackerAccuracyMod

// ai-assisted attackers guarantee a hit on glitch and debug
const isAiAssisted = me.status === 'ai-assisted' && (move === 'glitch' || move === 'debug')

// ai-assisted attackers always hit regardless of accuracy or status
const hit = isAiAssisted ? true : Math.random() * 100 < effectiveAccuracy

const missed = !hit

let damage = hit ? moveDef.damage : 0

// ai-assisted attackers deal bonus damage on glitch/debug
if (isAiAssisted) damage += BUFF_DAMAGE_BONUS

const myNewHp = me.hp
let myNewStatus: string | null = me.status
let newOpponentHp = opponent.hp
let newOpponentStatus: string | null = opponent.status
let effectTriggered: MoveEffect = null

// if opponent is shielded, reduce incoming damage by 50% and clear shield
if (hit && opponent.status === 'shielded' && damage > 0) {
  damage = Math.round(damage * 0.5)
  newOpponentStatus = null
}

// ai-assisted Wilson takes only 70% damage
if (hit && opponent.status === 'ai-assisted' && damage > 0) {
  damage = Math.round(damage * 0.7)
}

  if (hit) {
    if (moveDef.effect === 'shield') {
      myNewStatus = 'shielded'
    } else if (moveDef.effect === 'ai-assist') {
      myNewStatus = 'ai-assisted'
    } else {
      newOpponentHp = Math.max(0, opponent.hp - damage)
      if (moveDef.effect && moveDef.effectChance) {
        // ai-assisted guarantees the glitch effect triggers
        const triggered = isAiAssisted ? true : Math.random() * 100 < moveDef.effectChance
        if (triggered) {
          effectTriggered = moveDef.effect
          // ai-assisted and shielded opponents are immune to all negative statuses
          const opponentIsImmune = opponent.status === 'ai-assisted' || opponent.status === 'shielded'
          if (moveDef.effect === 'buff') {
            myNewStatus = 'buffed'
          } else if (!opponentIsImmune) {
            if (moveDef.effect === 'distracted') {
              newOpponentStatus = 'distracted:2'
            } else {
              newOpponentStatus = moveDef.effect === 'stun' ? 'stunned' : 'glitched:2'
            }
          }
        }
      }
    }
  }

  // consume / tick down attacker statuses that were active this turn
  if (me.status === 'stunned') {
    if (!isSelfTargeting) myNewStatus = null
  }

  // ai-assisted only clears when glitch or debug is actually used
  if (me.status === 'ai-assisted' && (move === 'glitch' || move === 'debug')) myNewStatus = null

  if (me.status?.startsWith('glitched')) {
    if (isSelfTargeting) {
      // self-targeting move while glitched: fully clears the glitch (no buff given, but you're free)
      myNewStatus = null
    } else {
      const turnsLeft = parseInt(me.status.split(':')[1]) - 1
      myNewStatus = turnsLeft > 0 ? `glitched:${turnsLeft}` : null
    }
  }

  // tick down distracted on the attacker
  if (me.status?.startsWith('distracted') && !isSelfTargeting) {
    const turnsLeft = parseInt(me.status.split(':')[1]) - 1
    myNewStatus = turnsLeft > 0 ? `distracted:${turnsLeft}` : null
  }

  // update cooldowns: set used move's CD, tick down all others
  const cdValue = MOVE_COOLDOWNS[move] ?? 0
  const updatedCooldowns: Record<string, number> = {}
  for (const [m, turns] of Object.entries(myCooldowns)) {
    if (m === move) continue // will be re-set below
    const ticked = turns - 1
    if (ticked > 0) updatedCooldowns[m] = ticked
  }
  if (cdValue > 0) updatedCooldowns[move] = cdValue

  // DB Changes . apply hp and status changes
  await Promise.all([
    prisma.gamePlayer.update({ where: { id: opponent.id }, data: { hp: newOpponentHp, status: newOpponentStatus } }),
    prisma.gamePlayer.update({ where: { id: me.id }, data: { hp: myNewHp, status: myNewStatus, cooldowns: JSON.stringify(updatedCooldowns) } }),
  ])

  const gameOver = newOpponentHp <= 0

  if (gameOver) {
    await prisma.game.update({
      where: { id: gameId },
      data: { phase: 'ended', winner: me.playerId, turn: null },
    })
    await Promise.all([
      prisma.player.update({ where: { id: me.playerId }, data: { wins: { increment: 1 } } }),
      prisma.player.update({ where: { id: opponent.playerId }, data: { losses: { increment: 1 } } }),
    ])
    await pusher.publish(`game-${gameId}`, 'game-ended', { winner: me.playerId, move, damage, myCooldowns: updatedCooldowns })
    return
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { turn: opponent.playerId },
  })
// Pushing P
  await pusher.publish(`game-${gameId}`, 'move-made', {
    move,
    missed,
    glitchCorrupted: isSelfTargeting && me.status?.startsWith('glitched'),
    damage,
    effect: effectTriggered,
    myHp: myNewHp,
    myStatus: myNewStatus,
    myCooldowns: updatedCooldowns,
    opponentHp: newOpponentHp,
    opponentStatus: newOpponentStatus,
    nextTurn: opponent.playerId,
  })
}