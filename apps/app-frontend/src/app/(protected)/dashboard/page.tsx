'use client'

import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value="1,234"
          subtitle="Active users"
        />
        <StatCard
          title="Total Orders"
          value="5,678"
          subtitle="Last 30 days"
        />
        <StatCard
          title="Revenue"
          value="$123,456"
          subtitle="This month"
        />
        <StatCard
          title="Products"
          value="890"
          subtitle="In catalog"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {isAdmin && (
                <>
                  <a
                    href="/admin/analytics"
                    className="rounded-lg bg-violet-600/20 p-4 text-violet-300 hover:bg-violet-600/30 transition-colors"
                  >
                    <h3 className="font-semibold">Analytics</h3>
                    <p className="text-sm text-violet-400">View sales analytics</p>
                  </a>
                  <a
                    href="/admin/sentiment"
                    className="rounded-lg bg-violet-500/20 p-4 text-violet-300 hover:bg-violet-500/30 transition-colors"
                  >
                    <h3 className="font-semibold">Sentiment</h3>
                    <p className="text-sm text-violet-400">Review sentiment analysis</p>
                  </a>
                  <a
                    href="/admin/llm"
                    className="rounded-lg bg-green-600/20 p-4 text-green-300 hover:bg-green-600/30 transition-colors"
                  >
                    <h3 className="font-semibold">LLM Chat</h3>
                    <p className="text-sm text-green-400">AI assistant chat</p>
                  </a>
                </>
              )}
              <a
                href="#"
                className="rounded-lg bg-gray-100 dark:bg-gray-700/50 p-4 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <h3 className="font-semibold">Profile</h3>
                <p className="text-sm text-gray-400">Manage your account</p>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-4">
                <div className="h-10 w-10 rounded-full bg-violet-600/20 flex items-center justify-center">
                  <span className="text-violet-400">O</span>
                </div>
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">New order received</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-4">
                <div className="h-10 w-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <span className="text-violet-400">U</span>
                </div>
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">New user registered</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">5 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-600/20 flex items-center justify-center">
                  <span className="text-green-400">P</span>
                </div>
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">Product updated</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">10 minutes ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
