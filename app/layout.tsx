import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'משחק זיכרון',
  description: 'Multiplayer memory card game',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className="bg-slate-900 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
