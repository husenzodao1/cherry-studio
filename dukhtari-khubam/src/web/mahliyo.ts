/**
 * Mahliyo's three clips (public/assets/mahliyo): transparent video (WebM, VP9 with alpha) with their own
 * sound, cut from green-screen films, and a still of each (the first frame; for "yes" the last one).
 * `w`/`h` is the clip's size, `cx` where she stands across it (0…1).
 */
export const CLIPS = {
  signin: { video: '/assets/mahliyo/signin.webm', still: '/assets/mahliyo/signin.webp', w: 640, h: 696, cx: 0.5 },
  intro: { video: '/assets/mahliyo/intro.webm', still: '/assets/mahliyo/intro.webp', w: 904, h: 696, cx: 0.47 },
  yes: { video: '/assets/mahliyo/yes.webm', still: '/assets/mahliyo/yes.webp', w: 904, h: 696, cx: 0.47 }
} as const

/**
 * Whether this browser draws the clear parts of such a video as clear. Safari (and every browser on
 * iPhone, all being Safari inside) draws them black, so there she is shown as a still picture; so she is
 * for those who asked their phone for less motion.
 */
export function alphaVideo(): boolean {
  if (typeof window === 'undefined') return false
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Android/.test(ua))) return false
  return !!document.createElement('video').canPlayType('video/webm; codecs="vp9"')
}

/**
 * Starts a clip with its sound. Where the browser allows no sound before the first tap (a website
 * opened fresh), it plays silent and its sound comes on with that first tap. The app always has sound.
 */
export function playWithSound(v: HTMLVideoElement): Promise<void> {
  v.muted = false
  return v.play().catch(() => {
    v.muted = true
    window.addEventListener('pointerdown', () => { v.muted = false }, { once: true, capture: true })
    return v.play().catch(() => undefined)
  })
}
