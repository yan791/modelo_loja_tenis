// Mede o tempo de cada quadro durante as animações (entrada, voo até o tênis, troca, volta).
// node fluidez.mjs [url] [--movel]
import { abrir, esperar } from './navegador.mjs'

const url = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'http://127.0.0.1:5291/'
const movel = process.argv.includes('--movel')
const { browser, page, erros } = await abrir(movel ? { largura: 390, altura: 844, movel: true, escala: 2 } : { largura: 1440, altura: 900 })
await page.goto(url + '?teste', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fase-pronto', { timeout: 60000 })

const medir = async (nome, acao, ms) => {
  await page.evaluate(() => {
    window.__q = []
    let ult = performance.now()
    const f = (t) => {
      window.__q.push(t - ult)
      ult = t
      if (window.__medindo) requestAnimationFrame(f)
    }
    window.__medindo = true
    requestAnimationFrame(f)
  })
  await acao()
  await esperar(ms)
  const q = await page.evaluate(() => {
    window.__medindo = false
    return window.__q.slice(1)
  })
  q.sort((a, b) => a - b)
  const p = (x) => q[Math.min(q.length - 1, Math.floor(q.length * x))].toFixed(1)
  console.log(`${nome.padEnd(10)} quadros ${String(q.length).padStart(4)}  mediana ${p(0.5)} ms  p95 ${p(0.95)} ms  pior ${q[q.length - 1].toFixed(1)} ms  >25ms: ${q.filter((x) => x > 25).length}`)
}

await medir('entrada', async () => {}, 2600)
await medir('voo', () => page.evaluate(() => window.__vitrine.cb.selecionar(2)), 1900)
await medir('vizinho', () => page.keyboard.press('ArrowRight'), 1500)
await medir('zoom', () => page.evaluate(() => window.__vitrine.definirZoom(2, innerWidth / 2, innerHeight / 2)), 1200)
await medir('volta', () => page.keyboard.press('Escape').then(() => page.keyboard.press('Escape')), 1800)
console.log(erros.join('\n') || 'sem erros')
await browser.close()
