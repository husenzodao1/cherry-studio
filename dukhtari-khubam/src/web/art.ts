/** Pre-rendered 3D art (see public/assets/3d/PROVENANCE.json). CMS icons override these. */
export interface Art { src: string; w: number; h: number }

const a = (name: string, w: number, h: number): Art => ({ src: `/assets/3d/${name}.webp`, w, h })

export const SCHOOL_ART: Record<string, Art> = {
  'marifati-dini': a('icon-religion', 401, 520),
  'odob-va-akhloq': a('icon-ethics', 520, 451),
  'farhangi-tojik': a('icon-culture', 376, 520),
  'oila-va-munosibatho': a('icon-family', 520, 434),
  'ilm-va-salomati': a('icon-health', 470, 520),
  'rushdi-shakhsiyat': a('icon-growth', 520, 457),
  'zindagii-muosir': a('icon-modern', 487, 520)
}

export const ART = {
  flowerBranch: a('flower-branch', 740, 900),
  flowerCluster: a('flower-cluster', 813, 900),
  diamonds: a('diamond-cluster', 900, 488),
  diamond: a('diamond-single', 418, 321)
}
