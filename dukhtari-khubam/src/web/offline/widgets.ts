import { localDay, streak, type ProgressData } from '@/lib/progress'

import type { Bundle } from './content'

/** Monday-first short weekday names for the week widget. */
const WEEK: Record<string, string[]> = {
  tg: ['Ду', 'Се', 'Чо', 'Па', 'Ҷу', 'Ша', 'Як'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  ar: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح']
}

export interface WidgetTexts {
  brand: string; streak: string; done: string; continueFallback: string; words: string; quote: string
  /** what Mahliyo says on her widget (one a day, by state): lines each */
  sayTodo?: string; sayDone?: string; sayLate?: string; go?: string
}

/**
 * The summary the home-screen widgets show: the streak, the last seven days (today last), the lessons
 * finished out of all published ones, where "continue" leads, and today's words (one of the newest
 * inspirations, a different one each day).
 */
const lines = (text?: string) => (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

export function widgetSummary(bundle: Bundle | null, progress: ProgressData, t: WidgetTexts, locale: string, now = new Date()) {
  const days = new Set(progress.days)
  const week: boolean[] = []
  const weekLabels: string[] = []
  const names = WEEK[locale] ?? WEEK.tg
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    week.push(days.has(localDay(d)))
    weekLabels.push(names[(d.getDay() + 6) % 7])
  }
  const lessonIds = Object.keys(bundle?.lessons ?? {})
  const done = Object.values(progress.lessons).filter((l) => l.done).length
  const total = Math.max(lessonIds.length, done)
  const last = progress.last ? bundle?.lessons[progress.last.lesson] : undefined
  const next = last && !progress.lessons[last.id]?.done ? last : undefined
  const items = bundle?.inspirations?.length ? bundle.inspirations : bundle?.inspiration ? [bundle.inspiration] : []
  const dayNo = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000)
  const quote = items.length ? items[dayNo % items.length] : null
  return {
    brand: t.brand,
    streak: streak(progress.days, now),
    streakText: t.streak,
    week,
    weekLabels,
    todayIndex: 6,
    done,
    doneText: t.done,
    percent: total ? Math.round((done * 100) / total) : 0,
    nextText: next ? next.title : t.continueFallback,
    nextPath: next ? `/lesson?id=${next.id}` : '/schools',
    wordsLabel: t.words.toLocaleUpperCase(),
    quote: quote?.body ?? t.quote,
    author: quote?.author_name ? `— ${quote.author_name}` : '',
    // the Mahliyo widget: the last day she learnt (has she learnt today?), and what she says, one a day
    lastDay: [...progress.days].sort().pop() ?? '',
    say: { todo: lines(t.sayTodo), done: lines(t.sayDone), late: lines(t.sayLate) },
    goText: t.go ?? t.continueFallback
  }
}
