/**
 * The styles of Mahliyo's presentations: a hundred, each with its own name, cover layout, pattern, font and
 * colours, and a genre that tells her how to write for it (an advert: bold short headlines; a lesson:
 * definitions and an example…). One drawing (coverShapes) serves the preview in the chat and the
 * PowerPoint file. A style is asked for in the question as "#s07"; the server puts it on the file.
 */

export type CoverLayout = 'left' | 'center' | 'bottom' | 'band' | 'split' | 'frame' | 'diagonal' | 'circle' | 'card' | 'underline' | 'corner' | 'stripe'
export type Motif = 'none' | 'circles' | 'dots' | 'grid' | 'stripes' | 'waves' | 'triangles' | 'rings' | 'blobs' | 'stars' | 'confetti' | 'lines' | 'leaves'
export type Genre = 'ad' | 'lesson' | 'science' | 'business' | 'minimal' | 'nature' | 'festive' | 'kids' | 'luxury' | 'tech' | 'culture' | 'health' | 'art' | 'motivation' | 'report'
export interface SlideStyle { id: string; name: string; genre: Genre; layout: CoverLayout; motif: Motif; font: string; bg: string; fg: string; accent: string }

/** How she writes for each genre (told to the model with the style). */
export const GENRE_VOICE: Record<Genre, string> = {
  ad: 'ADVERTISING: bold, benefit-led headlines of 3–6 words, short punchy points with numbers and facts, one big idea per slide, a strong call to action on the last slide; energetic.',
  lesson: 'SCHOOL LESSON: clear explanations in simple words, a definition, one example for every idea, a "check yourself" slide with 2–3 questions; friendly and patient.',
  science: 'SCIENTIFIC: precise terms, laws and formulas in Unicode, data and numbers, cause and effect, an experiment or observation, a slide of real, well-known sources.',
  business: 'BUSINESS: problem → solution → numbers (a table), market, plan, expected results; concise, confident, no filler.',
  minimal: 'MINIMAL: very few words — one idea per slide, at most 3 short points of a few words, calm and spacious; a strong single sentence is better than a list.',
  nature: 'NATURE AND SEASONS: warm, vivid, sensory language, real facts about nature, gentle rhythm.',
  festive: 'FESTIVE: joyful and warm, traditions and their meaning, good wishes, short poetic lines.',
  kids: 'FOR CHILDREN: very simple words, short sentences, playful, a few emoji, a small question or game on a slide.',
  luxury: 'ELEGANT AND CLASSIC: refined vocabulary, calm rhythm, one real quotation of a great person (never invented).',
  tech: 'TECHNOLOGY: modern and precise, how it works step by step, real examples of products, a slide about the future.',
  culture: 'CULTURE, HISTORY, LITERATURE: storytelling, a timeline table of dates, key people, one real quotation, why it matters today.',
  health: 'HEALTH: careful, checked facts, practical habits, do and do not, a note on when to see a doctor; never diagnoses or doses.',
  art: 'CREATIVE: expressive and inspiring, techniques with examples, an invitation to try it herself.',
  motivation: 'MOTIVATIONAL: inspiring and personal, a short real story, clear steps, a powerful final message.',
  report: 'REPORT OR PROJECT: goal, method, results in a table, conclusions, next steps; formal and exact.'
}

