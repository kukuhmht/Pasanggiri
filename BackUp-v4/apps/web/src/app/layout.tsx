import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Pasanggiri — Sistem Penilaian Pencak Silat',
  description: 'Platform SaaS untuk pendaftaran dan penilaian Pasanggiri Pencak Silat Persinas ASAD',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#1B4332',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="min-h-screen bg-krem antialiased">
        {children}
      </body>
    </html>
  )
}
