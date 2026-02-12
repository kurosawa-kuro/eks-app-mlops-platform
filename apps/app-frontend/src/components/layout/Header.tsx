'use client'

import { useRouter } from 'next/navigation'
import type { User } from '@/types/auth'
import { useAuthStore } from '@/stores/authStore'

interface HeaderProps {
  user: User
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function Header({ user, sidebarOpen, setSidebarOpen }: HeaderProps) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 before:absolute before:inset-0 before:backdrop-blur-md max-lg:before:bg-white/90 dark:max-lg:before:bg-gray-800/90 before:-z-10 z-30 border-b border-gray-200 dark:border-gray-700/60">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px">
          {/* Left: Hamburger */}
          <div className="flex">
            <button
              className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>
          </div>

          {/* Right: User info + Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 fill-current text-violet-500" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664h10Z" />
                </svg>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-100">
                  {user.email?.includes('@') ? user.email.split('@')[0] : (user.role || 'User')}
                </span>
                {user.role && (
                  <span className="ml-2 inline-flex text-xs font-medium bg-violet-500/20 text-violet-500 rounded-full px-2 py-0.5">
                    {user.role}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <hr className="w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none" />

            <button
              onClick={handleLogout}
              className="btn-sm border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
