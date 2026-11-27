import { useEffect } from 'react'

type VerifyEmailPageProps = {
  onNavigateHome: () => void
  onNavigateLogin: () => void
}

// Email verification is temporarily disabled for beta; redirect legacy verification links home.
export default function VerifyEmailPage({ onNavigateHome }: VerifyEmailPageProps) {
  useEffect(() => {
    onNavigateHome()
  }, [onNavigateHome])

  return null
}
