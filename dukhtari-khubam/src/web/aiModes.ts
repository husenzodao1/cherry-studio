import type { IconName } from './components/Icon'
import type { AiMode } from './offline/mahliyo'

/**
 * The ways Mahliyo can answer, in the paperclip's row (its chips) and on the chip over the box: the answer
 * styles first, then her skills. Each has its sign and its colour.
 */
export const AI_MODES: { id: AiMode; icon: IconName; color: string }[] = [
  { id: 'precise', icon: 'target', color: '#e0435a' },
  { id: 'science', icon: 'flask', color: '#17a37a' },
  { id: 'friendly', icon: 'smile', color: '#e8a21a' },
  { id: 'girly', icon: 'heart', color: '#e05aa8' },
  // skills
  { id: 'lawyer', icon: 'scale', color: '#1e3a8a' },
  { id: 'music', icon: 'music', color: '#d946ef' },
  { id: 'exam', icon: 'cap', color: '#2563eb' },
  { id: 'mmt', icon: 'book', color: '#7c3aed' },
  { id: 'math', icon: 'calc', color: '#0891b2' },
  { id: 'writer', icon: 'pen', color: '#b45309' },
  { id: 'translate', icon: 'translate', color: '#0d9488' },
  { id: 'language', icon: 'speech', color: '#4f46e5' },
  { id: 'history', icon: 'scroll', color: '#92400e' },
  { id: 'career', icon: 'compass', color: '#0369a1' },
  { id: 'code', icon: 'code', color: '#334155' },
  { id: 'nutrition', icon: 'apple', color: '#16a34a' },
  { id: 'calm', icon: 'leaf', color: '#059669' },
  { id: 'factcheck', icon: 'shield', color: '#dc2626' },
  { id: 'facts', icon: 'sparkle', color: '#f59e0b' }
]
export const MODE_ICON = Object.fromEntries(AI_MODES.map((m) => [m.id, m.icon])) as Record<AiMode, IconName>
