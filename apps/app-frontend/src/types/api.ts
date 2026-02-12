export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  status?: number
}

export interface ApiError {
  success: false
  message: string
  status?: number
  errors?: Record<string, string[]>
}
