'use client'

import { Heal } from '@/web/components/Heal'
import { usePrefs } from '@/web/prefs'

/** A screen that broke: the app repairs itself first (web/heal.ts); the card is the last resort. */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = usePrefs()
  return <Heal error={error} reset={reset} where="screen"
    text={{ title: t('heal.title'), body: t('heal.body'), retry: t('action.retry'), home: t('nav.home') }} />
}
