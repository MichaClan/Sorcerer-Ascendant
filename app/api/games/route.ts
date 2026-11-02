import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET() {
  const games = await prisma.game.findMany({
    include: {
      players: {
        include: {
          player: {
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(games)
}