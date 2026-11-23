/** 3D art (see public/assets/3d/PROVENANCE.json): rendered with tools/render-assets, the schools' pictures made by the owner. CMS icons override these. */
export interface Art { src: string; w: number; h: number }

const a = (name: string, w: number, h: number): Art => ({ src: `/assets/3d/${name}.webp`, w, h })

export const SCHOOL_ART: Record<string, Art> = {
  'marifati-dini': a('school-religion', 413, 480),
  'odob-va-akhloq': a('school-ethics', 458, 387),
  'farhangi-tojik': a('school-culture', 342, 412),
  'oila-va-munosibatho': a('school-family', 480, 472),
  'ilm-va-salomati': a('school-health', 480, 369),
  'rushdi-shakhsiyat': a('school-growth', 414, 480),
  'zindagii-muosir': a('school-modern', 378, 326),
  // the boys' schools (until the panel gives them pictures of their own): navy, blue and gold
  'odobi-umumi': a('school-b-ethics', 480, 334),
  'pisar-dar-jamiyat': a('school-b-society', 480, 338),
  'khislathoi-mardona': a('school-b-character', 452, 480),
  'farhangi-tojik-pisaron': a('school-b-culture', 480, 492),
  'zamoni-muosir': a('school-b-modern', 465, 480),
  'odobi-oiladori': a('school-b-family', 480, 408),
  'sakhtihoi-hayot': a('school-b-hardship', 480, 451)
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
