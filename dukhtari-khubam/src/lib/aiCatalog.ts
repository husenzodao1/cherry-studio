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
export type AiBlock =
  | { type: 'text'; text: string }
  | { type: 'steps'; title: string; items: string[] }
  | { type: 'screen'; spot: SpotId; caption: string }
  | { type: 'link'; to: string; label: string }
  | { type: 'reminder'; at: string; title: string; text: string; daily?: boolean }
  /** a test in the chat: up to ten questions; the app checks the answers and sends her result to Mahliyo */
  | { type: 'quiz'; title: string; intro: string; questions: { question: string; options: string[]; answer: number; explanation: string }[] }
  /** the card that opens the Premium screen (a free learner asked for a Premium part) */
  | { type: 'premium'; title: string; text: string }
  /** insults or pressure: only this, shown in red; after three, the chat closes and she is signed out */
  | { type: 'warning' }
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
