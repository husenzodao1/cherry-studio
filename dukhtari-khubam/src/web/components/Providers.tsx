'use client'

import type { ReactNode } from 'react'

import { AuthProvider } from '../auth'
import { PrefsProvider } from '../prefs'
import { Dock } from './Dock'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PrefsProvider>
        {children}
        <Dock />
      </PrefsProvider>
    </AuthProvider>
  )
}
