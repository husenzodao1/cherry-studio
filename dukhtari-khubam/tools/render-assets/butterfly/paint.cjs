const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage()
  await p.goto('file://' + __dirname + '/paint.html'); await p.waitForFunction(() => window.done)
  for (const id of ['w', 'b']) {
    const url = await p.evaluate((i) => document.getElementById(i).toDataURL('image/png'), id)
    fs.writeFileSync(`${__dirname}/${id === 'w' ? 'wing' : 'body'}.png`, Buffer.from(url.split(',')[1], 'base64'))
  }
  await b.close()
})()
