'use client'

import { useRouter } from 'next/navigation'

import { PlansScreen } from '@/web/components/PlansScreen'

/** The plans' screen as a page of its own (a link, a notification); in the app it mostly opens over a screen. */
export default function PremiumPage() {
  const router = useRouter()
  return <PlansScreen onClose={() => (history.length > 1 ? router.back() : router.push('/'))} />
}
