'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, type ReactNode } from 'react'

import { AuthProvider } from '../auth'
import { ageOf } from '@/lib/progress'

import { AgeFilter, ContentProvider, useContent } from '../offline/content'
import { LearnerProvider, useLearner } from '../offline/learner'
import { PrefsProvider, usePrefs } from '../prefs'
import { AppLock } from './AppLock'
import { AppUpdate } from './AppUpdate'
import { BackButton } from './BackButton'
import { installGlobalHealing } from '../heal'
import { PerfProbe } from './PerfProbe'
import { Permissions } from './Permissions'
import { Splash } from './Splash'
import { Mascot } from './Mascot'
import { PullSignature } from './PullSignature'
import { ScreenFit } from './ScreenFit'
import { Butterflies } from './Butterfly'
import { Dock } from './Dock'
import { MahliyoCall } from './MahliyoCall'
import { ScreenGuard } from './ScreenGuard'
import { NotifyBridge } from './NotifyBridge'
import { SupportWatch } from './SupportWatch'
import { showToast, Toaster } from './Toast'
import { WidgetBridge } from './WidgetBridge'

/** Pages a visitor may open before choosing a name or entering a code. */
const OPEN = /^\/(start|admin|page|support)(\/|$)/

/** Sends a first-time visitor to /start (name → code, or code → restore). */
function Gate({ children }: { children: ReactNode }) {
  const { ready, learner, progress, pendingLogin } = useLearner()
  const path = usePathname() ?? '/'
  const router = useRouter()
  // a new learner; one registered before the age or login questions existed (login only when online,
  // and not for one who signed in with Google); or one signed in with a temporary password
  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  const needsStart = ready && !OPEN.test(path)
    && (!learner || progress.born === undefined || (online && (!!learner.emailPending || (!learner.username && !learner.google && !learner.email && !pendingLogin))))
  // after signing in, the welcome questions once (her answers shape the start; skipping counts too)
  const needsWelcome = ready && !needsStart && !!learner && !progress.about && !OPEN.test(path) && !/^\/welcome(\/|$)/.test(path)
  useEffect(() => {
    if (needsStart) router.replace('/start')
    else if (needsWelcome) router.replace('/welcome')
  }, [needsStart, needsWelcome, router])
  const waiting = !ready || needsStart || needsWelcome
  // the boot script hid everything for a first visit; show it again once a real page is drawn
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('gated', waiting)
  }, [waiting])
  if (waiting) return null
  return <>{children}</>
}

/** UI strings and help texts edited in the CMS come with the content bundle. */
function CmsStrings() {
  const { bundle } = useContent()
  const { setCms } = usePrefs()
  useEffect(() => {
    if (bundle?.ui) setCms(bundle.ui)
  }, [bundle, setCms])
  return null
}

/** Everything below sees the catalogue limited to the learner's age. */
function ForAge({ children }: { children: ReactNode }) {
  const { progress } = useLearner()
  return <AgeFilter age={ageOf(progress)}>{children}</AgeFilter>
}

/** Long presses and right clicks open no browser menu (text fields keep theirs). */
function AppFeel() {
  // errors outside the screens: stale release code reloads itself, everything is reported (heal.ts)
  useEffect(() => installGlobalHealing(), [])
  useEffect(() => {
    const block = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
    }
  }, [])
  // while anything scrolls, the endless decorative animations rest (html.is-scrolling): the phone's GPU
  // draws only the moving page, so scrolling stays smooth; they go on a moment after it stops
  useEffect(() => {
    const root = document.documentElement
    let rest = 0
    const moving = (e: Event) => {
      // what moves by itself, frame by frame — the words of the day rising, the schools' row touring — is not her
      // scrolling (else every animation would stand still for as long as it moves: a greeting frozen half-way)
      if ((e.target as Element | null)?.closest?.('.words-text, .is-touring')) return
      if (!rest) root.classList.add('is-scrolling')
      clearTimeout(rest)
      rest = window.setTimeout(() => { rest = 0; root.classList.remove('is-scrolling') }, 180)
    }
    document.addEventListener('scroll', moving, { capture: true, passive: true })
    return () => { document.removeEventListener('scroll', moving, { capture: true }); clearTimeout(rest) }
  }, [])
  return null
}

/** Without a connection: one quiet note on opening and whenever the connection drops. */
function OfflineNote() {
  const { t } = usePrefs()
  useEffect(() => {
    const say = () => showToast(t('offline.note'), 'wifiOff', 4200)
    const first = setTimeout(() => {
      if (navigator.onLine === false) say()
    }, 1200)
    window.addEventListener('offline', say)
    return () => {
      clearTimeout(first)
      window.removeEventListener('offline', say)
    }
  }, [t])
  return null
}

/** Butterflies for the page being shown (a new set on every page). */
function PageButterflies() {
  const path = usePathname() ?? '/'
  return <Butterflies key={path} path={path} />
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PrefsProvider>
        <ContentProvider>
          <CmsStrings />
          <AppFeel />
          <LearnerProvider>
            <ForAge>
              <Gate>{children}</Gate>
              <PageButterflies />
              <Dock />
              <MahliyoCall />
              <ScreenGuard />
              <AppUpdate />
              <NotifyBridge />
              <SupportWatch />
              <Permissions />
              <AppLock />
              <Splash />
              <PerfProbe />
              <OfflineNote />
              <BackButton />
              <ScreenFit />
              <PullSignature />
              <WidgetBridge />
              <Toaster />
              <Mascot />
            </ForAge>
          </LearnerProvider>
        </ContentProvider>
      </PrefsProvider>
    </AuthProvider>
  )
}
