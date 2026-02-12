'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, user, isInitialized } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  const checkBackendHealth = async () => {
    setIsCheckingHealth(true)
    setHealthStatus(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const endpoints = [
      { name: 'Backend Internal', url: '/api/health-proxy' },
      { name: 'Backend Direct', url: `${apiUrl}/health` },
    ]

    const results: string[] = []

    for (const ep of endpoints) {
      try {
        const start = Date.now()
        const res = await fetch(ep.url, { method: 'GET' })
        const elapsed = Date.now() - start
        const data = await res.text()
        results.push(`${ep.name}: ${res.status} (${elapsed}ms) - ${data.slice(0, 100)}`)
      } catch (err) {
        results.push(`${ep.name}: ERROR - ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    setHealthStatus(results.join('\n'))
    setIsCheckingHealth(false)
  }

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isInitialized && user) {
      router.push('/dashboard')
    }
  }, [isInitialized, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = await login(email, password)

    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-gray-100">Login</h1>

        {error && (
          <div className="mb-4 rounded bg-red-500/20 p-3 text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full"
          >
            Login
          </Button>
        </form>

        <div className="mt-6 border-t border-gray-200 dark:border-gray-700/60 pt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Demo credentials:
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            user1@example.com / admin@example.com
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            See .env for demo credentials
          </p>
        </div>

        <div className="mt-4 border-t border-gray-200 dark:border-gray-700/60 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={checkBackendHealth}
            disabled={isCheckingHealth}
            className="w-full"
          >
            {isCheckingHealth ? 'Checking...' : 'Check Backend Health'}
          </Button>
          {healthStatus && (
            <pre className="mt-3 rounded bg-gray-100 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-40">
              {healthStatus}
            </pre>
          )}
        </div>
      </Card>
    </div>
  )
}
