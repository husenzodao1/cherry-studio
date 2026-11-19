import type { Metadata, Viewport } from 'next'
import { Caveat, Cormorant, Geologica, Lora, Monsieur_La_Doulaise, Noto_Naskh_Arabic, Pacifico } from 'next/font/google'
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
// the studio's signature over the profile photo: a fine, hard-to-read copperplate (Latin only)
const studio = Monsieur_La_Doulaise({ subsets: ['latin'], weight: '400', variable: '--font-studio', display: 'swap', preload: false })
// poems in the "Garden of verse" tile: a literary italic with the Tajik letters
const verse = Cormorant({ subsets: ['cyrillic', 'cyrillic-ext', 'latin'], style: ['italic'], weight: ['500', '600'], variable: '--font-verse', display: 'swap', preload: false })
// Persian and Dari script is only needed when those languages are chosen: do not preload it for everyone.
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap', preload: false })

const FIRST_ART = ['glass-flower', 'glass-flower-open', 'glass-lotus', 'glass-bubble', 'glass-leaves', 'glass-tulip', 'book-open', 'words-band']
  .map((n) => `/assets/3d/${n}.webp`)

const SPLASH_ART = ['glass-flower', 'book-open', 'glass-bubble', 'glass-lotus', 'glass-tulip', 'glass-crystals']

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

// Before the first paint: hides the app behind the PIN screen when a PIN is set, hides it entirely for
// a first visit on its way to /start (no flash of the home screen), and applies the saved
// theme, text size and language (no flash).
const boot = `try{if(localStorage.getItem('dk.pin'))document.documentElement.classList.add('locked');if(!localStorage.getItem('dk.learner')&&!/^\\/(start|admin|page|support)(\\/|$)/.test(location.pathname))document.documentElement.classList.add('gated')}catch(e){}try{var p=JSON.parse(localStorage.getItem('dk.prefs')||'{}'),r=document.documentElement,t=['light','dark','sakura','peach','mint','dusk'].indexOf(p.theme)<0||(p.theme==='light'&&!(p.v>=3))?'peach':p.theme;r.dataset.theme=t==='dark'||t==='dusk'?'dark':'light';if(t!=='light'&&t!=='dark')r.dataset.palette=t;else delete r.dataset.palette;var s=p.v>=2?p.textScale:(p.textScale&&p.textScale!==1?p.textScale:0.9);r.style.setProperty('--text-scale',String(s||0.9));if(p.locale){r.lang=p.locale;r.dir=p.locale==='fa'||p.locale==='prs'?'rtl':'ltr'}}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tg" data-theme="light" data-palette="peach" className={`${geologica.variable} ${lora.variable} ${pacifico.variable} ${caveat.variable} ${naskh.variable} ${studio.variable} ${verse.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        {/* the home screen's art is on the phone: ask for it at once, so nothing appears late */}
        {FIRST_ART.map((src) => <link key={src} rel="preload" as="image" href={src} />)}
      </head>
      <body>
        {/* from the first paint until the screen is ready: 3D glass pieces circling the name, a filling
            bar below (CSS only, so it shows before any script); Splash.tsx takes it away */}
        <div id="splash" className="splash" aria-hidden="true">
          <div className="sp-stage">
            <div className="sp-ring">
              {SPLASH_ART.map((n, i) => (
                <span key={n} className="sp-item" style={{ ['--i' as string]: i, ['--n' as string]: SPLASH_ART.length }}>
                  <img src={`/assets/3d/${n}.webp`} alt="" />
                </span>
              ))}
            </div>
            <span className="sp-name">Духтари хубам</span>
          </div>
          <span className="sp-bar"><i /></span>
        </div>
        <Providers>
          <Backdrop />
          <main className="app">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
