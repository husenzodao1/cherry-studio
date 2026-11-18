const { chromium } = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const root = __dirname
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream' }
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]))
  fs.readFile(fs.existsSync(p) && fs.statSync(p).isDirectory() ? p + '/index.html' : p, (e, d) => {
    if (e) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(d)
  })
}).listen(8765)
;(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const only = process.argv[3]
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=6000'] })
  for (const job of jobs) {
    if (only && !only.split(',').includes(job.name)) continue
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } })
    page.on('pageerror', (e) => console.log('pageerror', job.name, e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text().slice(0, 600)) })
    await page.goto('http://localhost:8765/render.html')
    await page.waitForFunction(() => window.ready)
    const t = Date.now()
    const out = await page.evaluate((j) => window.renderJob(j), job)
    fs.mkdirSync('out', { recursive: true })
    if (out.blackUrl) {
      fs.writeFileSync(`out/${job.name}.b.png`, Buffer.from(out.blackUrl.split(',')[1], 'base64'))
      fs.writeFileSync(`out/${job.name}.w.png`, Buffer.from(out.whiteUrl.split(',')[1], 'base64'))
    } else fs.writeFileSync(`out/${job.name}.png`, Buffer.from(out.colorUrl.split(',')[1], 'base64'))
    if (out.maskUrl) fs.writeFileSync(`out/${job.name}.mask.png`, Buffer.from(out.maskUrl.split(',')[1], 'base64'))
    console.log(job.name, 'rendered in', Date.now() - t, 'ms')
    await page.close()
  }
  await browser.close(); server.close()
})()
