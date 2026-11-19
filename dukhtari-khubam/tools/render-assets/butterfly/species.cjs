// Paints the extra species (species.html) and writes the app's sprites:
// public/assets/3d/butterfly-<species>-wing-l.webp / -wing-r.webp (192×208) and -body.webp (48×114).
// Usage: node species.cjs && python3 species.py
const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage()
  for (const s of ['morpho', 'rose', 'pearl']) {
    await p.goto(`file://${__dirname}/species.html?s=${s}`); await p.waitForFunction(() => window.done)
    for (const id of ['w', 'b']) {
      const url = await p.evaluate((i) => document.getElementById(i).toDataURL('image/png'), id)
      fs.writeFileSync(`${__dirname}/${s}-${id === 'w' ? 'wing' : 'body'}.png`, Buffer.from(url.split(',')[1], 'base64'))
    }
  }
  await b.close()
})()
