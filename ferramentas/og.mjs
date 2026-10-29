// Gera a imagem de prévia de link (1200x630, WhatsApp e redes) a partir da parede com uma prateleira acesa.
// node og.mjs [url] [saida.jpg]
import { fileURLToPath } from 'node:url'
import { abrir, esperar } from './navegador.mjs'

const url = process.argv[2] || 'http://127.0.0.1:5291/'
const saida = process.argv[3] || fileURLToPath(new URL('../site/public/og.jpg', import.meta.url))
const { browser, page, erros } = await abrir({ largura: 1200, altura: 630 })
await page.goto(url + '?teste', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fase-pronto', { timeout: 60000 })
await esperar(3200)
// acende a prateleira do meio e tira o texto de ajuda do rodapé
await page.evaluate(() => {
  window.__vitrine.definirHover(1)
  document.querySelector('.rodape__status').style.visibility = 'hidden'
})
await esperar(1400)
await page.screenshot({ path: saida, type: 'jpeg', quality: 88 })
console.log('ok', saida, erros.join('\n') || 'sem erros')
await browser.close()
