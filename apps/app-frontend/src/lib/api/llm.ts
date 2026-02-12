import { api } from './fetcher'
import type { ApiResponse } from '@/types/api'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
}

export interface ChatResponse {
  message: ChatMessage
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface LlmHealthResponse {
  status: 'healthy' | 'unhealthy'
  provider: string
  model?: string
}

export const llmApi = {
  /**
   * Health check
   */
  health: async (): Promise<ApiResponse<LlmHealthResponse>> => {
    return api.get<LlmHealthResponse>('/internal/llm/health')
  },

  /**
   * Chat completion
   */
  chat: async (data: ChatRequest): Promise<ApiResponse<ChatResponse>> => {
    return api.post<ChatResponse>('/internal/llm/chat', data)
  },

  /**
   * Embeddings (for future use)
   */
  embeddings: async (texts: string[]): Promise<ApiResponse<{ embeddings: number[][] }>> => {
    return api.post<{ embeddings: number[][] }>('/internal/llm/embeddings', { texts })
  },
}
