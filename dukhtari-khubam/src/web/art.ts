/** Pre-rendered 3D art (tools/render-assets, see public/assets/3d/PROVENANCE.json). CMS icons override these. */
export interface Art { src: string; w: number; h: number }

const a = (name: string, w: number, h: number): Art => ({ src: `/assets/3d/${name}.webp`, w, h })

export const SCHOOL_ART: Record<string, Art> = {
  'marifati-dini': a('school-religion', 380, 369),
  'odob-va-akhloq': a('school-ethics', 360, 293),
  'farhangi-tojik': a('school-culture', 360, 343),
  'oila-va-munosibatho': a('school-family', 360, 360),
  'ilm-va-salomati': a('school-health', 360, 360),
  'rushdi-shakhsiyat': a('school-growth', 360, 360),
  'zindagii-muosir': a('school-modern', 360, 274)
}

/** Large scenes shown at the top of a school page (others show their icon on glass). */
export const SCHOOL_HERO: Record<string, Art> = {
  'marifati-dini': a('hero-religion', 720, 832)
}

export const ART = {
  flower: a('glass-flower', 760, 489),
  flowerSide: a('glass-flower-side', 560, 300),
  flowerOpen: a('glass-flower-open', 760, 744),
  lotus: a('glass-lotus', 620, 510),
  tulip: a('glass-tulip', 440, 616),
  leaves: a('glass-leaves', 380, 488),
  crystals: a('glass-crystals', 380, 575),
  petals: a('glass-petals', 420, 232),
  lens: a('glass-lens', 300, 421),
  bubble: a('glass-bubble', 380, 381),
  book: a('book-open', 360, 252)
}
