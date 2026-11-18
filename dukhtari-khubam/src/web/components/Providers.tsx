'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { AuthProvider } from '../auth'
import { ageOf } from '@/lib/progress'

import { AgeFilter, ContentProvider, useContent } from '../offline/content'
import { LearnerProvider, useLearner } from '../offline/learner'
import { PrefsProvider, usePrefs } from '../prefs'
import { AppUpdate } from './AppUpdate'
import { Dock } from './Dock'
import { NotifyBridge } from './NotifyBridge'

/** Pages a visitor may open before choosing a name or entering a code. */
const OPEN = /^\/(start|admin|page)(\/|$)/

/** Sends a first-time visitor to /start (name → code, or code → restore). */
function Gate({ children }: { children: ReactNode }) {
  const { ready, learner, progress } = useLearner()
  const path = usePathname() ?? '/'
  const router = useRouter()
  // a new learner, or one registered before the age question existed
  const needsStart = ready && (!learner || progress.born === undefined) && !OPEN.test(path)
  useEffect(() => {
    if (needsStart) router.replace('/start')
  }, [needsStart, router])
  if (!ready || needsStart) return null
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
  return null
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
              <Dock />
              <AppUpdate />
              <NotifyBridge />
            </ForAge>
          </LearnerProvider>
        </ContentProvider>
      </PrefsProvider>
    </AuthProvider>
  )
}
