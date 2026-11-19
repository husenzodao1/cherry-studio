import type { Metadata, Viewport } from 'next'
import { Geologica, Lora, Noto_Naskh_Arabic, Pacifico } from 'next/font/google'
import type { ReactNode } from 'react'

import { Backdrop } from '@/web/components/Backdrop'
import { Providers } from '@/web/components/Providers'

import './globals.css'

// Glyph coverage for ӣ қ ғ ҳ ҷ ӯ verified for these families (Manrope lacks them).
const geologica = Geologica({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-geologica', display: 'swap' })
const lora = Lora({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], style: ['normal', 'italic'], variable: '--font-lora', display: 'swap' })
// Brush script for the name "Духтари хубам"; covers ӣ қ ғ ҳ ҷ ӯ (checked against its cmap).
const pacifico = Pacifico({ subsets: ['cyrillic', 'cyrillic-ext', 'latin'], weight: '400', variable: '--font-pacifico', display: 'swap' })
// Arabic is only needed when that language is chosen: do not preload it for everyone.
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap', preload: false })

export const metadata: Metadata = {
  title: { default: 'Духтари хубам', template: '%s · Духтари хубам' },
  description: 'Платформаи таълимӣ: 7 оинаи духтар.',
  applicationName: 'Духтари хубам'
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1ebfc' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1333' }
  ],
  width: 'device-width',
  initialScale: 1,
  // an app, not a page: no pinch zoom (text size is a setting)
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

// Applies the saved theme/language before first paint (no flash).
const boot = `try{var p=JSON.parse(localStorage.getItem('dk.prefs')||'{}');var d=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(p.locale){document.documentElement.lang=p.locale;document.documentElement.dir=p.locale==='ar'?'rtl':'ltr'}}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tg" className={`${geologica.variable} ${lora.variable} ${pacifico.variable} ${naskh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <Providers>
          <Backdrop />
          <main className="app">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
