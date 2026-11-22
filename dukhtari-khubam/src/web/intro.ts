/**
 * The entrance played once each time the app is opened (after the PIN, when there is one): the boxes
 * and the tab bar come first, then the flowers, then the small things (search, menu, avatar…), each in
 * its own way. It is a class on <html> for a few seconds; globals.css holds the choreography.
 */
const MS = 3400
let played = false

export function playIntro(again = false) {
  if ((played && !again) || typeof document === 'undefined') return
  played = true
  const root = document.documentElement
  root.classList.add('intro')
  window.dispatchEvent(new Event('dk-intro'))
  setTimeout(() => root.classList.remove('intro'), MS)
}

/** True once the entrance has started (the school row waits for it before its little tour). */
export const introPlayed = () => played
