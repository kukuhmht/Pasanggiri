import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'
import { Footer } from '@/components/footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Pasanggiri | Sistem Penilaian Pencak Silat Asad',
  description: 'Platform SaaS untuk pendaftaran dan penilaian Pasanggiri Pencak Silat Persinas ASAD. Kelola event, peserta, juri, gelanggang real-time, dan hasil otomatis.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  keywords: [
    'Pasanggiri', 'Asad', 'Pasanggiri App', 'Pasanggiri Asad',
    'Penilaian Asad', 'Penilaian Pasanggiri', 'Pencak Silat', 'Persinas ASAD',
  ],
  openGraph: {
    title: 'Pasanggiri | Sistem Penilaian Pencak Silat Asad',
    description: 'Platform pendaftaran & penilaian Pasanggiri Pencak Silat Persinas ASAD.',
    locale: 'id_ID',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#1B4332',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="flex flex-col min-h-screen bg-krem antialiased">
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
