import type { Metadata, Viewport } from 'next'
import { Geologica, Lora, Noto_Naskh_Arabic } from 'next/font/google'
import type { ReactNode } from 'react'

import { GemField } from '@/web/components/GemField'
import { Providers } from '@/web/components/Providers'

import './globals.css'

// Glyph coverage for ӣ қ ғ ҳ ҷ ӯ verified for these families (Manrope lacks them).
const geologica = Geologica({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-geologica', display: 'swap' })
const lora = Lora({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], style: ['normal', 'italic'], variable: '--font-lora', display: 'swap' })
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Духтари хубам', template: '%s · Духтари хубам' },
  description: 'Платформаи таълимӣ: ҳафт мактаби дониш.',
  applicationName: 'Духтари хубам'
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1eef5' },
    { media: '(prefers-color-scheme: dark)', color: '#120e17' }
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

// Applies the saved theme/language before first paint (no flash).
const boot = `try{var p=JSON.parse(localStorage.getItem('dk.prefs')||'{}');var d=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(p.locale){document.documentElement.lang=p.locale;document.documentElement.dir=p.locale==='ar'?'rtl':'ltr'}}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tg" className={`${geologica.variable} ${lora.variable} ${naskh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <Providers>
          <GemField />
          <main className="app">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
