import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/app/lib/session'
import { prisma } from '@/src/lib/prisma'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  const session = await verifySession()
  if (!session) return null

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: session.userId as string,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return user
  } catch (error) {
    console.log('Gebruiker ophalen mislukt')
    return null
  }
})