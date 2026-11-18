// Ships the current published catalogue inside the APK (out/offline/bundle-<locale>.json), so the very
// first launch works without a connection. Skips quietly when the API cannot be reached.
import { mkdir, writeFile } from 'node:fs/promises'

const api = process.env.NEXT_PUBLIC_API_BASE ?? 'https://dukhtari-khubam.vercel.app'
await mkdir('out/offline', { recursive: true })
for (const locale of ['tg', 'ru', 'ar']) {
  try {
    const res = await fetch(`${api}/api/v1/bundle?locale=${locale}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(`out/offline/bundle-${locale}.json`, await res.text())
    console.log(`embedded bundle-${locale}.json`)
  } catch (e) {
    console.warn(`bundle-${locale} not embedded (${e.message}); the app will download it on first connection`)
  }
}
