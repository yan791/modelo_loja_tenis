// Liga e desliga partes da cena para achar artefatos. node depurar.mjs [url]
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { abrir, esperar } from './navegador.mjs'

const url = process.argv[2] || 'http://127.0.0.1:5290/'
const pasta = new URL('./shots/depurar/', import.meta.url)
mkdirSync(pasta, { recursive: true })
const { browser, page, erros } = await abrir({ largura: 1440, altura: 900 })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fase-pronto', { timeout: 60000 })
await esperar(3500)
const casos = {
  normal: () => {},
  semSombraTenis: (v) => v.slots.forEach((s) => (s.tenis.castShadow = false)),
  semSombraNenhuma: (v) => (v.chave.castShadow = false),
  semTenis: (v) => v.slots.forEach((s) => (s.tenis.visible = false)),
}
for (const [nome, fn] of Object.entries(casos)) {
  await page.evaluate(`(${fn})(window.__vitrine); window.__vitrine.renderer.shadowMap.needsUpdate = true; window.__vitrine.sujo = true`)
  await esperar(400)
  await page.screenshot({ path: fileURLToPath(new URL(`${nome}.png`, pasta)), clip: { x: 640, y: 560, width: 520, height: 280 } })
  await page.evaluate(`(() => { const v = window.__vitrine; v.chave.castShadow = true; v.slots.forEach((s) => { s.tenis.castShadow = true; s.tenis.visible = true }) })()`)
  console.log(nome)
}
console.log(erros.join('\n') || 'sem erros')
await browser.close()
