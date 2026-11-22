'use client'

import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { browserSupabase } from './supabase-browser'

interface AuthState {
  session: Session | null
  ready: boolean
  configured: boolean
}

const AuthContext = createContext<AuthState>({ session: null, ready: false, configured: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false, configured: !!browserSupabase() })
  useEffect(() => {
    const sb = browserSupabase()
    if (!sb) {
      setState({ session: null, ready: true, configured: false })
      return
    }
    sb.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true, configured: true }))
    const { data } = sb.auth.onAuthStateChange((_event, session) => setState({ session, ready: true, configured: true }))
    return () => data.subscription.unsubscribe()
  }, [])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
