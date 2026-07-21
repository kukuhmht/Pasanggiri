import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'
import { Footer } from '@/components/footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pasanggiri.web.id'),
  title: { default: 'Pasanggiri | Digital Scoring Persinas ASAD', template: '%s | Pasanggiri' },
  description: 'Platform pendaftaran kontingen & digital scoring Pasanggiri Persinas ASAD. Kelola event, peserta, juri, gelanggang real-time, dan hasil otomatis.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  keywords: [
    'Pasanggiri', 'Asad', 'Pasanggiri App', 'Pasanggiri Web', 'Pasanggiri Asad',
    'Penilaian Asad', 'Penilaian Pasanggiri', 'Pencak Silat', 'Persinas Asad',
    'Digital Scoring Pasanggiri', 'Scoring Pencak Silat', 'Pasanggiri Online',
  ],
  openGraph: {
    title: 'Pasanggiri | Digital Scoring Persinas ASAD',
    description: 'Platform pendaftaran kontingen & penilaian Pasanggiri Persinas ASAD.',
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