// name | genre | cover | pattern | font | background | text | accent
const RAW = `Рекламавӣ|ad|left|confetti|Unbounded|#ff3d6e|#ffffff|#ffd23f
Дарсӣ|lesson|underline|dots|Nunito|#f4f1ff|#2e1f66|#6b47e8
Илмӣ|science|left|grid|IBM Plex Sans|#0f2a4a|#ffffff|#38bdf8
Тиҷоратӣ|business|band|lines|Montserrat|#0b3d91|#ffffff|#f5a623
Минимал|minimal|bottom|none|Inter|#ffffff|#111111|#111111
Баҳорӣ|nature|card|leaves|Lora|#9be3b9|#0b3b24|#2f9e62
Тобистонӣ|nature|corner|waves|Rubik|#ffb347|#3b1d00|#ff6b6b
Тирамоҳӣ|nature|diagonal|leaves|Vollkorn|#b5562c|#fff4e6|#f2c14e
Зимистонӣ|nature|center|stars|Cormorant Garamond|#dbeafe|#0b2a55|#3b82f6
Шабона|minimal|center|stars|Philosopher|#0b0f2e|#e0e7ff|#818cf8
Кайҳонӣ|science|circle|stars|Tektur|#050816|#ffffff|#a78bfa
Уқёнус|nature|bottom|waves|Raleway|#0369a1|#ffffff|#67e8f9
Ҷангал|nature|band|leaves|Merriweather|#14532d|#ffffff|#86efac
Биёбон|nature|corner|triangles|Forum|#f4d6a0|#4a2c0a|#c2410c
Кӯҳсор|nature|bottom|triangles|Oswald|#334155|#ffffff|#94a3b8
Гулобӣ|festive|card|blobs|Pacifico|#ffd1dc|#6b0f2a|#ff5c8a
Лавандӣ|art|circle|blobs|Comfortaa|#e9e2ff|#3b2a7a|#8b6cf0
Қанди пашмак|kids|center|confetti|Montserrat Alternates|#ff9ecd|#ffffff|#7dd3fc
Пастелӣ|art|frame|dots|Alice|#fdf2f8|#4a2040|#f472b6
Неон|tech|left|lines|Press Start 2P|#0a0a0a|#39ff14|#ff00e6
Ретро|art|stripe|stripes|Kurale|#f4e4c1|#3d2c1e|#e07a5f
Винтаж|culture|frame|none|Old Standard TT|#efe6d5|#4b3621|#8c6d46
Классикӣ|luxury|frame|lines|EB Garamond|#1f2a44|#f5e6c8|#c9a227
Шоҳона|luxury|center|rings|Yeseva One|#3b0a45|#f7e7b4|#d4af37
Тиллоӣ|luxury|underline|lines|Prata|#111111|#f5d27a|#d4af37
Нуқрагин|business|split|grid|Manrope|#e5e7eb|#1f2937|#6b7280
Корпоративӣ|business|split|lines|Open Sans|#1e3a8a|#ffffff|#60a5fa
Стартап|ad|diagonal|circles|Geologica|#6d28d9|#ffffff|#22d3ee
Технологӣ|tech|left|grid|Exo 2|#0f172a|#e2e8f0|#22d3ee
Рақамӣ|tech|card|dots|Play|#111827|#a7f3d0|#10b981
Барномасозӣ|tech|underline|grid|Fira Sans|#1e1e2e|#cdd6f4|#89b4fa
Тиббӣ|health|band|rings|PT Sans|#e0f2fe|#0c4a6e|#0ea5e9
Саломатӣ|health|corner|circles|Sofia Sans|#dcfce7|#14532d|#22c55e
Варзишӣ|motivation|diagonal|stripes|Oswald|#dc2626|#ffffff|#fde047
Мусиқӣ|art|circle|waves|Lobster|#1a1033|#ffffff|#f472b6
Санъат|art|card|confetti|Caveat|#fff7ed|#7c2d12|#f97316
Адабӣ|culture|underline|none|Literata|#f5f0e6|#3f2d20|#9a3412
Таърихӣ|culture|frame|rings|Spectral|#e8dcc2|#3b2f1e|#7c5c2b
Ҷуғрофӣ|science|split|triangles|Golos Text|#065f46|#ffffff|#fbbf24
Математикӣ|lesson|left|grid|Commissioner|#f8fafc|#0f172a|#2563eb
Физикӣ|science|corner|rings|Onest|#0b1026|#e0e7ff|#60a5fa
Химиявӣ|science|center|circles|Ubuntu|#ecfeff|#134e4a|#14b8a6
Биологӣ|lesson|band|leaves|Noto Serif|#ecfccb|#365314|#65a30d
Экологӣ|nature|circle|leaves|Arsenal|#d9f99d|#1a2e05|#4d7c0f
Астрономӣ|science|bottom|stars|Unbounded|#000814|#ffd60a|#ffc300
Миллӣ|culture|stripe|none|PT Serif|#c8102e|#ffffff|#00843d
Атласӣ|culture|diagonal|stripes|Philosopher|#7b1fa2|#ffffff|#ffca28
Сӯзанӣ|culture|frame|blobs|Kurale|#fff8e7|#7f1d1d|#b91c1c
Наврӯзӣ|festive|card|leaves|Bad Script|#fef3c7|#14532d|#16a34a
Идона|festive|center|stars|Prata|#064e3b|#fef3c7|#fbbf24
Тӯёна|festive|circle|rings|Cormorant Infant|#fff1f2|#881337|#e11d48
Зодрӯз|festive|left|confetti|Pacifico|#fde68a|#7c2d12|#ec4899
Кӯдакона|kids|corner|blobs|Comfortaa|#fef9c3|#1e3a8a|#f97316
Мактабӣ|lesson|stripe|dots|Rubik|#fef3c7|#1f2937|#2563eb
Донишгоҳӣ|lesson|split|none|Source Serif 4|#172554|#ffffff|#fbbf24
Хатмкунӣ|festive|frame|stars|Yeseva One|#111827|#ffffff|#d4af37
Лоиҳа|report|underline|triangles|Manrope|#f1f5f9|#0f172a|#7c3aed
Ҳисобот|report|split|grid|IBM Plex Sans|#ffffff|#1f2937|#059669
Молиявӣ|business|band|dots|Inter|#052e16|#ecfdf5|#10b981
Маркетинг|ad|corner|confetti|Montserrat|#f43f5e|#ffffff|#fde047
Фурӯш|ad|stripe|circles|Exo 2|#ea580c|#ffffff|#fff7ed
Брендинг|minimal|bottom|lines|Unbounded|#000000|#ffffff|#ff3d00
Портфолио|art|left|none|Raleway|#fafafa|#111111|#e11d48
Резюме|report|band|none|Open Sans|#ffffff|#1e293b|#0ea5e9
Мусоҳиба|report|center|lines|Golos Text|#f8fafc|#0f172a|#6366f1
Тренинг|motivation|diagonal|triangles|Nunito|#fff7ed|#431407|#ea580c
Семинар|lesson|frame|grid|PT Sans|#eef2ff|#1e1b4b|#4f46e5
Конфронс|business|bottom|circles|Geologica|#0f172a|#ffffff|#f43f5e
Вебинар|tech|circle|dots|Onest|#1e1b4b|#ffffff|#a855f7
Инфографика|report|corner|grid|Fira Sans|#ffffff|#111827|#f59e0b
Ҷадвалӣ|report|stripe|grid|Sofia Sans|#f9fafb|#111827|#10b981
Ҳикоявӣ|culture|card|waves|Lora|#fdf6ec|#3f2a14|#d97706
Илҳомбахш|motivation|center|rings|Forum|#312e81|#ffffff|#fbbf24
Ангезанда|motivation|left|stripes|Oswald|#f97316|#ffffff|#1f2937
Оромбахш|health|bottom|waves|Comfortaa|#e0f2f1|#134e4a|#14b8a6
Нафис|luxury|underline|none|Cormorant Garamond|#1c1917|#fafaf9|#d6d3d1
Латиф|luxury|card|rings|Alice|#faf5ff|#3b0764|#a855f7
Сода|minimal|left|none|Manrope|#ffffff|#18181b|#71717a
Ҷасур|ad|diagonal|none|Unbounded|#000000|#ffffff|#facc15
Рангин|kids|card|confetti|Rubik|#ffffff|#111827|#ef4444
Ғурубӣ|nature|bottom|circles|Spectral|#ff7e5f|#ffffff|#ffe0b2
Субҳдам|nature|circle|waves|Literata|#ffecd2|#5b2a1a|#fc8181
Абрӣ|minimal|corner|blobs|Raleway|#e0e7ff|#1e293b|#64748b
Шукуфаи бодом|festive|frame|leaves|Bad Script|#fff0f5|#6b2140|#f472b6
Анорӣ|culture|corner|circles|Vollkorn|#7f1d1d|#fff1f2|#fb7185
Зардолуӣ|kids|stripe|blobs|Nunito|#ffedd5|#7c2d12|#fb923c
Қаҳваранг|culture|band|stripes|Merriweather|#3e2723|#efebe9|#bcaaa4
Мармарӣ|luxury|center|lines|Old Standard TT|#f5f5f4|#292524|#78716c
Шишагин|tech|card|circles|Play|#e0f7ff|#0c4a6e|#0284c7
Кристаллӣ|tech|diagonal|triangles|Tektur|#eef2ff|#312e81|#6366f1
Абрешимӣ|art|underline|waves|Lobster|#fdf4ff|#701a75|#d946ef
Ҷавоҳирӣ|luxury|circle|triangles|EB Garamond|#042f2e|#ccfbf1|#2dd4bf
Ёқутӣ|luxury|split|rings|Prata|#4c0519|#ffe4e6|#f43f5e
Зумуррадӣ|business|underline|circles|Source Serif 4|#064e3b|#ecfdf5|#34d399
Фирӯзаӣ|nature|stripe|waves|Ubuntu|#0e7490|#ffffff|#a5f3fc
Ҳамвор|minimal|split|dots|Inter|#f1f5f9|#0f172a|#3b82f6
Геометрӣ|art|left|triangles|Montserrat Alternates|#fefce8|#1c1917|#0d9488
Мавҷӣ|motivation|band|waves|Exo 2|#1e40af|#ffffff|#93c5fd
Хаттотӣ|culture|center|leaves|Caveat|#fffbeb|#292524|#b45309
Маҷаллавӣ|minimal|stripe|lines|Noto Serif|#ffffff|#0a0a0a|#dc2626`

