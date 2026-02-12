interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-700 dark:border-gray-600 border-t-violet-500 ${sizeMap[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
