import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'
import { Footer } from '@/components/footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pasanggiri.web.id'),
  title: { default: 'Pasanggiri | Aplikasi Digital Scoring & Penilaian Pasanggiri Asad', template: '%s | Pasanggiri' },
  description: 'App Pasanggiri untuk pendaftaran kontingen dan sistem penilaian juri Pasanggiri Asad. Aplikasi digital skoring dengan live score real-time, gelanggang, dan hasil otomatis untuk setiap event Pasanggiri.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  keywords: [
    'Pasaggiri', 'App Pasaggiri', 'Aplikasi Pasaggiri', 'Pasaggiri Asad',
    'Pasaggiri Digital Scoring', 'Aplikasi Digital Skoring', 'Aplikasi Penilaian Pasaggiri',
    'Sistem Penilaian Pasaggiri', 'Sistem Penilaian Juri Pasaggiri Asad',
    'Juri Pasaggiri Asad', 'Live Score Pasaggiri', 'Event Pasaggiri',
    'Persinas Asad', 'Pencak Silat', 'Digital Scoring Pencak Silat',
  ],
  openGraph: {
    title: 'Pasaggiri | Aplikasi Digital Scoring & Penilaian Pasaggiri Asad',
    description: 'App Pasaggiri untuk pendaftaran kontingen dan sistem penilaian juri Pasaggiri Asad. Aplikasi digital skoring dengan live score real-time, gelanggang, dan hasil otomatis untuk setiap event Pasaggiri.',
    locale: 'id_ID',
    type: 'website',
  },
  alternates: { canonical: '/' },
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
