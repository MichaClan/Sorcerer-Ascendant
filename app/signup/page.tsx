import SignupForm from '@/app/ui/signup-form'

export default function SignupPage() {
  return (
    <div>
      <h1>Account aanmaken</h1>
      <SignupForm />
      <p>
        Heb je al een account? <a href="/login">Inloggen</a>
      </p>
    </div>
  )
}