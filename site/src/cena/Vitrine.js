// Parede da vitrine em three.js: prateleiras de vidro com um tênis em cada (imagens recortadas, geradas
// por IA), parede de reboco fotográfico com luz de spot sobre cada prateleira, câmera que voa até o tênis,
// LED que acende no vidro, zoom e pontos de detalhe. A interface (textos, preço, sacola) é DOM, feita no
// React; esta classe só cuida do 3D.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import gsap from 'gsap'

const BASE = import.meta.env.BASE_URL
const FOV = 24
const PASSO = { x: 1.3, y: 1.26 }
const PRAT = { w: 1.14, h: 0.036, d: 0.4 }
const Z_TENIS = PRAT.d * 0.56 // o tênis fica um pouco à frente do meio da prateleira
const ZOOM_MAX = 2.2
const ZOOM_DETALHE = 2.1
const ESCALA_PAREDE = 10.7 // a textura cobre 3,2 m de reboco; 1 unidade da cena = 30 cm (um tênis)
const COR_LED = new THREE.Color('#ff6f14')
const COR_NUCLEO = new THREE.Color('#ffd29a')

async function baixar(url, aoAvancar) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  if (!r.body) {
    const b = await r.arrayBuffer()
    aoAvancar(b.byteLength)
    return new Blob([b])
  }
  const leitor = r.body.getReader()
  const partes = []
  let lido = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value)
    lido += value.length
    aoAvancar(lido)
  }
  return new Blob(partes)
}

// Imagem do tênis com as reduções (mipmaps) feitas pelo navegador em alta qualidade: de longe o tênis
// fica nítido, sem o borrado da redução padrão da placa de vídeo
async function texturaFoto(blob, anisotropia) {
  const opc = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }
  const nivel0 = await createImageBitmap(blob, { ...opc, imageOrientation: 'flipY' })
  const niveis = [nivel0]
  let { width: l, height: a } = nivel0
  try {
    while (l > 1 || a > 1) {
      l = Math.max(1, l >> 1)
      a = Math.max(1, a >> 1)
      niveis.push(await createImageBitmap(niveis[niveis.length - 1], { ...opc, resizeWidth: l, resizeHeight: a, resizeQuality: 'high' }))
    }
  } catch {
    niveis.length = 1 // navegador sem redimensionamento: a placa de vídeo gera as reduções
  }
  const t = new THREE.Texture(nivel0)
  if (niveis.length > 1) {
    t.mipmaps = niveis
    t.generateMipmaps = false
  }
  t.flipY = false
  t.colorSpace = THREE.SRGBColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = anisotropia
  t.needsUpdate = true
  return t
}

async function texturaParede(blob, cor) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', colorSpaceConversion: 'none' })
  const t = new THREE.Texture(bmp)
  t.flipY = false
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

// Sombra suave do tênis na parede: a silhueta da imagem, pequena e desfocada
function texturaSombra(bmp) {
  const l = 256
  const a = Math.round((bmp.height / bmp.width) * l)
  const folga = 24
  const c = document.createElement('canvas')
  c.width = l + folga * 2
  c.height = a + folga * 2
  const ctx = c.getContext('2d')
  ctx.filter = 'blur(7px) brightness(0)'
  ctx.drawImage(bmp, folga, folga, l, a)
  const t = new THREE.CanvasTexture(c)
  t.flipY = false // o bitmap já vem invertido
  return { t, folga: folga / l }
}

// Textura desenhada em canvas: fn(u, v) devolve [cinza, alfa] de 0 a 1
function texturaCanvas(l, a, fn) {
  const c = document.createElement('canvas')
  c.width = l
  c.height = a
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(l, a)
  for (let y = 0; y < a; y++) {
    for (let x = 0; x < l; x++) {
      const [g, al] = fn((x + 0.5) / l, (y + 0.5) / a)
      const i = (y * l + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(g * 255)
      img.data[i + 3] = Math.round(al * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Tênis: a foto sem iluminação da cena (já vem com luz de estúdio), mais:
//  - contato: a sola escurece um pouco onde encosta no vidro
//  - LED: luz quente subindo pela sola quando a prateleira acende
//  - foco: no produto, os vizinhos ficam desfocados e na penumbra (como numa lente de câmera)
function materialTenis(tex, base) {
  const u = { uLuz: { value: 0 }, uLed: { value: COR_LED.clone() }, uApaga: { value: 0 }, uVies: { value: -0.45 }, uBase: { value: base } }
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, alphaTest: 0.004 })
  m.userData.u = u
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u)
    s.fragmentShader =
      'uniform float uLuz;\nuniform vec3 uLed;\nuniform float uApaga;\nuniform float uVies;\nuniform float uBase;\n' +
      s.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= texture2D( map, vMapUv, uVies );
        #endif
        float contato = mix( 0.72, 1.0, smoothstep( uBase, uBase + 0.045, vMapUv.y ) );
        float baixo = 1.0 - smoothstep( 0.0, 0.45, vMapUv.y );
        diffuseColor.rgb *= ( 0.9 + uLed * uLuz * baixo * baixo * 1.1 ) * contato;
        diffuseColor.rgb += uLed * uLuz * baixo * baixo * baixo * 0.05;
        diffuseColor.rgb *= 1.0 - uApaga * 0.42;`,
      )
  }
  m.customProgramCacheKey = () => 'tenis-foto'
  return m
}

// Reflexo do tênis no tampo de vidro: a mesma foto espelhada, desbotando rápido a partir da sola.
// Só aparece onde o tampo foi desenhado (stencil), então não vaza para a parede.
function materialReflexo(tex, base) {
  const u = { uBase: { value: base }, uForca: { value: 0.45 } }
  const m = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  })
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u)
    s.fragmentShader =
      'uniform float uBase;\nuniform float uForca;\n' +
      s.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= texture2D( map, vMapUv, 1.2 );
        #endif
        diffuseColor.a *= uForca * ( 1.0 - smoothstep( uBase, uBase + 0.22, vMapUv.y ) );
        diffuseColor.rgb *= 0.85;`,
      )
  }
  m.customProgramCacheKey = () => 'tenis-reflexo'
  m.userData.u = u
  return m
}

