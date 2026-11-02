'use client'

import { login } from '@/app/actions/auth'
import { useActionState } from 'react'

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action}>
      {state?.error && (
        <p style={{ color: 'red' }}>{state.error}</p>
      )}

      <div>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" placeholder="je@email.nl" />
      </div>

      <div>
        <label htmlFor="password">Wachtwoord</label>
        <input id="password" name="password" type="password" placeholder="Wachtwoord" />
      </div>

      <button disabled={pending} type="submit">
        {pending ? 'Bezig...' : 'Inloggen'}
      </button>
    </form>
  )
}