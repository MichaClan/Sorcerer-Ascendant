import LoginForm from '@/app/ui/login-form'

export default function LoginPage() {
  return (
    <div>
      <h1>Inloggen</h1>
      <LoginForm />
      <p>
        Nog geen account? <a href="/signup">Registreren</a>
      </p>
    </div>
  )
}