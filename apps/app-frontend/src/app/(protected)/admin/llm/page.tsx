'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { llmApi, type ChatMessage } from '@/lib/api/llm'

export default function LlmPage() {
  useAuth({ requiredRole: 'admin', redirectTo: '/dashboard' })

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<{ status: string; provider: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check health on mount
  useEffect(() => {
    checkHealth()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkHealth = async () => {
    try {
      const result = await llmApi.health()
      if (result.success && result.data) {
        setHealth(result.data)
      }
    } catch (e) {
      console.error('Health check failed:', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const result = await llmApi.chat({
        messages: [...messages, userMessage],
      })

      if (result.success && result.data) {
        setMessages((prev) => [...prev, result.data!.message])
      } else {
        setError(result.error || 'Failed to get response')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">LLM Chat</h1>
          {health && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Provider: {health.provider} | Status:{' '}
              <span className={health.status === 'healthy' ? 'text-green-400' : 'text-red-400'}>
                {health.status}
              </span>
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={clearChat}>
          Clear Chat
        </Button>
      </div>

      <Card className="flex flex-col h-[600px]">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p>Start a conversation with the AI assistant.</p>
                <p className="text-sm mt-2">Try asking about sales data or customer insights.</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                  <Spinner size="sm" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="mb-4 rounded bg-red-500/20 p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-gray-800 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={isLoading}
            />
            <Button type="submit" isLoading={isLoading}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
