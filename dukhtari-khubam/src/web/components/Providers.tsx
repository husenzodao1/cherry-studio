'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { AuthProvider } from '../auth'
import { ContentProvider, useContent } from '../offline/content'
import { LearnerProvider, useLearner } from '../offline/learner'
import { PrefsProvider, usePrefs } from '../prefs'
import { Dock } from './Dock'

/** Pages a visitor may open before choosing a name or entering a code. */
const OPEN = /^\/(start|admin|page)(\/|$)/

/** Sends a first-time visitor to /start (name → code, or code → restore). */
function Gate({ children }: { children: ReactNode }) {
  const { ready, learner } = useLearner()
  const path = usePathname() ?? '/'
  const router = useRouter()
  const needsStart = ready && !learner && !OPEN.test(path)
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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PrefsProvider>
        <ContentProvider>
          <CmsStrings />
          <LearnerProvider>
            <Gate>{children}</Gate>
            <Dock />
          </LearnerProvider>
        </ContentProvider>
      </PrefsProvider>
    </AuthProvider>
  )
}
