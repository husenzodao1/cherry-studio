import type { Metadata, Viewport } from 'next'
import { Caveat, Geologica, Lora, Noto_Naskh_Arabic, Pacifico } from 'next/font/google'
import type { ReactNode } from 'react'

import { Backdrop } from '@/web/components/Backdrop'
import { Providers } from '@/web/components/Providers'

import './globals.css'

// Glyph coverage for ӣ қ ғ ҳ ҷ ӯ verified for these families (Manrope lacks them).
const geologica = Geologica({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-geologica', display: 'swap' })
const lora = Lora({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], style: ['normal', 'italic'], variable: '--font-lora', display: 'swap' })
// Brush script for the name "Духтари хубам"; covers ӣ қ ғ ҳ ҷ ӯ (checked against its cmap).
// handwriting for the words of the day
const caveat = Caveat({ subsets: ['cyrillic', 'cyrillic-ext', 'latin'], weight: ['500', '700'], variable: '--font-hand', display: 'swap' })
const pacifico = Pacifico({ subsets: ['cyrillic', 'cyrillic-ext', 'latin'], weight: '400', variable: '--font-pacifico', display: 'swap' })
// Arabic is only needed when that language is chosen: do not preload it for everyone.
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap', preload: false })

const FIRST_ART = ['glass-flower', 'glass-flower-open', 'glass-lotus', 'glass-bubble', 'glass-leaves', 'glass-tulip', 'book-open', 'words-band']
  .map((n) => `/assets/3d/${n}.webp`)

export const metadata: Metadata = {
  title: { default: 'Духтари хубам', template: '%s · Духтари хубам' },
  description: 'Платформаи таълимӣ: 7 оинаи духтар.',
  applicationName: 'Духтари хубам',
  // Google Search Console: proves the site belongs to the app's Google Cloud project (sign-in branding)
  verification: { google: 'GCrXzaS2lJNx1EPFUQtASSA8FMKHMsISwpLLApPDYf8' }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1333' }
  ],
  width: 'device-width',
  initialScale: 1,
  // an app, not a page: no pinch zoom (text size is a setting)
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

// Before the first paint: hides the app behind the PIN screen when a PIN is set, and applies the saved
// theme, text size and language (no flash).
const boot = `try{if(localStorage.getItem('dk.pin'))document.documentElement.classList.add('locked')}catch(e){}try{var p=JSON.parse(localStorage.getItem('dk.prefs')||'{}'),r=document.documentElement,t=['light','dark','sakura','peach','mint','dusk'].indexOf(p.theme)<0||(p.theme==='light'&&!(p.v>=3))?'peach':p.theme;r.dataset.theme=t==='dark'||t==='dusk'?'dark':'light';if(t!=='light'&&t!=='dark')r.dataset.palette=t;else delete r.dataset.palette;var s=p.v>=2?p.textScale:(p.textScale&&p.textScale!==1?p.textScale:0.9);r.style.setProperty('--text-scale',String(s||0.9));if(p.locale){r.lang=p.locale;r.dir=p.locale==='ar'?'rtl':'ltr'}}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tg" data-theme="light" data-palette="peach" className={`${geologica.variable} ${lora.variable} ${pacifico.variable} ${caveat.variable} ${naskh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        {/* the home screen's art is on the phone: ask for it at once, so nothing appears late */}
        {FIRST_ART.map((src) => <link key={src} rel="preload" as="image" href={src} />)}
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
