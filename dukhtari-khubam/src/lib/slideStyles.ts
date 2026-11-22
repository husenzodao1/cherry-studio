/**
 * The styles of Mahliyo's presentations: a hundred, each with a short name, a cover layout and its colours.
 * The same style draws the cover's preview in the chat and the PowerPoint file. A style is asked for in the
 * question as "#s07"; the server puts it on the file.
 */

export type CoverLayout = 'circles' | 'band' | 'split' | 'frame' | 'bar' | 'dots' | 'minimal'
export interface SlideStyle { id: string; name: string; layout: CoverLayout; bg: string; fg: string; accent: string }

// name | cover layout | background | text | accent
const RAW = `Рекламавӣ|circles|#ff3d6e|#ffffff|#ffd23f
Дарсӣ|band|#5b3fd6|#ffffff|#8b6cf0
Илмӣ|dots|#0f2a4a|#ffffff|#38bdf8
Тиҷоратӣ|bar|#0b3d91|#ffffff|#f5a623
Минимал|minimal|#ffffff|#111111|#111111
Баҳорӣ|circles|#7ed6a5|#0b3b24|#ffffff
Тобистонӣ|split|#ffb347|#3b1d00|#ff6b6b
Тирамоҳӣ|band|#b5562c|#ffffff|#f2c14e
Зимистонӣ|frame|#dbeafe|#0b2a55|#3b82f6
Шабона|circles|#0b0f2e|#e0e7ff|#818cf8
Кайҳонӣ|dots|#050816|#ffffff|#a78bfa
Уқёнус|split|#0369a1|#ffffff|#67e8f9
Ҷангал|band|#14532d|#ffffff|#86efac
Биёбон|frame|#f4d6a0|#4a2c0a|#c2410c
Кӯҳсор|split|#334155|#ffffff|#94a3b8
Гулобӣ|circles|#ffd1dc|#6b0f2a|#ff5c8a
Лавандӣ|circles|#e9e2ff|#3b2a7a|#8b6cf0
Қанди пашмак|dots|#ff9ecd|#ffffff|#7dd3fc
Пастелӣ|frame|#fdf2f8|#4a2040|#f9a8d4
Неон|dots|#0a0a0a|#39ff14|#ff00e6
Ретро|band|#f4e4c1|#3d2c1e|#e07a5f
Винтаж|frame|#efe6d5|#4b3621|#8c6d46
Классикӣ|frame|#1f2a44|#f5e6c8|#c9a227
Шоҳона|frame|#3b0a45|#f7e7b4|#d4af37
Тиллоӣ|bar|#111111|#f5d27a|#d4af37
Нуқрагин|bar|#e5e7eb|#1f2937|#6b7280
Корпоративӣ|band|#1e3a8a|#ffffff|#60a5fa
Стартап|split|#6d28d9|#ffffff|#22d3ee
Технологӣ|dots|#0f172a|#e2e8f0|#22d3ee
Рақамӣ|dots|#111827|#a7f3d0|#10b981
Барномасозӣ|bar|#1e1e2e|#cdd6f4|#89b4fa
Тиббӣ|band|#e0f2fe|#0c4a6e|#0ea5e9
Саломатӣ|circles|#dcfce7|#14532d|#22c55e
Варзишӣ|split|#dc2626|#ffffff|#fde047
Мусиқӣ|circles|#1a1033|#ffffff|#f472b6
Санъат|dots|#fff7ed|#7c2d12|#f97316
Адабӣ|frame|#f5f0e6|#3f2d20|#9a3412
Таърихӣ|frame|#e8dcc2|#3b2f1e|#7c5c2b
Ҷуғрофӣ|split|#065f46|#ffffff|#fbbf24
Математикӣ|bar|#f8fafc|#0f172a|#2563eb
Физикӣ|dots|#0b1026|#e0e7ff|#60a5fa
Химиявӣ|circles|#ecfeff|#134e4a|#14b8a6
Биологӣ|band|#ecfccb|#365314|#65a30d
Экологӣ|circles|#d9f99d|#1a2e05|#4d7c0f
Астрономӣ|dots|#000814|#ffd60a|#ffc300
Миллӣ|band|#c8102e|#ffffff|#00843d
Атласӣ|split|#7b1fa2|#ffffff|#ffca28
Сӯзанӣ|frame|#fff8e7|#7f1d1d|#b91c1c
Наврӯзӣ|circles|#fef3c7|#14532d|#16a34a
Идона|circles|#064e3b|#fef3c7|#fbbf24
Тӯёна|circles|#fff1f2|#881337|#e11d48
Зодрӯз|dots|#fde68a|#7c2d12|#ec4899
Кӯдакона|dots|#fef9c3|#1e3a8a|#f97316
Мактабӣ|band|#fef3c7|#1f2937|#2563eb
Донишгоҳӣ|bar|#172554|#ffffff|#fbbf24
Хатмкунӣ|frame|#111827|#ffffff|#d4af37
Лоиҳа|bar|#f1f5f9|#0f172a|#7c3aed
Ҳисобот|bar|#ffffff|#1f2937|#059669
Молиявӣ|band|#052e16|#ecfdf5|#10b981
Маркетинг|split|#f43f5e|#ffffff|#fde047
Фурӯш|circles|#ea580c|#ffffff|#fff7ed
Брендинг|minimal|#000000|#ffffff|#ff3d00
Портфолио|minimal|#fafafa|#111111|#e11d48
Резюме|minimal|#ffffff|#1e293b|#0ea5e9
Мусоҳиба|bar|#f8fafc|#0f172a|#6366f1
Тренинг|band|#fff7ed|#431407|#ea580c
Семинар|frame|#eef2ff|#1e1b4b|#4f46e5
Конфронс|split|#0f172a|#ffffff|#f43f5e
Вебинар|dots|#1e1b4b|#ffffff|#a855f7
Инфографика|bar|#ffffff|#111827|#f59e0b
Ҷадвалӣ|minimal|#f9fafb|#111827|#10b981
Ҳикоявӣ|circles|#fdf6ec|#3f2a14|#d97706
Илҳомбахш|circles|#312e81|#ffffff|#fbbf24
Ангезанда|split|#f97316|#ffffff|#1f2937
Оромбахш|circles|#e0f2f1|#134e4a|#14b8a6
Нафис|frame|#1c1917|#fafaf9|#d6d3d1
Латиф|frame|#faf5ff|#3b0764|#a855f7
Сода|minimal|#ffffff|#18181b|#71717a
Ҷасур|split|#000000|#ffffff|#facc15
Рангин|dots|#ffffff|#111827|#ef4444
Ғурубӣ|split|#ff7e5f|#ffffff|#ffe0b2
Субҳдам|circles|#ffecd2|#5b2a1a|#fc8181
Абрӣ|circles|#e0e7ff|#1e293b|#64748b
Шукуфаи бодом|circles|#fff0f5|#6b2140|#f472b6
Анорӣ|circles|#7f1d1d|#fff1f2|#fb7185
Зардолуӣ|circles|#ffedd5|#7c2d12|#fb923c
Қаҳваранг|band|#3e2723|#efebe9|#bcaaa4
Мармарӣ|frame|#f5f5f4|#292524|#78716c
Шишагин|circles|#e0f7ff|#0c4a6e|#0284c7
Кристаллӣ|dots|#eef2ff|#312e81|#6366f1
Абрешимӣ|split|#fdf4ff|#701a75|#d946ef
Ҷавоҳирӣ|frame|#042f2e|#ccfbf1|#2dd4bf
Ёқутӣ|frame|#4c0519|#ffe4e6|#f43f5e
Зумуррадӣ|band|#064e3b|#ecfdf5|#34d399
Фирӯзаӣ|circles|#0e7490|#ffffff|#a5f3fc
Ҳамвор|minimal|#f1f5f9|#0f172a|#3b82f6
Геометрӣ|dots|#fefce8|#1c1917|#0d9488
Мавҷӣ|split|#1e40af|#ffffff|#93c5fd
Хаттотӣ|frame|#fffbeb|#292524|#b45309
Маҷаллавӣ|minimal|#ffffff|#0a0a0a|#dc2626`