export class Vitrine {
  constructor(canvas, cb) {
    this.canvas = canvas
    this.cb = cb // { progresso, hover, selecionar, rolagem, palcos, rotulos, pontos, zoom }
    this.modo = 'parede'
    this.ativo = null
    this.hover = null
    this.cols = 0
    this.slots = []
    this.produtos = []
    this.mouse = new THREE.Vector2()
    this.mouseSuave = new THREE.Vector2()
    this.zoom = 1
    this.zoomAlvo = 1
    this.foco = new THREE.Vector2()
    this.focoAlvo = new THREE.Vector2()
    this.ponteiros = new Map()
    this.trans = { p: 1, de: null, arco: 0 }
    this.sujo = true
    this.rolagemMax = 0

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NeutralToneMapping
    r.setClearColor('#232221')

    this.cena = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
    this.camera.position.set(0, 0, 10)
    const pmrem = new THREE.PMREMGenerator(r)
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.cena.environmentIntensity = 0.3
    pmrem.dispose()

    this.ray = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.v = new THREE.Vector3()
    this.planoFoco = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_TENIS)

    this.montarAmbiente()
    this.ligarEventos()
  }

  montarAmbiente() {
    // parede de reboco pintado; a cor e o relevo chegam no carregamento (texturas fotográficas)
    this.focos = { valor: Array.from({ length: 10 }, () => new THREE.Vector3()) }
    this.uParede = { uFocos: this.focos, uQtdFocos: { value: 0 }, uForcaFoco: { value: 0.75 } }
    this.matParede = new THREE.MeshStandardMaterial({ color: '#77746f', roughness: 0.93, metalness: 0, envMapIntensity: 0.4 })
    this.matParede.onBeforeCompile = (s) => {
      s.uniforms.uFocos = { value: this.focos.valor }
      s.uniforms.uQtdFocos = this.uParede.uQtdFocos
      s.uniforms.uForcaFoco = this.uParede.uForcaFoco
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;')
      // spot de teto sobre cada prateleira: o "leque" de luz clássico de vitrine, aberto para baixo
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform vec3 uFocos[10];\nuniform int uQtdFocos;\nuniform float uForcaFoco;')
        .replace(
          '#include <opaque_fragment>',
          `float leque = 0.0;
          for ( int i = 0; i < 10; i ++ ) {
            if ( i >= uQtdFocos ) break;
            vec3 f = uFocos[ i ];
            float dy = f.y - vMundo.y;
            float dx = vMundo.x - f.x;
            float largura = 0.16 + 0.42 * max( dy, 0.0 );
            float corpo = smoothstep( -0.05, 0.3, dy ) * exp( -0.55 * max( dy, 0.0 ) );
            leque += corpo * exp( - ( dx * dx ) / ( largura * largura ) ) * f.z;
          }
          outgoingLight += diffuseColor.rgb * leque * uForcaFoco * vec3( 1.0, 0.93, 0.84 );
          #include <opaque_fragment>`,
        )
    }
    this.parede = new THREE.Mesh(new THREE.PlaneGeometry(48, 30), this.matParede)
    this.cena.add(this.parede)

    // aparador comprido perto do chão, como no balcão de uma loja
    this.aparador = new THREE.Mesh(new THREE.BoxGeometry(48, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: '#34312e', roughness: 0.6, metalness: 0, envMapIntensity: 0.6 }))
    this.cena.add(this.aparador)

    this.cena.add(new THREE.HemisphereLight('#f3ede6', '#38322f', 0.45))
    // luz geral vinda do alto à esquerda (sem shadow map: as sombras são desenhadas, mais suaves e baratas)
    const chave = (this.chave = new THREE.SpotLight('#fff4ea', 2.1, 0, 0.5, 1, 0))
    this.cena.add(chave, chave.target)

    this.texHalo = texturaCanvas(256, 64, (u, v) => {
      const bordas = suave(0, 0.16, u) * suave(1, 0.84, u)
      const y = (v - 0.5) * 2
      return [Math.exp(-y * y * 7) * bordas, 1]
    })
    this.texNucleo = texturaCanvas(256, 32, (u, v) => {
      const bordas = suave(0, 0.05, u) * suave(1, 0.95, u)
      const y = (v - 0.5) * 2
      return [Math.exp(-y * y * 40) * bordas, 1]
    })
    this.texEspalha = texturaCanvas(128, 128, (u, v) => {
      const x = (u - 0.5) * 2
      const y = (v - 0.5) * 2
      return [Math.exp(-(x * x * 2.2 + y * y * 3.2)) * (1 - suave(0.9, 1, Math.hypot(x, y))), 1]
    })
    this.texContato = texturaCanvas(128, 64, (u, v) => {
      const x = (u - 0.5) * 2
      const y = (v - 0.5) * 2
      return [0, Math.exp(-(x * x * 2.2 + y * y * 7)) * 0.95]
    })
    this.texSombraPrat = texturaCanvas(128, 64, (u, v) => {
      const bordas = suave(0, 0.12, u) * suave(1, 0.88, u)
      return [0, bordas * Math.pow(1 - v, 1.6) * 0.8]
    })
    // brilho do vidro: faixa clara no fundo do tampo, como a luz refletida numa placa de acrílico
    this.texBrilho = texturaCanvas(256, 64, (u, v) => {
      const bordas = suave(0, 0.08, u) * suave(1, 0.92, u)
      return [1, bordas * (Math.exp(-Math.pow((v - 0.12) / 0.06, 2)) * 0.9 + (1 - v) * 0.12)]
    })

    this.geoPrat = new THREE.BoxGeometry(PRAT.w, PRAT.h, PRAT.d)
    const vidro = {
      color: '#c3d6d0',
      transparent: true,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.2,
      depthWrite: false,
    }
    this.matVidro = new THREE.MeshPhysicalMaterial({ ...vidro, opacity: 0.12 })
    // o tampo marca o stencil: o reflexo do tênis só aparece dentro dele
    this.matTampo = new THREE.MeshPhysicalMaterial({
      ...vidro,
      opacity: 0.2,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    })
    this.geoPlano = new THREE.PlaneGeometry(1, 1)
    this.matAlvo = new THREE.MeshBasicMaterial({ visible: false })
  }

  async carregar(produtos) {
    this.produtos = produtos
    const leve = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820
    const sufixo = leve ? '-m' : ''
    const info = await (await fetch(`${BASE}tenis/tenis.json`)).json()
    const lista = produtos.map((p, i) => {
      if (!info[i]) throw new Error(`falta a imagem do tênis ${i + 1} (rode ferramentas/recortar.py)`)
      return info[i]
    })
    const arquivos = [
      ...lista.map((r) => ({ url: `tenis/${r.n}${sufixo}.webp`, peso: leve ? r.bytes_m : r.bytes })),
      { url: `parede/cor${sufixo}.webp`, peso: leve ? 26e3 : 190e3 },
      { url: `parede/normal${sufixo}.webp`, peso: leve ? 130e3 : 640e3 },
    ]
    const total = arquivos.reduce((a, f) => a + f.peso, 0)
    const lidos = arquivos.map(() => 0)
    const blobs = await Promise.all(
      arquivos.map((f, i) =>
        baixar(BASE + f.url, (l) => {
          lidos[i] = Math.min(l, f.peso)
          this.cb.progresso?.(lidos.reduce((a, b) => a + b, 0) / total)
        }),
      ),
    )
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    const texs = await Promise.all(lista.map((_, i) => texturaFoto(blobs[i], aniso)))
    const [cor, normal] = await Promise.all([texturaParede(blobs[lista.length], true), texturaParede(blobs[lista.length + 1], false)])
    cor.repeat.set(48 / ESCALA_PAREDE, 30 / ESCALA_PAREDE)
    normal.repeat.copy(cor.repeat)
    this.matParede.map = cor
    this.matParede.normalMap = normal
    this.matParede.normalScale.set(1.4, 1.4)
    this.matParede.needsUpdate = true

    // sobe as imagens para a placa de vídeo agora, ainda com a tela de carregamento na frente
    for (const t of [...texs, cor, normal]) this.renderer.initTexture(t)
    this.slots = lista.map((r, i) => this.criarSlot(i, texs[i], r))
    this.redimensionar()
  }

  criarSlot(i, tex, info) {
    const grupo = new THREE.Group()
    const matFrente = new THREE.MeshStandardMaterial({
      color: '#bfd3cc',
      transparent: true,
      opacity: 0.5,
      roughness: 0.12,
      emissive: COR_LED.clone(),
      emissiveIntensity: 0,
      depthWrite: false,
    })
    // BoxGeometry: +x, -x, +y (tampo), -y, +z (frente), -z
    const prat = new THREE.Mesh(this.geoPrat, [matFrente, matFrente, this.matTampo, this.matVidro, matFrente, this.matVidro])
    prat.position.set(0, -PRAT.h / 2, PRAT.d / 2)
    prat.renderOrder = 2
    grupo.add(prat)

    // aresta de cima da frente: a linha de luz que todo vidro grosso tem
    const aresta = new THREE.Mesh(this.geoPlano, new THREE.MeshBasicMaterial({ color: '#f4fbf8', transparent: true, opacity: 0.55, depthWrite: false }))
    aresta.scale.set(PRAT.w, 0.0045, 1)
    aresta.position.set(0, -0.002, PRAT.d + 0.001)
    aresta.renderOrder = 6
    grupo.add(aresta)

    const brilho = new THREE.Mesh(this.geoPlano, new THREE.MeshBasicMaterial({ map: this.texBrilho, color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }))
    brilho.rotation.x = -Math.PI / 2
    brilho.scale.set(PRAT.w * 0.99, PRAT.d * 0.98, 1)
    brilho.position.set(0, 0.0012, PRAT.d / 2)
    brilho.renderOrder = 4
    grupo.add(brilho)

    // acrílico deixa passar luz: em vez de sombra dura, uma faixa suave na parede
    const sombraPrat = new THREE.Mesh(this.geoPlano, new THREE.MeshBasicMaterial({ map: this.texSombraPrat, color: '#000', transparent: true, depthWrite: false, opacity: 0.55 }))
    sombraPrat.scale.set(PRAT.w * 1.08, 0.34, 1)
    sombraPrat.position.set(0.04, -0.2, 0.003)
    sombraPrat.renderOrder = 1
    grupo.add(sombraPrat)

    // a foto: largura 1 (todos os tênis com o mesmo comprimento), sola encostada no vidro
    const aspecto = info.altura / info.largura
    const base = info.base || 0
    const geo = new THREE.PlaneGeometry(1, aspecto)
    geo.translate(0, aspecto / 2 - base * aspecto, 0)
    const pivo = new THREE.Group()
    pivo.position.set(0, 0.001, Z_TENIS)
    const tenis = new THREE.Mesh(geo, materialTenis(tex, base))
    tenis.renderOrder = 5
    pivo.add(tenis)
    grupo.add(pivo)

    const reflexo = new THREE.Mesh(geo, materialReflexo(tex, base))
    reflexo.scale.y = -1
    reflexo.position.set(0, 0.001, Z_TENIS)
    reflexo.renderOrder = 3
    grupo.add(reflexo)

    // sombra do tênis na parede, caindo para baixo e para a direita (a luz vem do alto à esquerda)
    const { t: texSombra, folga } = texturaSombra(tex.image)
    const sombra = new THREE.Mesh(this.geoPlano, new THREE.MeshBasicMaterial({ map: texSombra, color: '#000', transparent: true, depthWrite: false, opacity: 0.42 }))
    const ls = 1 + folga * 2
    const as = aspecto + folga * 2
    sombra.scale.set(ls * 1.02, as * 1.02, 1)
    sombra.position.set(0.07, as / 2 - folga - base * aspecto - 0.13, 0.005)
    sombra.renderOrder = 1
    grupo.add(sombra)

    const contato = new THREE.Mesh(this.geoPlano, new THREE.MeshBasicMaterial({ map: this.texContato, color: '#000', transparent: true, depthWrite: false, opacity: 1 }))
    contato.rotation.x = -Math.PI / 2
    contato.scale.set(0.96, 0.24, 1)
    contato.position.set(0, 0.0016, Z_TENIS)
    contato.renderOrder = 4.5 // depois do brilho do LED, para a sombra não clarear
    grupo.add(contato)

    const aditivo = (map, cor) => new THREE.MeshBasicMaterial({ map, color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
    const halo = new THREE.Mesh(this.geoPlano, aditivo(this.texHalo, COR_LED.clone().multiplyScalar(1.7)))
    halo.scale.set(PRAT.w * 1.16, 0.17, 1)
    halo.position.set(0, -PRAT.h / 2, PRAT.d + 0.012)
    halo.renderOrder = 6
    const nucleo = new THREE.Mesh(this.geoPlano, aditivo(this.texNucleo, COR_NUCLEO.clone().multiplyScalar(2.1)))
    nucleo.scale.set(PRAT.w * 0.97, 0.02, 1)
    nucleo.position.set(0, -PRAT.h / 2, PRAT.d + 0.014)
    nucleo.renderOrder = 7
    const espalha = new THREE.Mesh(this.geoPlano, aditivo(this.texEspalha, COR_LED.clone().multiplyScalar(0.9)))
    espalha.scale.set(PRAT.w * 1.7, 0.75, 1)
    espalha.position.set(0, -0.1, 0.006)
    espalha.renderOrder = 1
    const topo = new THREE.Mesh(this.geoPlano, aditivo(this.texEspalha, COR_LED.clone().multiplyScalar(0.8)))
    topo.rotation.x = -Math.PI / 2
    topo.scale.set(PRAT.w * 1.05, PRAT.d * 1.3, 1)
    topo.position.set(0, 0.003, PRAT.d * 0.66)
    topo.renderOrder = 4
    grupo.add(halo, nucleo, espalha, topo)

    const alvo = new THREE.Mesh(new THREE.BoxGeometry(PRAT.w, aspecto + 0.12, PRAT.d), this.matAlvo)
    alvo.position.set(0, (aspecto + 0.12) / 2 - 0.06, PRAT.d / 2)
    alvo.userData.i = i
    grupo.add(alvo)

    this.cena.add(grupo)
    return {
      i,
      grupo,
      pivo,
      tenis,
      alvo,
      aspecto,
      base,
      matFrente,
      uniformes: tenis.material.userData.u,
      brilhos: [halo, nucleo, espalha, topo],
      luz: 0,
      alvoLuz: 0,
      apaga: 0,
      x: 0,
      y: 0,
    }
  }

  // --- layout -------------------------------------------------------------------------------------

  montarGrade(cols) {
    this.cols = cols
    const n = this.slots.length
    const linhas = Math.ceil(n / cols)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const s of this.slots) {
      const l = Math.floor(s.i / cols)
      const naLinha = Math.min(cols, n - l * cols) // a última fileira incompleta fica centralizada
      const c = s.i % cols
      s.x = (c - (naLinha - 1) / 2) * PASSO.x
      s.y = ((linhas - 1) / 2 - l) * PASSO.y
      s.grupo.position.set(s.x, s.y, 0)
      this.focos.valor[s.i].set(s.x, s.y + 1.02, 1)
      minX = Math.min(minX, s.x - PRAT.w / 2)
      maxX = Math.max(maxX, s.x + PRAT.w / 2)
      minY = Math.min(minY, s.y - PRAT.h)
      maxY = Math.max(maxY, s.y + s.aspecto + 0.04)
    }
    this.uParede.uQtdFocos.value = n
    this.limites = { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
    const L = this.limites
    this.aparador.visible = cols > 2
    this.aparador.position.set(0, L.minY - 0.62, 0.25)
    // a luz geral vem do alto à esquerda e cobre a grade toda
    this.chave.target.position.set(L.cx + 0.5, L.cy - 0.2, 0)
    this.chave.position.set(L.cx - 3.2, L.cy + 6, 8.5)
    const dist = this.chave.position.distanceTo(this.chave.target.position)
    this.chave.angle = Math.min(1.0, Math.atan(Math.hypot(L.w, L.h + 1.6) / 2 / dist) * 1.5)
  }

  redimensionar() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.w = w
    this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.slots.length) {
      const cols = w < 760 || w / h < 0.9 ? 2 : this.slots.length > 6 ? 5 : 3
      if (cols !== this.cols) this.montarGrade(cols)
      this.palcos = this.cb.palcos?.()
      this.calcularRolagem()
    }
    this.sujo = true
  }

  calcularRolagem() {
    const p = this.palcos?.parede
    if (!p) return
    const L = this.limites
    const kw = L.w / p.width
    const kh = L.h / p.height
    // só o celular (2 colunas) rola a parede; no computador ela sempre cabe inteira na tela
    const max = this.cols === 2 && kh > kw * 1.02 ? Math.round(L.h / kw - p.height) : 0
    if (max !== this.rolagemMax) {
      this.rolagemMax = max
      this.cb.rolagem?.(max)
    }
  }

  // Enquadra um retângulo do mundo (centro cx, cy no plano z) dentro de um retângulo da tela (palco, em px)
  enquadrar(cx, cy, cz, w, h, palco, { rolar = false, elevacao = 0 } = {}) {
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const kw = w / palco.width
    const kh = h / palco.height
    const k = rolar ? kw : Math.max(kw, kh)
    const dist = (k * this.h) / 2 / tan
    let y = cy
    if (rolar) y = cy + h / 2 - (palco.height * k) / 2 - (window.scrollY || 0) * k
    const dx = palco.left + palco.width / 2 - this.w / 2
    const dy = palco.top + palco.height / 2 - this.h / 2
    const tx = cx - dx * k
    const ty = y + dy * k
    return { pos: new THREE.Vector3(tx, ty + elevacao * dist, cz + dist), alvo: new THREE.Vector3(tx, ty, cz), dist, k }
  }

  quadroProduto() {
    const s = this.slots[this.ativo]
    // um pouco mais de cima que na parede: o tampo de vidro aparece embaixo da sola
    return this.enquadrar(s.x, s.y + s.aspecto / 2, Z_TENIS, 1.04, s.aspecto + 0.08, this.palcos.produto, { elevacao: 0.09 })
  }

  destino() {
    if (this.modo === 'produto' && this.ativo != null) {
      const d = this.quadroProduto()
      const z = this.zoom
      if (z > 1.0005) {
        // aproxima em direção ao ponto escolhido: ele continua no mesmo lugar da tela
        const desl = new THREE.Vector3(this.foco.x, this.foco.y, 0).multiplyScalar(1 - 1 / z)
        const recuo = d.pos.clone().sub(d.alvo).multiplyScalar(1 / z)
        d.alvo.add(desl)
        d.pos.copy(d.alvo).add(recuo)
        d.dist /= z
        d.k /= z
      }
      return d
    }
    const L = this.limites
    return this.enquadrar(L.cx, L.cy, PRAT.d / 2, L.w, L.h, this.palcos.parede, { rolar: this.rolagemMax > 0, elevacao: 0.045 })
  }

  // ponto (u, v) da foto do tênis i (0 a 1, a partir do canto de cima à esquerda) no mundo
  pontoDaFoto(i, u, v) {
    const s = this.slots[i]
    return new THREE.Vector3(s.x + (u - 0.5), s.y + 0.001 + (1 - v - s.base) * s.aspecto, Z_TENIS)
  }

  // --- navegação ----------------------------------------------------------------------------------

  irPara(indice, { intro = false } = {}) {
    const antes = this.ativo
    this.modo = indice == null ? 'parede' : 'produto'
    this.ativo = indice
    this.definirZoom(1)
    this.zoom = 1
    this.palcos = this.cb.palcos?.() || this.palcos
    this.calcularRolagem()
    this.definirHover(null)
    for (const s of this.slots) s.alvoLuz = s.i === indice ? 1 : 0
    this.canvas.style.cursor = this.modo === 'produto' ? 'zoom-in' : ''
    // a câmera parte de onde está e vai até o destino, que é recalculado a cada quadro
    this.trans.de = { pos: this.camera.position.clone(), alvo: this.olhar ? this.olhar.clone() : this.destino().alvo }
    const vizinho = antes != null && indice != null
    this.trans.arco = vizinho ? 0.05 : 0.12
    gsap.killTweensOf(this.trans)
    this.trans.p = 0
    gsap.to(this.trans, {
      p: 1,
      duration: intro ? 2.6 : vizinho ? 1.15 : indice == null ? 1.35 : 1.6,
      ease: intro ? 'power2.inOut' : 'power3.inOut',
      onComplete: () => (this.trans.de = null),
    })
    this.sujo = true
  }

  async iniciar(indice) {
    try {
      await this.renderer.compileAsync(this.cena, this.camera)
    } catch {
      /* compileAsync não existe em navegadores antigos: segue sem pré-compilar */
    }
    this.modo = indice == null ? 'parede' : 'produto'
    this.ativo = indice
    const d = this.destino()
    // começa mais perto e um pouco de lado, com a luz apagada; a câmera recua e a parede acende
    this.camera.position.copy(d.pos).add(new THREE.Vector3(-0.05 * d.dist, 0.3, -d.dist * 0.38))
    this.olhar = d.alvo.clone().add(new THREE.Vector3(0.15, 0.05, 0))
    this.camera.lookAt(this.olhar)
    const forca = this.chave.intensity
    const forcaFoco = this.uParede.uForcaFoco.value
    this.chave.intensity = 0
    this.uParede.uForcaFoco.value = 0
    gsap.to(this.chave, { intensity: forca, duration: 1.6, ease: 'power2.out', onUpdate: () => (this.sujo = true) })
    // os spots do teto acendem logo depois da luz geral
    gsap.to(this.uParede.uForcaFoco, { value: forcaFoco, duration: 1.4, delay: 0.5, ease: 'power2.out', onUpdate: () => (this.sujo = true) })
    this.irPara(indice, { intro: true })
    if (indice == null) {
      // teste de LEDs: as prateleiras acendem em sequência, como uma loja abrindo
      this.slots.forEach((s) => {
        gsap.delayedCall(0.6 + s.i * 0.1, () => {
          if (this.modo === 'parede' && this.hover !== s.i) s.alvoLuz = 0.85
        })
        gsap.delayedCall(0.95 + s.i * 0.1, () => {
          if (this.modo === 'parede' && this.hover !== s.i) s.alvoLuz = 0
        })
      })
    }
    // primeiro quadro (upload restante e shaders) também atrás da tela de carregamento
    this.aplicarCamera()
    this.renderer.render(this.cena, this.camera)
    this.raf = requestAnimationFrame(this.quadro)
  }

  definirHover(i) {
    if (i === this.hover) return
    const antes = this.hover
    this.hover = i
    if (antes != null && this.modo === 'parede') this.slots[antes].alvoLuz = 0
    if (i != null && this.modo === 'parede') this.slots[i].alvoLuz = 0.62
    if (this.modo === 'parede') this.canvas.style.cursor = i != null ? 'pointer' : ''
    this.cb.hover?.(i)
  }

  // --- zoom no produto ----------------------------------------------------------------------------

  pontoNoTenis(x, y) {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const p = this.ray.ray.intersectPlane(this.planoFoco, new THREE.Vector3())
    if (!p) return null
    const base = this.quadroProduto().alvo
    return new THREE.Vector2(p.x - base.x, p.y - base.y)
  }

  limitarFoco() {
    const s = this.slots[this.ativo]
    if (!s) return
    this.focoAlvo.x = THREE.MathUtils.clamp(this.focoAlvo.x, -1, 1)
    this.focoAlvo.y = THREE.MathUtils.clamp(this.focoAlvo.y, -s.aspecto, s.aspecto)
  }

  definirZoom(z, x, y) {
    const novo = THREE.MathUtils.clamp(z, 1, ZOOM_MAX)
    const f = 1 - 1 / novo
    if (x != null && f > 0.001) {
      // o ponto do tênis sob o cursor continua sob o cursor depois do zoom
      const p = this.pontoNoTenis(x, y)
      if (p) {
        const centro = this.foco.clone().multiplyScalar(1 - 1 / this.zoom)
        const naTela = p.clone().sub(centro).multiplyScalar(this.zoom) // distância até o centro da tela, na escala sem zoom
        this.focoAlvo.copy(p.sub(naTela.multiplyScalar(1 / novo)).multiplyScalar(1 / f))
        this.limitarFoco()
      }
    }
    if (novo <= 1.001) this.focoAlvo.set(0, 0)
    this.zoomAlvo = novo
    this.avisarZoom()
    this.sujo = true
  }

  // leva a câmera até um ponto de detalhe da foto e centraliza nele
  focarDetalhe(u, v) {
    if (this.ativo == null) return
    const p = this.pontoDaFoto(this.ativo, u, v)
    const base = this.quadroProduto().alvo
    const f = 1 - 1 / ZOOM_DETALHE
    this.focoAlvo.set((p.x - base.x) / f, (p.y - base.y) / f)
    this.limitarFoco()
    this.zoomAlvo = ZOOM_DETALHE
    this.avisarZoom()
    this.sujo = true
  }

  avisarZoom() {
    const z = this.zoomAlvo > 1.05
    if (z !== this.comZoom) {
      this.comZoom = z
      this.cb.zoom?.(z)
    }
    if (this.modo === 'produto') this.canvas.style.cursor = z ? 'grab' : 'zoom-in'
  }

  // --- ponteiro -----------------------------------------------------------------------------------

  escolher(x, y) {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const h = this.ray.intersectObjects(
      this.slots.map((s) => s.alvo),
      false,
    )
    return h.length ? h[0].object.userData.i : null
  }

  ligarEventos() {
    const c = this.canvas
    this.aoMover = (e) => {
      if (e.pointerType === 'mouse') {
        this.mouse.set((e.clientX / this.w) * 2 - 1, (e.clientY / this.h) * 2 - 1)
        this.sujo = true
      }
      const pt = this.ponteiros.get(e.pointerId)
      if (pt) {
        const dx = e.clientX - pt.x
        const dy = e.clientY - pt.y
        pt.x = e.clientX
        pt.y = e.clientY
        pt.dist += Math.abs(dx) + Math.abs(dy)
        if (this.modo !== 'produto') return
        if (this.ponteiros.size === 2) {
          // pinça: aproxima pelo meio dos dois dedos
          const [a, b] = [...this.ponteiros.values()]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (this.pinca) this.definirZoom((this.pinca.zoom * d) / this.pinca.d, (a.x + b.x) / 2, (a.y + b.y) / 2)
          return
        }
        if (this.zoomAlvo > 1.02 && pt.dist > 3) {
          // arrastar com zoom: o tênis acompanha o dedo
          const k = (2 * this.quadroProduto().dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.h / this.zoom
          const f = Math.max(0.05, 1 - 1 / this.zoom)
          this.focoAlvo.x -= (dx * k) / f
          this.focoAlvo.y += (dy * k) / f
          this.limitarFoco()
          c.style.cursor = 'grabbing'
          this.cb.arrastou?.()
          this.sujo = true
        }
        return
      }
      if (e.pointerType === 'mouse' && this.modo === 'parede' && this.slots.length && this.trans.p > 0.85) {
        this.definirHover(this.escolher(e.clientX, e.clientY))
      }
    }
    this.aoDescer = (e) => {
      this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), dist: 0 })
      if (this.modo === 'produto') {
        try {
          c.setPointerCapture(e.pointerId)
        } catch {
          /* ponteiro já liberado */
        }
        if (this.ponteiros.size === 2) {
          const [a, b] = [...this.ponteiros.values()]
          this.pinca = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.zoomAlvo }
        }
      }
    }
    this.aoSubir = (e) => {
      const pt = this.ponteiros.get(e.pointerId)
      this.ponteiros.delete(e.pointerId)
      if (this.ponteiros.size < 2) this.pinca = null
      if (!pt || !this.slots.length) return
      if (this.modo === 'produto') c.style.cursor = this.zoomAlvo > 1.05 ? 'grab' : 'zoom-in'
      const toque = Math.hypot(e.clientX - pt.x0, e.clientY - pt.y0) < 8 && performance.now() - pt.t0 < 500
      if (!toque) return
      const i = this.escolher(e.clientX, e.clientY)
      if (this.modo === 'produto') {
        if (i != null && i !== this.ativo) return this.cb.selecionar?.(i)
        // toque duplo (ou clique duplo) aproxima e afasta
        const agora = performance.now()
        const ult = this.ultimoToque
        if (ult && agora - ult.t < 320 && Math.hypot(e.clientX - ult.x, e.clientY - ult.y) < 30) {
          this.definirZoom(this.zoomAlvo > 1.2 ? 1 : 2, e.clientX, e.clientY)
          this.cb.arrastou?.()
          this.ultimoToque = null
        } else this.ultimoToque = { t: agora, x: e.clientX, y: e.clientY }
        return
      }
      if (i != null) this.cb.selecionar?.(i)
    }
    this.aoRoda = (e) => {
      if (this.modo !== 'produto') return
      e.preventDefault()
      const passo = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      this.definirZoom(this.zoomAlvo * Math.exp(-passo * 0.0016), e.clientX, e.clientY)
      this.cb.arrastou?.()
    }
    this.aoSair = () => {
      if (this.modo === 'parede') this.definirHover(null)
      this.mouse.set(0, 0)
    }
    this.aoRedimensionar = () => this.redimensionar()
    this.aoRolar = () => (this.sujo = true)
    c.addEventListener('pointermove', this.aoMover)
    c.addEventListener('pointerdown', this.aoDescer)
    c.addEventListener('pointerup', this.aoSubir)
    c.addEventListener('pointercancel', this.aoSubir)
    c.addEventListener('pointerleave', this.aoSair)
    c.addEventListener('wheel', this.aoRoda, { passive: false })
    window.addEventListener('resize', this.aoRedimensionar)
    window.addEventListener('scroll', this.aoRolar, { passive: true })
  }

  // --- quadro a quadro ----------------------------------------------------------------------------

  quadro = (agora) => {
    this.raf = requestAnimationFrame(this.quadro)
    const dt = Math.min(0.05, (agora - (this.ultimo || agora)) / 1000)
    this.ultimo = agora
    let mexeu = this.sujo
    this.sujo = false

    const k = 1 - Math.exp(-dt * 3)
    if (this.mouseSuave.distanceToSquared(this.mouse) > 1e-7) {
      this.mouseSuave.lerp(this.mouse, k)
      mexeu = true
    }
    if (this.trans.de) mexeu = true

    const kz = 1 - Math.exp(-dt * 6)
    if (Math.abs(this.zoomAlvo - this.zoom) > 1e-4 || this.foco.distanceToSquared(this.focoAlvo) > 1e-8) {
      this.zoom += (this.zoomAlvo - this.zoom) * kz
      this.foco.lerp(this.focoAlvo, kz)
      mexeu = true
    }

    const kl = 1 - Math.exp(-dt * 5)
    for (const s of this.slots) {
      if (Math.abs(s.alvoLuz - s.luz) > 1e-4) {
        s.luz += (s.alvoLuz - s.luz) * kl
        mexeu = true
      }
      // no produto, os vizinhos ficam na penumbra e fora de foco para o escolhido se destacar
      const apaga = this.modo === 'produto' && s.i !== this.ativo ? 1 : 0
      if (Math.abs(apaga - s.apaga) > 1e-4) {
        s.apaga += (apaga - s.apaga) * kl
        s.uniformes.uApaga.value = s.apaga
        s.uniformes.uVies.value = -0.45 + s.apaga * 2.6
        mexeu = true
      }
      const l = s.luz
      s.uniformes.uLuz.value = l
      s.matFrente.emissiveIntensity = l * 2.4
      s.matFrente.opacity = 0.5 + l * 0.5
      const [halo, nucleo, espalha, topo] = s.brilhos
      halo.material.opacity = l * 0.85
      nucleo.material.opacity = l
      espalha.material.opacity = l * 0.26
      topo.material.opacity = l * 0.12
      halo.visible = nucleo.visible = espalha.visible = topo.visible = l > 0.002
    }

    if (!mexeu || !this.slots.length) return
    this.aplicarCamera()
    this.posicionarRotulos()
    this.renderer.render(this.cena, this.camera)
  }

  aplicarCamera() {
    const d = this.destino()
    let pos = d.pos
    let alvo = d.alvo
    const tr = this.trans
    if (tr.de) {
      const p = tr.p
      pos = tr.de.pos.clone().lerp(d.pos, p)
      alvo = tr.de.alvo.clone().lerp(d.alvo, p)
      pos.y += Math.sin(Math.PI * p) * tr.arco * d.dist
    }
    // paralaxe do mouse: muda a perspectiva das prateleiras (mais suave no produto e com zoom)
    const amp = this.modo === 'parede' ? 0.026 : 0.012 / this.zoom
    pos = pos.clone()
    pos.x += this.mouseSuave.x * amp * d.dist
    pos.y -= this.mouseSuave.y * amp * 0.6 * d.dist
    this.camera.position.copy(pos)
    this.olhar = alvo
    this.camera.lookAt(alvo)
  }

  naTela(p) {
    this.v.copy(p).project(this.camera)
    return { x: ((this.v.x + 1) / 2) * this.w, y: ((1 - this.v.y) / 2) * this.h }
  }

  posicionarRotulos() {
    const els = this.cb.rotulos?.()
    if (els) {
      for (const s of this.slots) {
        const el = els[s.i]
        if (!el) continue
        const a = this.naTela(this.v.set(s.x - PRAT.w / 2, s.y - PRAT.h, PRAT.d))
        const b = this.naTela(this.v.set(s.x + PRAT.w / 2, s.y - PRAT.h, PRAT.d))
        el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`
        el.style.width = `${(b.x - a.x).toFixed(1)}px`
      }
    }
    // pontos de detalhe do tênis em foco
    const pontos = this.cb.pontos?.()
    if (pontos && this.ativo != null) {
      const det = this.produtos[this.ativo]?.detalhes || []
      pontos.forEach((el, j) => {
        if (!el || !det[j]) return
        const p = this.naTela(this.pontoDaFoto(this.ativo, det[j].x, det[j].y))
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
      })
    }
  }

  destruir() {
    cancelAnimationFrame(this.raf)
    const c = this.canvas
    c.removeEventListener('pointermove', this.aoMover)
    c.removeEventListener('pointerdown', this.aoDescer)
    c.removeEventListener('pointerup', this.aoSubir)
    c.removeEventListener('pointercancel', this.aoSubir)
    c.removeEventListener('pointerleave', this.aoSair)
    c.removeEventListener('wheel', this.aoRoda)
    window.removeEventListener('resize', this.aoRedimensionar)
    window.removeEventListener('scroll', this.aoRolar)
    gsap.killTweensOf(this.trans)
    this.renderer.dispose()
  }
}
