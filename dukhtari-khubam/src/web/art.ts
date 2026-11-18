/** Pre-rendered 3D art (see public/assets/3d/PROVENANCE.json). CMS icons override these. */
export interface Art { src: string; w: number; h: number }

const a = (name: string, w: number, h: number): Art => ({ src: `/assets/3d/${name}.webp`, w, h })

export const SCHOOL_ART: Record<string, Art> = {
  'marifati-dini': a('icon-religion', 600, 510),
  'odob-va-akhloq': a('icon-ethics', 600, 523),
  'farhangi-tojik': a('icon-culture', 430, 600),
  'oila-va-munosibatho': a('icon-family', 592, 529),
  'ilm-va-salomati': a('icon-health', 600, 530),
  'rushdi-shakhsiyat': a('icon-growth', 600, 529),
  'zindagii-muosir': a('icon-modern', 554, 600)
}

export const ART = {
  lotus: a('flower-lotus', 700, 595),
  flowerCluster: a('flower-cluster', 1000, 660),
  rose: a('rose', 804, 728),
  diamonds: a('diamond-cluster', 900, 488),
  diamond: a('diamond-single', 418, 321)
}