export const SLIDE_STYLES: SlideStyle[] = RAW.split('\n').map((line, i) => {
  const [name, layout, bg, fg, accent] = line.split('|')
  return { id: `s${String(i + 1).padStart(2, '0')}`, name, layout: layout as CoverLayout, bg, fg, accent }
})

export const slideStyle = (id: string | undefined) => SLIDE_STYLES.find((s) => s.id === id) ?? SLIDE_STYLES[1]

/** how light a colour is (0 black … 1 white) */
export function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const contrast = (a: string, b: string) => { const [x, y] = [lightness(a), lightness(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** The inner slides' colours: dark styles stay dark; light ones on white; the title in the accent when it reads well. */
export function innerColours(s: SlideStyle): { paper: string; ink: string; title: string; mark: string } {
  const dark = lightness(s.bg) < 0.18
  const paper = dark ? s.bg : '#ffffff'
  const ink = dark ? s.fg : '#2a1d4a'
  const title = [s.accent, s.bg, ink].find((c) => contrast(c, paper) >= 3) ?? ink
  const mark = contrast(s.bg, paper) >= 1.5 ? s.bg : s.accent
  return { paper, ink, title, mark }
}

/** The style a question asks for ("#s07"), if any. */
export const styleIn = (question: string) => /#(s\d{2,3})\b/.exec(question)?.[1]
