import type { SlideLook } from './slideStyles'
/**
 * What Mahliyo AI can point to (server/mahliyo.ts tells her; MahliyoBlocks.tsx shows it):
 * - SPOTS: places on the app's screens. She shows one as a screenshot of that screen with a pulsing
 *   pointer on the place (the pictures and the places' positions are made by tools/ai-screens and kept in
 *   public/assets/ai-screens and aiSpots.json).
 * - ROUTES: the app's pages she can link to (plus a lesson or a course by its id, and https links).
 */
export const SPOTS = {
  'home.profile': 'Home, top left: her round photo — opens the profile',
  'home.download': 'Home, top: the download arrow — keeps the lessons on the phone for use without internet',
  'home.search': 'Home, top right: the magnifier — search lessons and courses',
  'home.settings': 'Home, top right: the "⋯" button — settings',
  'home.start': 'Home: the "Оғози омӯзиш" / continue card — start or continue a lesson',
  'home.words': 'Home: "Суханҳои рӯз", the words of the day',
  'home.schools': 'Home: "7 оинаи духтар", the row of the seven schools ("Ҳамааш" opens all)',
  'home.tabs': 'The tab bar at the bottom: home, schools, Mahliyo AI, saved lessons, profile',
  'settings.theme': 'Settings: "Намуди зоҳирӣ" — light, dark and colour themes',
  'settings.language': 'Settings: the language of the app',
  'settings.textsize': 'Settings: text size ("Aa")',
  'settings.support': 'Settings: "Дастгирӣ" — the chat with a consultant',
  'settings.privacy': 'Settings: "Махфият" — the privacy policy (opens the website)',
  'settings.about': 'Settings: "Дар бораи барнома" (opens the website)',
  'settings.version': 'Settings: "Версия" — the app\'s version; opens the website to download the newest',
  'settings.rate': 'Settings: rate the app and share it with friends',
  'settings.pin': 'Settings: the PIN lock — set, change or turn off the PIN, and the life questions',
  'settings.signout': 'Settings: sign out',
  'profile.photo': 'Profile: her photo — tap to change it (camera or gallery)',
  'profile.map': 'Profile: "Харитаи пешравӣ" — the progress map',
  'map.legend': 'Progress map, top: green "Олӣ" / yellow "Миёна" / red "Бад" and how many of each',
  'map.next': 'Progress map: the pulsing stop — the next lesson to read',
  'lock.forgot': 'The PIN screen: "Фаромӯш кардед?" under the number pad',
  'lock.no_answers': 'Life questions after "Фаромӯш кардед?": "Ҷавобҳоро низ дар хотир надоред?" at the bottom — the code by e-mail',
  'lock.no_email': 'The e-mail code screen: "Ба почта низ дастрасӣ нест?" at the bottom — opens support with her request sent',
  'support.write': 'Support chat: the box at the bottom to write to the consultant',
  'schools.list': 'Schools page: the seven schools; a tap opens a school and its courses'
} as const
export type SpotId = keyof typeof SPOTS
export const SPOT_IDS = Object.keys(SPOTS) as SpotId[]

export const ROUTES: Record<string, string> = {
  '/': 'home',
  '/schools': 'all schools',
  '/saved': 'saved lessons',
  '/profile': 'profile',
  '/settings': 'settings',
  '/garden': 'the progress map',
  '/review': 'the day\'s review',
  '/search': 'search',
  '/support': 'chat with a consultant',
  '/verse': '"Гулбоғи эҷод": poems and stories',
  '/page?slug=privacy': 'the privacy policy',
  '/page?slug=about': 'about the app'
}

/** One part of her answer, as the app draws it (MahliyoBlocks.tsx). */
/** how an option or a result is marked: her first pick, good, a risk, or plain */
export type Tone = 'best' | 'good' | 'risk' | 'neutral'
/** a value of a calculator: `id` is its name in the formulas; `options` (if any) are its choices instead of − / + */
export interface CalcInput { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; options: number[] }
/** a result of a calculator; the first `big` one is shown large */
export interface CalcOutput { label: string; formula: string; unit: string; tone: Tone; big: boolean }

export type AiBlock =
  | { type: 'text'; text: string }
  | { type: 'steps'; title: string; items: string[] }
  | { type: 'screen'; spot: SpotId; caption: string }
  | { type: 'link'; to: string; label: string }
  | { type: 'reminder'; at: string; title: string; text: string; daily?: boolean }
  /** a test in the chat: up to ten questions; the app checks the answers and sends her result to Mahliyo */
  /** `answer` −1: a question about herself, with no right answer (a character test); `comment`: the question of the
   *  comment box at its end ("" none), sent with her result */
  | { type: 'quiz'; title: string; intro: string; questions: { question: string; options: string[]; answer: number; explanation: string }[]; comment?: string; task?: string }
  /** she did not understand: what she asks, and choices to tap (or her own words) */
  | { type: 'clarify'; question: string; options: string[] }
  /** questions to go on with, shown under her answer; a tap asks one */
  | { type: 'follow'; items: string[] }
  /** options side by side: each with a few points; one may be her first pick (green), one a risk (red) */
  | { type: 'choices'; title: string; intro: string; items: { name: string; badge: string; tone: Tone; points: string[]; note: string }[] }
  /** a framed note: a danger or risk (red), a warning (amber), a tip (green), a plain note */
  | { type: 'callout'; tone: 'danger' | 'warning' | 'tip' | 'info'; title: string; text: string }
  /** a live calculator: values she changes with − / + or a choice, results worked out by their formulas */
  | { type: 'calc'; title: string; inputs: CalcInput[]; outputs: CalcOutput[]; note: string }
  /** a file she made: its name (the extension says what it is: pdf, docx, pptx, or a text file), title, what it
   *  holds, and its content (Markdown for documents and slides, the file itself for text); the app builds it;
   *  `style`: a presentation's style (slideStyles.ts); `look`: the look read from her sample picture */
  | { type: 'file'; name: string; title: string; about: string; content: string; style?: string; look?: SlideLook }
  /** the card that opens the Premium screen (a free learner asked for a Premium part) */
  | { type: 'music'; title: string; genre: string; prompt: string; lyrics: string; instrumental: boolean }
  | { type: 'navigate'; place: string; mode: 'foot' | 'car' }
  /** a song to find on YouTube and play in the app */
  | { type: 'play'; query: string; title: string }
  | { type: 'premium'; title: string; text: string }
  /** insults or pressure: only this, in red — one of the staff's words, chosen at random */
  /** `rule`: which of the staff's red replies the model matched (1, 2 …; 0 none) — the server's only */
  | { type: 'warning'; text: string; rule?: number }
  /** where her answer came from (internet sources she used; added by the server) */
  | { type: 'sources'; items: { title: string; url: string; site: string }[] }
  /** pictures of what she was asked about, from those sources (added by the server) */
  | { type: 'images'; items: { src: string; title: string; url: string }[] }

/** Whether a link she gives may be opened: a page of the app, a lesson or course of it, or an https address. */
export function linkAllowed(target: string): boolean {
  if (Object.hasOwn(ROUTES, target)) return true
  if (/^\/(lesson|course|school)\?(id|key)=[\w-]{1,80}$/.test(target)) return true
  try {
    return new URL(target).protocol === 'https:'
  } catch {
    return false
  }
}
