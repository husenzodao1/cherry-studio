/** Pre-rendered 3D art (tools/render-assets, see public/assets/3d/PROVENANCE.json). CMS icons override these. */
export interface Art { src: string; w: number; h: number }

const a = (name: string, w: number, h: number): Art => ({ src: `/assets/3d/${name}.webp`, w, h })

export const SCHOOL_ART: Record<string, Art> = {
  'marifati-dini': a('school-religion', 320, 295),
  'odob-va-akhloq': a('school-ethics', 300, 260),
  'farhangi-tojik': a('school-culture', 320, 223),
  'oila-va-munosibatho': a('school-family', 320, 279),
  'ilm-va-salomati': a('school-health', 300, 273),
  'rushdi-shakhsiyat': a('school-growth', 300, 279),
  'zindagii-muosir': a('school-modern', 280, 309)
}

/** Large scenes shown at the top of a school page (others show their icon on glass). */
export const SCHOOL_HERO: Record<string, Art> = {
  'marifati-dini': a('hero-religion', 720, 832)
}

export const ART = {
  flower: a('glass-flower', 640, 443),
  flowerSide: a('glass-flower-side', 520, 327),
  flowerOpen: a('glass-flower-open', 760, 725),
  lens: a('glass-lens', 300, 421),
  bubble: a('glass-bubble', 380, 381),
  book: a('book-open', 360, 252)
}
