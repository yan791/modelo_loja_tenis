// Percorre a vitrine no Chrome sem janela e tira fotos de cada etapa.
// node teste.mjs [url] [--movel] [--largura=1440 --altura=900] [--pasta=shots/desktop]
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { abrir, esperar } from './navegador.mjs'

const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] }))
const url = args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:5290/'
const movel = !!opt.movel
const largura = +(opt.largura || (movel ? 390 : 1440))
const altura = +(opt.altura || (movel ? 844 : 900))
const pasta = new URL(`./shots/${opt.pasta || (movel ? 'movel' : 'desktop')}/`, import.meta.url)
mkdirSync(pasta, { recursive: true })

const { browser, page, erros } = await abrir({ largura, altura, movel, escala: movel ? 2 : 1 })
const foto = async (nome) => {
  await page.screenshot({ path: fileURLToPath(new URL(`${nome}.png`, pasta)) })
  console.log('foto', nome)
}
// centro do tênis i na tela
const ondeEsta = (i) =>
  page.evaluate((i) => {
    const v = window.__vitrine
    const s = v.slots[i]
    const p = s.tenis.getWorldPosition(s.tenis.position.clone())
    p.y += s.aspecto * 0.4
    p.project(v.camera)
    return { x: ((p.x + 1) / 2) * v.w, y: ((1 - p.y) / 2) * v.h }
  }, i)

const t0 = Date.now()
await page.goto(url + '?teste', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fase-pronto', { timeout: 60000 })
console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s`)
await esperar(500)
await foto('01-entrada')
await esperar(2600)
await foto('02-parede')

if (movel) {
  await page.evaluate(() => window.scrollTo(0, 500))
  await esperar(500)
  await foto('03-rolou')
  const p = await ondeEsta(2)
  await page.touchscreen.tap(p.x, p.y)
} else {
  const p = await ondeEsta(2)
  await page.mouse.move(p.x, p.y, { steps: 6 })
  await esperar(900)
  await foto('03-hover')
  await page.mouse.click(p.x, p.y)
}
await esperar(700)
await foto('04-voando')
await esperar(2000)
await foto('05-produto')

if (!movel) {
  await page.mouse.move(largura * 0.55, altura * 0.6)
  for (let k = 0; k < 6; k++) {
    await page.mouse.wheel({ deltaY: -120 })
    await esperar(60)
  }
  await esperar(1200)
  await foto('06-zoom')
  await page.click('.afastar')
  await esperar(1000)
  await page.click('.marcador:nth-child(2)')
  await esperar(1500)
  await foto('06b-detalhe')
  await page.click('.legenda__nav button:nth-child(2)')
  await esperar(1400)
  await foto('06c-detalhe-seguinte')
  await page.click('.legenda__afastar')
  await esperar(1000)
  await page.click('.seletor__botao')
  await esperar(500)
  await foto('07-tamanhos')
  await page.click('.seletor__lista button:nth-child(5)')
  await page.click('.pilula')
  await esperar(900)
  await foto('08-adicionado')
  console.log('sacola:', await page.$eval('.topo__sacola', (e) => e.textContent))
  await page.click('.topo__sacola')
  await esperar(800)
  await foto('08b-sacola')
  await page.click('.gaveta .fechar')
  await esperar(700)
  await page.keyboard.press('ArrowRight')
  await esperar(500)
  await foto('09-vizinho-meio')
  await esperar(1400)
  await foto('10-vizinho')
  await page.keyboard.press('Escape')
  await esperar(1800)
  await foto('11-volta')
} else {
  const p = await ondeEsta(2)
  await page.touchscreen.tap(p.x, p.y)
  await esperar(120)
  await page.touchscreen.tap(p.x, p.y)
  await esperar(1300)
  await foto('06-zoom')
  await page.click('.afastar')
  await esperar(1000)
  await page.click('.marcador:nth-child(2)')
  await esperar(1500)
  await foto('06b-detalhe')
  await page.click('.legenda__nav button:nth-child(2)')
  await esperar(1400)
  await foto('06c-detalhe-seguinte')
  await page.click('.legenda__afastar').catch(() => {})
  await esperar(900)
  await page.click('.produto__nav button:last-child')
  await esperar(1800)
  await foto('07-vizinho')
  await page.click('.menu__item')
  await esperar(1800)
  await foto('08-volta')
}
console.log(erros.length ? erros.join('\n') : 'sem erros no console')
await browser.close()
