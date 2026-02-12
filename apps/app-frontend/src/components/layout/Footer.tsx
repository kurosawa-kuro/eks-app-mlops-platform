export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 py-4">
      <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; {new Date().getFullYear()} EC Shop Admin. All rights reserved.</p>
      </div>
    </footer>
  )
}
