'use client'

import { Heal } from '@/web/components/Heal'

import './globals.css'

/**
 * The outermost boundary (the layout itself broke): no providers here, so the words are fixed, in Tajik
 * and Russian. The app repairs itself first (web/heal.ts).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tg" data-theme="light" data-palette="peach">
      <body>
        <Heal error={error} reset={reset} where="global"
          text={{ title: 'Каме сабр кунед · Минутку', body: 'Барнома худро аз нав барқарор мекунад. · Приложение восстанавливается.', retry: 'Аз нав · Ещё раз', home: 'Асосӣ · Главная' }} />
      </body>
    </html>
  )
}
