'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@/types/auth'
import { useCartStore } from '@/stores/cartStore'

interface SidebarProps {
  user: User
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function Sidebar({ user, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const pathname = usePathname()
  const cartItemCount = useCartStore((s) => s.cart?.itemCount || 0)
  const isAdmin = user.role === 'admin'
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    <div className="min-w-fit">
      {/* Sidebar backdrop (mobile) */}
      <div
        className={`fixed inset-0 bg-gray-900/30 z-40 lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`flex flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-[100dvh] overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 shrink-0 bg-white dark:bg-gray-800 p-4 transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex justify-between mb-10 pr-3 sm:px-2">
          {/* Logo */}
          <Link href="/dashboard" className="block">
            <svg className="fill-violet-500" xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 32 32">
              <path d="M31.956 14.8C31.372 6.92 25.08.628 17.2.044V5.76a9.04 9.04 0 0 0 9.04 9.04h5.716ZM14.8 26.24v5.716C6.92 31.372.63 25.08.044 17.2H5.76a9.04 9.04 0 0 1 9.04 9.04Zm11.44-9.04h5.716c-.584 7.88-6.876 14.172-14.756 14.756V26.24a9.04 9.04 0 0 1 9.04-9.04ZM.044 14.8C.63 6.92 6.92.628 14.8.044V5.76a9.04 9.04 0 0 1-9.04 9.04H.044Z" />
            </svg>
          </Link>
          {/* Close button (mobile) */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-400"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M7.95 6.536l4.242-4.243a1 1 0 111.415 1.414L9.364 7.95l4.243 4.242a1 1 0 11-1.415 1.415L7.95 9.364l-4.243 4.243a1 1 0 01-1.414-1.415L6.536 7.95 2.293 3.707a1 1 0 011.414-1.414L7.95 6.536z" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <div className="space-y-8">
          {/* Pages group */}
          <div>
            <h3 className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold pl-3">
              <span>Pages</span>
            </h3>
            <ul className="mt-3">
              {/* Dashboard */}
              <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                <Link
                  href="/dashboard"
                  className={`block transition truncate ${
                    isActive('/dashboard')
                      ? 'text-violet-500'
                      : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className={`shrink-0 fill-current ${isActive('/dashboard') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                      <path d="M5.936.278A7.983 7.983 0 0 1 8 0a8 8 0 1 1-8 8c0-.722.104-1.413.278-2.064a1 1 0 1 1 1.932.516A5.99 5.99 0 0 0 2 8a6 6 0 1 0 6-6c-.53 0-1.045.076-1.548.21A1 1 0 1 1 5.936.278Z" />
                      <path d="M6.068 7.482A2.003 2.003 0 0 0 8 10a2 2 0 1 0-.518-3.932L3.707 2.293a1 1 0 0 0-1.414 1.414l3.775 3.775Z" />
                    </svg>
                    <span className="text-sm font-medium ml-4">Dashboard</span>
                  </div>
                </Link>
              </li>
            </ul>
          </div>

          {/* E-Commerce group */}
          <div>
            <h3 className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold pl-3">
              <span>E-Commerce</span>
            </h3>
            <ul className="mt-3">
              {/* Products */}
              <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                <Link
                  href="/shop/products"
                  className={`block transition truncate ${
                    isActive('/shop/products')
                      ? 'text-violet-500'
                      : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className={`shrink-0 fill-current ${isActive('/shop/products') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                      <path d="M2 0a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2Zm0 9a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H2Zm9-9a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2h-3Zm0 9a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3Z" />
                    </svg>
                    <span className="text-sm font-medium ml-4">Products</span>
                  </div>
                </Link>
              </li>

              {/* Cart */}
              <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                <Link
                  href="/shop/cart"
                  className={`block transition truncate ${
                    isActive('/shop/cart')
                      ? 'text-violet-500'
                      : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive('/shop/cart') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                        <path d="M2.5 1a1 1 0 0 0 0 2h.191l1.328 5.313A2.5 2.5 0 0 0 6.473 10.5h4.054a2.5 2.5 0 0 0 2.454-2.03l.96-4.8A1 1 0 0 0 12.96 2.5H4.691L4.5 1.675A1 1 0 0 0 3.52 1H2.5ZM6 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4">Cart</span>
                    </div>
                    {cartItemCount > 0 && (
                      <span className="inline-flex items-center justify-center text-xs font-medium bg-violet-500 text-white rounded-full w-5 h-5">
                        {cartItemCount}
                      </span>
                    )}
                  </div>
                </Link>
              </li>

              {/* Orders */}
              <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                <Link
                  href="/shop/orders"
                  className={`block transition truncate ${
                    isActive('/shop/orders')
                      ? 'text-violet-500'
                      : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className={`shrink-0 fill-current ${isActive('/shop/orders') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                      <path d="M3 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3Zm2 3a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H6Z" />
                    </svg>
                    <span className="text-sm font-medium ml-4">Orders</span>
                  </div>
                </Link>
              </li>
            </ul>
          </div>

          {/* Admin group */}
          {isAdmin && (
            <div>
              <h3 className="text-xs uppercase text-gray-400 dark:text-gray-500 font-semibold pl-3">
                <span>Admin</span>
              </h3>
              <ul className="mt-3">
                {/* Analytics */}
                <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                  <Link
                    href="/admin/analytics"
                    className={`block transition truncate ${
                      isActive('/admin/analytics')
                        ? 'text-violet-500'
                        : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive('/admin/analytics') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                        <path d="M9 3H1a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2ZM7 7H1a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2ZM5 11H1a1 1 0 1 1 0-2h4a1 1 0 1 1 0 2ZM15 1a1 1 0 0 0-2 0v12a1 1 0 0 0 2 0V1ZM11 5a1 1 0 0 0-2 0v8a1 1 0 0 0 2 0V5Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4">Analytics</span>
                    </div>
                  </Link>
                </li>

                {/* Sentiment */}
                <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                  <Link
                    href="/admin/sentiment"
                    className={`block transition truncate ${
                      isActive('/admin/sentiment')
                        ? 'text-violet-500'
                        : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive('/admin/sentiment') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm-2.5-5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-5 1.5c0 .828 1.12 2.5 2.5 2.5s2.5-1.672 2.5-2.5a.5.5 0 0 0-1 0c0 .356-.672 1.5-1.5 1.5S6.5 10.856 6.5 10.5a.5.5 0 0 0-1 0Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4">Sentiment</span>
                    </div>
                  </Link>
                </li>

                {/* LLM */}
                <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                  <Link
                    href="/admin/llm"
                    className={`block transition truncate ${
                      isActive('/admin/llm')
                        ? 'text-violet-500'
                        : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive('/admin/llm') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                        <path d="M5 1a1 1 0 0 0-1 1v6.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L6 8.586V2a1 1 0 0 0-1-1ZM11 15a1 1 0 0 0 1-1V7.414l1.293 1.293a1 1 0 1 0 1.414-1.414l-3-3a1 1 0 0 0-1.414 0l-3 3a1 1 0 0 0 1.414 1.414L10 7.414V14a1 1 0 0 0 1 1Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4">LLM</span>
                    </div>
                  </Link>
                </li>

                {/* Audit */}
                <li className="pl-4 pr-3 py-2 rounded-lg mb-0.5">
                  <Link
                    href="/admin/audit"
                    className={`block transition truncate ${
                      isActive('/admin/audit')
                        ? 'text-violet-500'
                        : 'text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <svg className={`shrink-0 fill-current ${isActive('/admin/audit') ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} width="16" height="16" viewBox="0 0 16 16">
                        <path d="M7.586 1.526A.6.6 0 0 1 8.414 1.526l5.082 4.927A2 2 0 0 1 14 7.865V13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.865a2 2 0 0 1 .504-1.412l5.082-4.927ZM6 12h4a1 1 0 1 0 0-2H6a1 1 0 1 0 0 2Z" />
                      </svg>
                      <span className="text-sm font-medium ml-4">Audit</span>
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