export const SLIDE_STYLES: SlideStyle[] = RAW.split('\n').map((line, i) => {
  const [name, genre, layout, motif, font, bg, fg, accent] = line.split('|')
  return { id: `s${String(i + 1).padStart(2, '0')}`, name, genre: genre as Genre, layout: layout as CoverLayout, motif: motif as Motif, font, bg, fg, accent }
})

/** every font of the styles (all have every Tajik letter) */
export const SLIDE_FONTS = [...new Set(SLIDE_STYLES.map((s) => s.font))]
/** the fonts that are only for titles: the inner slides' points are in a calm sans */
const DISPLAY = new Set(['Unbounded', 'Press Start 2P', 'Pacifico', 'Lobster', 'Caveat', 'Bad Script', 'Yeseva One', 'Tektur', 'Montserrat Alternates', 'Comfortaa', 'Prata', 'Forum', 'Kurale', 'Philosopher'])
/** the font of the inner slides' points */
export const bodyFont = (s: SlideStyle) => (DISPLAY.has(s.font) ? 'Roboto' : s.font)

export const slideStyle = (id: string | undefined) => SLIDE_STYLES.find((s) => s.id === id) ?? SLIDE_STYLES[1]

/** how light a colour is (0 black … 1 white) */
export function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const contrast = (a: string, b: string) => { const [x, y] = [lightness(a), lightness(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
/** the one of these colours that reads best on `on` */
const readable = (on: string, ...colours: string[]) => colours.find((c) => contrast(c, on) >= 3) ?? (lightness(on) > 0.4 ? '#111111' : '#ffffff')

/** The inner slides' colours: dark styles stay dark; light ones on white; the title in the accent when it reads well. */
export function innerColours(s: SlideStyle): { paper: string; ink: string; title: string; mark: string } {
  const dark = lightness(s.bg) < 0.1
  const paper = dark ? s.bg : '#ffffff'
  const ink = dark ? s.fg : '#2a1d4a'
  const title = readable(paper, s.accent, s.bg, ink)
  const mark = contrast(s.bg, paper) >= 1.5 ? s.bg : s.accent
  return { paper, ink, title, mark }
}

/** The style a question asks for ("#s07"), if any. */
export const styleIn = (question: string) => /#(s\d{2,3})\b/.exec(question)?.[1]

/** What the model is told about the style: its look and how to write for it. */
export const styleNote = (s: SlideStyle) =>
  `PRESENTATION STYLE «${s.name}» (${s.genre}; ${s.layout} cover with a ${s.motif} pattern, the font ${s.font}). WRITE FOR IT — ${GENRE_VOICE[s.genre]}`

/* ---- the drawing: the cover and the inner slides' corner, in a 160 × 90 box (16:9) ---- */

/** a colour of the style: its background, text, accent, the inner page, or a fixed one */
export type Paint = 'bg' | 'fg' | 'ac' | 'paper' | 'ink' | `#${string}`
/** `ring`: a round outline, `box`: a straight one (`line` thick) */
export interface Shape { k: 'rect' | 'ellipse' | 'ring' | 'box' | 'tri' | 'rtri'; x: number; y: number; w: number; h: number; c: Paint; o?: number; r?: number; flip?: boolean; line?: number }
export interface TextBox { x: number; y: number; w: number; h: number; align: 'left' | 'center'; valign: 'top' | 'middle' | 'bottom'; c: Paint; size: number; sub: Paint }
export interface Cover { back: Paint; shapes: Shape[]; title: TextBox }

/** a small seeded random (the same style always draws the same) */
function rand(seed: number) {
  let s = seed * 9301 + 49297
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

/** The pattern's shapes in an area. */
export function motifShapes(m: Motif, area: { x: number; y: number; w: number; h: number }, seed: number, c: Paint = 'ac'): Shape[] {
  const r = rand(seed)
  const { x, y, w, h } = area
  const out: Shape[] = []
  const at = () => ({ px: x + r() * w, py: y + r() * h })
  switch (m) {
    case 'none': break
    case 'circles':
      out.push({ k: 'ellipse', x: x + w * 0.35, y: y + h * 0.1, w: w * 0.75, h: w * 0.75, c, o: 0.45 }, { k: 'ellipse', x: x + w * 0.1, y: y + h * 0.55, w: w * 0.35, h: w * 0.35, c, o: 0.25 })
      break
    case 'rings':
      for (let i = 0; i < 3; i++) out.push({ k: 'ring', x: x + w * (0.25 + i * 0.12), y: y + h * (0.15 + i * 0.1), w: w * (0.6 - i * 0.12), h: w * (0.6 - i * 0.12), c, o: 0.7 - i * 0.15, line: 0.6 })
      break
    case 'dots':
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) out.push({ k: 'ellipse', x: x + w * 0.2 + i * Math.min(w, h) * 0.13, y: y + h * 0.2 + j * Math.min(w, h) * 0.13, w: 1.4, h: 1.4, c, o: 0.35 + 0.1 * ((i + j) % 4) })
      break
    case 'grid':
      for (let i = 0; i <= 5; i++) out.push({ k: 'rect', x: x + (w * i) / 5, y, w: 0.25, h, c, o: 0.22 }, { k: 'rect', x, y: y + (h * i) / 5, w, h: 0.25, c, o: 0.22 })
      out.push({ k: 'rect', x: x + w * 0.4, y: y + h * 0.4, w: w / 5, h: h / 5, c, o: 0.5 })
      break
    case 'stripes':
      for (let i = 0; i < 4; i++) out.push({ k: 'rect', x: x + w * 0.15 + i * w * 0.2, y: y - h * 0.2, w: w * 0.08, h: h * 1.4, c, o: 0.55 - i * 0.1, r: 30 })
      break
    case 'waves':
      for (let i = 0; i < 3; i++) out.push({ k: 'ellipse', x: x - w * 0.2 + i * w * 0.45, y: y + h * (0.55 + (i % 2) * 0.12), w: w * 0.7, h: h * 0.8, c, o: 0.25 + i * 0.12 })
      break
    case 'triangles':
      for (let i = 0; i < 4; i++) { const p = at(); const s = 6 + r() * 14; out.push({ k: 'tri', x: p.px, y: p.py, w: s, h: s * 0.9, c, o: 0.35 + r() * 0.45, r: Math.round(r() * 60 - 30) }) }
      break
    case 'blobs':
      out.push({ k: 'ellipse', x: x + w * 0.3, y: y + h * 0.05, w: w * 0.7, h: h * 0.6, c, o: 0.4 }, { k: 'ellipse', x: x + w * 0.05, y: y + h * 0.45, w: w * 0.5, h: h * 0.5, c, o: 0.3 }, { k: 'ellipse', x: x + w * 0.55, y: y + h * 0.55, w: w * 0.3, h: h * 0.35, c: 'fg', o: 0.15 })
      break
    case 'stars':
      for (let i = 0; i < 9; i++) { const p = at(); const s = 0.8 + r() * (i < 2 ? 4 : 1.6); out.push({ k: 'rect', x: p.px, y: p.py, w: s, h: s, c: i % 3 ? c : 'fg', o: 0.5 + r() * 0.5, r: 45 }) }
      break
    case 'confetti':
      for (let i = 0; i < 14; i++) { const p = at(); out.push({ k: i % 3 ? 'rect' : 'ellipse', x: p.px, y: p.py, w: 1.6 + r() * 2.4, h: i % 3 ? 0.9 + r() * 0.8 : 1.8, c: i % 2 ? c : 'fg', o: 0.75, r: Math.round(r() * 180) }) }
      break
    case 'lines':
      for (let i = 0; i < 6; i++) out.push({ k: 'rect', x: x + w * 0.2, y: y + h * (0.2 + i * 0.12), w: w * (0.3 + ((i * 37) % 50) / 100), h: 0.5, c, o: 0.5 })
      break
    case 'leaves':
      for (let i = 0; i < 6; i++) { const p = at(); const s = 5 + r() * 9; out.push({ k: 'ellipse', x: p.px, y: p.py, w: s, h: s * 0.38, c, o: 0.45 + r() * 0.4, r: Math.round(r() * 120 - 60) }) }
      break
  }
  return out
}

/** The cover of a style: its background, its shapes and where the title goes. */
export function coverShapes(s: SlideStyle): Cover {
  const n = parseInt(s.id.slice(1), 10)
  const light = lightness(s.bg) > 0.5
  const paper: Paint = light ? '#111111' : '#ffffff'
  const T = (x: number, y: number, w: number, h: number, align: TextBox['align'], valign: TextBox['valign'], size = 8.5, c: Paint = 'fg'): TextBox => ({ x, y, w, h, align, valign, c, size, sub: c })
  const m = (area: { x: number; y: number; w: number; h: number }, c?: Paint) => motifShapes(s.motif, area, n, c)
  switch (s.layout) {
    case 'left':
      return { back: 'bg', shapes: m({ x: 102, y: 4, w: 54, h: 82 }), title: T(12, 22, 92, 46, 'left', 'middle') }
    case 'center':
      return { back: 'bg', shapes: [...m({ x: 0, y: 0, w: 42, h: 34 }), ...m({ x: 118, y: 56, w: 42, h: 34 })], title: T(22, 22, 116, 46, 'center', 'middle') }
    case 'bottom':
      return { back: 'bg', shapes: m({ x: 20, y: 2, w: 136, h: 40 }), title: T(12, 46, 128, 34, 'left', 'bottom', 9.5) }
    case 'band':
      return { back: 'bg', shapes: [{ k: 'rect', x: 0, y: 0, w: 50, h: 90, c: 'ac' }, ...m({ x: 2, y: 4, w: 46, h: 82 }, 'fg')], title: T(60, 20, 92, 50, 'left', 'middle') }
    case 'split':
      return { back: paper, shapes: [{ k: 'rect', x: 0, y: 0, w: 160, h: 58, c: 'bg' }, { k: 'rect', x: 0, y: 58, w: 160, h: 2, c: 'ac' }, ...m({ x: 112, y: 64, w: 44, h: 24 })], title: { ...T(12, 10, 136, 44, 'left', 'bottom'), sub: light ? '#ffffff' : '#334155' } }
    case 'frame':
      return { back: 'bg', shapes: [{ k: 'box', x: 6, y: 6, w: 148, h: 78, c: 'ac', line: 1.1 }, { k: 'box', x: 9, y: 9, w: 142, h: 72, c: 'ac', line: 0.35 }, ...m({ x: 12, y: 12, w: 26, h: 22 }), ...m({ x: 122, y: 56, w: 26, h: 22 })], title: T(24, 24, 112, 42, 'center', 'middle', 8) }
    case 'diagonal':
      return { back: 'bg', shapes: [{ k: 'rtri', x: 70, y: 0, w: 90, h: 90, c: 'ac', flip: true }, ...m({ x: 108, y: 30, w: 50, h: 56 }, 'fg')], title: T(12, 20, 90, 50, 'left', 'middle') }
    case 'circle':
      return { back: 'bg', shapes: [...m({ x: 0, y: 0, w: 160, h: 90 }), { k: 'ellipse', x: 37, y: 2, w: 86, h: 86, c: 'ac' }], title: { ...T(44, 20, 72, 50, 'center', 'middle', 7.5, readable(s.accent, s.fg, s.bg) as Paint) } }
    case 'card':
      return { back: 'bg', shapes: [...m({ x: 0, y: 0, w: 160, h: 90 }), { k: 'rect', x: 20, y: 20, w: 120, h: 50, c: light ? '#ffffff' : '#000000', o: light ? 0.92 : 0.55 }], title: T(28, 24, 104, 42, 'center', 'middle', 8, light ? readable('#ffffff', s.fg, '#111111') as Paint : 'fg') }
    case 'underline':
      return { back: 'bg', shapes: [{ k: 'rect', x: 12, y: 60, w: 34, h: 2.2, c: 'ac' }, ...m({ x: 108, y: 48, w: 48, h: 38 })], title: T(12, 14, 120, 44, 'left', 'bottom') }
    case 'corner':
      return { back: 'bg', shapes: [{ k: 'ellipse', x: 96, y: 34, w: 96, h: 96, c: 'ac' }, ...m({ x: 106, y: 46, w: 46, h: 40 }, 'fg')], title: T(12, 12, 92, 48, 'left', 'top') }
    case 'stripe':
      return { back: 'bg', shapes: [{ k: 'rect', x: 0, y: 0, w: 160, h: 9, c: 'ac' }, { k: 'rect', x: 0, y: 86, w: 160, h: 4, c: 'fg', o: 0.85 }, ...m({ x: 110, y: 16, w: 46, h: 64 })], title: T(12, 22, 98, 50, 'left', 'middle') }
  }
}

/** The inner slides' corner: a small piece of the cover's pattern (or a soft circle). */
export function innerShapes(s: SlideStyle): Shape[] {
  const n = parseInt(s.id.slice(1), 10)
  const own = motifShapes(s.motif, { x: 132, y: 2, w: 26, h: 20 }, n)
  return own.length ? own.map((x) => ({ ...x, o: (x.o ?? 1) * 0.6 })) : [{ k: 'ellipse', x: 138, y: -8, w: 30, h: 30, c: 'ac', o: 0.15 }]
}

/** How the inner slides hold their title: a bar on the left, a band on top, a line under it, or centred. */
export function innerHeader(s: SlideStyle): 'bar' | 'top' | 'under' | 'center' {
  if (s.layout === 'left' || s.layout === 'band' || s.layout === 'diagonal') return 'bar'
  if (s.layout === 'split' || s.layout === 'stripe') return 'top'
  if (s.layout === 'underline' || s.layout === 'bottom' || s.layout === 'corner') return 'under'
  return 'center'
}

/** A paint as a colour of this style. */
export function paint(p: Paint, s: SlideStyle): string {
  if (p.startsWith('#')) return p
  const c = innerColours(s)
  return { bg: s.bg, fg: s.fg, ac: s.accent, paper: c.paper, ink: c.ink }[p as 'bg' | 'fg' | 'ac' | 'paper' | 'ink']
}

/** The Google Fonts address that loads every style's font (for the previews). */
export const FONTS_URL = `https://fonts.googleapis.com/css2?${SLIDE_FONTS.map((f) => `family=${f.replace(/ /g, '+')}${DISPLAY.has(f) && !['Unbounded', 'Tektur', 'Montserrat Alternates', 'Comfortaa', 'Philosopher', 'Caveat', 'Kurale'].includes(f) ? '' : ':wght@700'}`).join('&')}&display=swap`
