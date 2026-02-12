import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EC Shop Admin',
  description: 'EC Shop Administration Dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="font-inter antialiased bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
        {children}
      </body>
    </html>
  )
}
