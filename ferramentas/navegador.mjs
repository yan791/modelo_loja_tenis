// Chrome sem janela para testar a vitrine (o painel do app pausa animações quando está escondido).
import puppeteer from 'puppeteer-core'

export async function abrir({ largura = 1440, altura = 900, movel = false, escala = 1 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  })
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => {
    if (['error', 'warn', 'warning'].includes(m.type()) && !m.text().includes('X4122')) erros.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => erros.push(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) => erros.push(`[falha] ${r.url()} ${r.failure()?.errorText}`))
  await page.setViewport({ width: largura, height: altura, deviceScaleFactor: escala, isMobile: movel, hasTouch: movel })
  return { browser, page, erros }
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
