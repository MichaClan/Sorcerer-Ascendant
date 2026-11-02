'use server'

import { verifySession } from '@/app/lib/dal'
import { prisma } from '@/src/lib/prisma'
import { redirect } from 'next/navigation'
import { pusher } from '@/src/lib/go-pusher-server'
import { characters } from '@/app/lib/characters'

export async function createGame() {
  const session = await verifySession()
  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { player: true },
  })
  if (!user?.player) {
    throw new Error('Geen player gevonden')
  }
  const game = await prisma.game.create({
    data: {
      phase: 'lobby',
      players: {
        create: {
          playerId: user.player.id,
        },
      },
    },
  })
  redirect(`/game/${game.id}`)
}

export async function joinGame(gameId: string) {
  const session = await verifySession()
  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { player: true },
  })
  if (!user?.player) {
    throw new Error('Geen player gevonden')
  }
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  })
  if (!game) {
    throw new Error('Game niet gevonden')
  }
  if (game.players.length >= 2) {
    throw new Error('Game is al vol')
  }
  const alreadyJoined = game.players.some(
    (gp) => gp.playerId === user.player!.id
  )
  if (alreadyJoined) {
    redirect(`/game/${game.id}`)
  }
  await prisma.gamePlayer.create({
    data: {
      playerId: user.player.id,
      gameId: gameId,
    },
  })
  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: { phase: 'build' },
    include: { players: true },
  })
  await pusher.publish(`game-${gameId}`, 'phase-changed', {
    phase: updatedGame.phase,
    players: updatedGame.players,
  })
  redirect(`/game/${game.id}`)
}

export async function chooseCharacter(gameId: string, characterId: string) {
  const session = await verifySession()
  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { player: true },
  })
  if (!user?.player) throw new Error('Geen speler gevonden')

  const character = characters.find((c) => c.id === characterId)
  if (!character) throw new Error('Onbekend personage')

  const gamePlayer = await prisma.gamePlayer.findFirst({
    where: {
      gameId,
      playerId: user.player.id,
    },
  })
  if (!gamePlayer) throw new Error('Je doet niet mee aan deze game')

  // save selection
  await prisma.gamePlayer.update({
    where: { id: gamePlayer.id },
    data: {
      character: character.id,
      hp: 100,
      ready: true,
    },
  })

  // re fetch fresh state
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  })
  if (!game) throw new Error('Game niet gevonden')

  const allReady =
    game.players.length === 2 && game.players.every((p) => p.ready)

  // update phase if needed
  let phase = game.phase
  let turn = game.turn

  if (allReady) {
    phase = 'battle'
    // first player to join the game gets the first turn
    turn = game.players[0].playerId

    await prisma.game.update({
      where: { id: gameId },
      data: { phase: 'battle', turn },
    })
  }

  // realtime sync
  await pusher.publish(`game-${gameId}`, 'phase-changed', {
    phase,
    turn,
    players: game.players,
  })
}