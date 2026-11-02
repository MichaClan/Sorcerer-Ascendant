'use server'
import { hash, compare } from "bcrypt"
import { createSession, deleteSession } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from "@/src/lib/prisma"

type FormState = {
  error?: string
} | undefined

export async function signup(state: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  // Check of alle velden zijn ingevuld
  if (!email || !password || !name) {
    return { error: 'Vul alle velden in' }
  }

  // Check of de email al in gebruik is
  const userExists = await prisma.user.findUnique({
    where: { email: email }
  })
  if (userExists) {
    return { error: 'Email is al in gebruik' }
  }

  // Hash het wachtwoord
  const hashedPassword = await hash(password, 10)

  // Maak de User aan met een gekoppelde Player
  const user = await prisma.user.create({
    data: {
      email: email,
      password: hashedPassword,
      name: name,
      player: {
        create: {
          name: name,
        }
      }
    }
  })

  // Start een sessie en stuur door naar de homepagina
  await createSession(user.id)
  redirect('/')
}

export async function login(state: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Vul alle velden in' }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { player: true }
  })
  if (!user) {
    return { error: 'Email of wachtwoord is onjuist' }
  }

  // Vergelijk het wachtwoord met de hash in de database
  const passwordMatch = await compare(password, user.password)
  if (!passwordMatch) {
    return { error: 'Email of wachtwoord is onjuist' }
  }

  if (!user.player) {
    await prisma.player.create({
      data: {
        name: user.name ?? "Player",
        userId: user.id
      }
    })
  }

  // Start een sessie en stuur door naar de homepagina
  await createSession(user.id)
  redirect('/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}