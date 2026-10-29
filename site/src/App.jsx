import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Vitrine } from './cena/Vitrine.js'
import { marca, produtos, reais, dois } from './dados/loja.js'
import { Marca, Lupa } from './componentes/Icones.jsx'
import { Titulo, Compra } from './componentes/Produto.jsx'
import { PainelSacola, PainelSobre } from './componentes/Paineis.jsx'

const indiceDoHash = () => {
  const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  const i = produtos.findIndex((p) => p.slug === slug)
  return i >= 0 ? i : null
}

const CHAVE_SACOLA = 'vitrine-sacola'
const lerSacola = () => {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_SACOLA))
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}

const toque = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function App() {
  const canvas = useRef(null)
  const palcoParede = useRef(null)
  const palcoProduto = useRef(null)
  const rotulos = useRef([])
  const pontos = useRef([])
  const vitrine = useRef(null)
  const ativoRef = useRef(indiceDoHash())
  const rolagemGuardada = useRef(0)

  const [fase, setFase] = useState('carregando') // carregando | pronto | erro
  const [progresso, setProgresso] = useState(0)
  const [ativo, setAtivo] = useState(ativoRef.current)
  const [mostrado, setMostrado] = useState(ativoRef.current ?? 0) // o painel do produto continua com o último enquanto some
  const [visita, setVisita] = useState(0)
  const [entrada, setEntrada] = useState('longe') // longe: veio da parede | perto: trocou de vizinho
  const [hover, setHover] = useState(null)
  const [rolagem, setRolagem] = useState(0)
  const [painel, setPainel] = useState(null) // sacola | sobre
  const [sacola, setSacola] = useState(lerSacola)
  const [zoom, setZoom] = useState(false)
  const [detalhe, setDetalhe] = useState(null) // ponto de detalhe aberto no produto
  const [recado, setRecado] = useState(null)
  const [aviso, setAviso] = useState('')

  const ir = useCallback((i, { historico = true } = {}) => {
    const antes = ativoRef.current
    if (i === antes) return
    if (antes == null) rolagemGuardada.current = window.scrollY
    ativoRef.current = i
    setEntrada(antes != null && i != null ? 'perto' : 'longe')
    if (i != null) {
      setMostrado(i)
      setVisita((v) => v + 1)
    }
    setAtivo(i)
    setHover(null)
    setDetalhe(null)
    if (historico) history.pushState(null, '', i == null ? location.pathname + location.search : `#/${produtos[i].slug}`)
  }, [])

  // cena 3D: criada uma vez
  useEffect(() => {
    let vivo = true
    let v
    try {
      v = new Vitrine(canvas.current, {
        progresso: (p) => vivo && setProgresso(p),
        hover: (i) => vivo && setHover(i),
        selecionar: (i) => ir(i),
        rolagem: (px) => vivo && setRolagem(px),
        palcos: () => ({ parede: palcoParede.current.getBoundingClientRect(), produto: palcoProduto.current.getBoundingClientRect() }),
        rotulos: () => rotulos.current,
        pontos: () => pontos.current,
        zoom: (z) => {
          if (!vivo) return
          setZoom(z)
          if (!z) setDetalhe(null)
        },
        arrastou: () => vivo && setDetalhe(null),
      })
    } catch (e) {
      console.error(e)
      setFase('erro')
      return
    }
    vitrine.current = v
    if (import.meta.env.DEV || location.search.includes('teste')) window.__vitrine = v
    v.carregar(produtos)
      .then(() => vivo && v.iniciar(ativoRef.current))
      .then(() => vivo && setFase('pronto'))
      .catch((e) => {
        console.error(e)
        if (vivo) setFase('erro')
      })
    return () => {
      vivo = false
      v.destruir()
      vitrine.current = null
    }
  }, [ir])

  // troca de tela: trava a rolagem no produto e devolve a posição ao voltar para a parede
  const primeira = useRef(true)
  useLayoutEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    if (ativo == null) window.scrollTo(0, rolagemGuardada.current)
    vitrine.current?.slots.length && vitrine.current.irPara(ativo)
  }, [ativo])

  useEffect(() => {
    const f = () => ir(indiceDoHash(), { historico: false })
    window.addEventListener('popstate', f)
    return () => window.removeEventListener('popstate', f)
  }, [ir])

  useEffect(() => {
    const f = (e) => {
      if (painel || e.target.closest?.('input, select, textarea, [role="listbox"]')) return
      const a = ativoRef.current
      if (a == null) return
      const n = produtos.length
      const det = produtos[a].detalhes || []
      if (detalhe != null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        // com um detalhe aberto, as setas passeiam pelos detalhes do mesmo tênis
        verDetalhe((detalhe + (e.key === 'ArrowRight' ? 1 : det.length - 1)) % det.length)
        return
      }
      if (e.key === 'Escape') {
        // com zoom, o Esc primeiro afasta; depois volta para a parede
        if (vitrine.current?.zoomAlvo > 1.05) vitrine.current.definirZoom(1)
        else ir(null)
      }
      else if (e.key === 'ArrowRight') ir((a + 1) % n)
      else if (e.key === 'ArrowLeft') ir((a + n - 1) % n)
    }
    document.addEventListener('keydown', f)
    return () => document.removeEventListener('keydown', f)
  }, [painel, ir, detalhe])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola))
    } catch {
      /* navegação privada: a sacola vale só nesta visita */
    }
  }, [sacola])

  useEffect(() => {
    if (!recado) return
    const t = setTimeout(() => setRecado(null), 3800)
    return () => clearTimeout(t)
  }, [recado])

  const adicionar = (slug, tamanho) => {
    setSacola((s) => {
      const j = s.findIndex((x) => x.slug === slug && x.tamanho === tamanho)
      if (j < 0) return [...s, { slug, tamanho, qtd: 1 }]
      return s.map((x, k) => (k === j ? { ...x, qtd: x.qtd + 1 } : x))
    })
    const p = produtos.find((x) => x.slug === slug)
    setRecado({ nome: p.nome, tamanho, chave: Date.now() })
  }
  const alterar = (it, d) => setSacola((s) => s.map((x) => (x.slug === it.slug && x.tamanho === it.tamanho ? { ...x, qtd: Math.max(1, x.qtd + d) } : x)))
  const remover = (it) => setSacola((s) => s.filter((x) => !(x.slug === it.slug && x.tamanho === it.tamanho)))
  const finalizar = (linhas, total) => {
    if (!marca.whatsapp) {
      setAviso('Protótipo: nesta etapa entram frete, Pix e cartão.')
      return
    }
    const texto = ['Olá! Quero fazer este pedido:', ...linhas.map((it) => `• ${it.p.nome} (${it.p.cor}), BR ${it.tamanho}, ${it.qtd}x`), `Subtotal: ${reais(total)}`].join('\n')
    window.open(`https://wa.me/${marca.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }
  // leva a câmera até o detalhe j do tênis em foco
  function verDetalhe(j) {
    const d = produtos[ativoRef.current]?.detalhes?.[j]
    // durante o voo da câmera os pontos ainda estão chegando: no celular, o clique que o navegador
    // dispara logo depois do toque no tênis cairia num ponto e abriria um detalhe sem querer
    if (!d || vitrine.current?.trans.de) return
    setDetalhe(j)
    vitrine.current?.focarDetalhe(d.x, d.y)
  }

  const fecharPainel = useCallback(() => {
    setPainel(null)
    setAviso('')
  }, [])

  const qtd = sacola.reduce((s, x) => s + x.qtd, 0)
  const n = produtos.length
  const modo = ativo == null ? 'parede' : 'produto'
  const status =
    modo === 'produto'
      ? 'Clique nos pontos para ver cada detalhe. Use as setas para trocar de modelo.'
      : hover != null
        ? `${produtos[hover].nome} · ${reais(produtos[hover].preco)}. Clique para ver de perto.`
        : 'Passe o mouse para iluminar. Clique para explorar.'

  return (
    <div className={`app modo-${modo} fase-${fase} entrada-${entrada}${zoom ? ' com-zoom' : ''}${detalhe != null ? ' com-detalhe' : ''}`}>
      <canvas ref={canvas} className="cena" aria-hidden="true" />
      <div className="vinheta" aria-hidden="true" />
      <div ref={palcoParede} className="palco palco--parede" aria-hidden="true" />
      <div ref={palcoProduto} className="palco palco--produto" aria-hidden="true" />
      {/* altura extra de rolagem: no celular a parede tem 5 fileiras e a câmera desce junto com a página */}
      <div className="rolagem" style={{ height: modo === 'parede' && rolagem ? `calc(100lvh + ${rolagem}px)` : undefined }} />

      <header className="topo">
        <a
          className="logo"
          href="./"
          aria-label={`${marca.nome}. Voltar à coleção`}
          onClick={(e) => {
            e.preventDefault()
            ir(null)
          }}
        >
          <Marca className="logo__marca" />
          <span>
            {marca.nome}
            <b>.</b>
          </span>
        </a>
        <nav className="menu" aria-label="Menu principal">
          {modo === 'parede' ? (
            <span className="menu__item menu__item--ativo menu__item--colecao" aria-current="page">
              Coleção <sup>01</sup>
            </span>
          ) : (
            <button type="button" className="menu__item" onClick={() => ir(null)}>
              <span aria-hidden="true">←</span> Coleção
            </button>
          )}
          <button type="button" className="menu__item menu__item--sobre" onClick={() => setPainel('sobre')}>
            Sobre
          </button>
        </nav>
        <button type="button" className="topo__sacola" onClick={() => setPainel('sacola')}>
          Sacola ({dois(qtd)})
        </button>
      </header>

      <section className="intro" aria-hidden={modo !== 'parede'}>
        <p className="olho">Calçados / {marca.colecao}</p>
        <h1>{marca.slogan}</h1>
        <p className="intro__dica">Toque em um tênis. Encontre a sua perspectiva.</p>
      </section>

      <nav className="indice" aria-label="Escolha um modelo">
        {produtos.map((p, i) => (
          <button key={p.slug} type="button" onClick={() => ir(i)} onFocus={() => modo === 'parede' && vitrine.current?.definirHover(i)}>
            {p.nome}, {p.cor}, {reais(p.preco)}
          </button>
        ))}
      </nav>

      <div className="rotulos" aria-hidden="true">
        {produtos.map((p, i) => (
          <div key={p.slug} ref={(el) => (rotulos.current[i] = el)} className={`rotulo${hover === i ? ' rotulo--ativo' : ''}`}>
            <span className="rotulo__nome">{p.nome}</span>
            <span className="rotulo__preco">{reais(p.preco)}</span>
            <span className="rotulo__sub">
              {dois(i + 1)} / {marca.nome}
            </span>
          </div>
        ))}
      </div>

      <section className="produto" aria-hidden={modo !== 'produto'} aria-label="Produto">
        <div className="produto__esq" key={`t${mostrado}-${visita}`}>
          <Titulo indice={mostrado} />
        </div>
        <div className="produto__dir" key={`c${mostrado}-${visita}`}>
          <Compra indice={mostrado} aoAdicionar={adicionar} />
        </div>
        <div className="produto__nav">
          <button type="button" aria-label="Modelo anterior" onClick={() => ir((mostrado + n - 1) % n)}>
            ←
          </button>
          <span>
            {dois(mostrado + 1)} <em>/</em> {dois(n)}
          </span>
          <button type="button" aria-label="Próximo modelo" onClick={() => ir((mostrado + 1) % n)}>
            →
          </button>
        </div>
        <div className="marcadores" key={`p${mostrado}-${visita}`}>
          {(produtos[mostrado].detalhes || []).map((d, j) => (
            <button
              key={j}
              type="button"
              ref={(el) => (pontos.current[j] = el)}
              className={`marcador${detalhe === j ? ' marcador--ativo' : ''}`}
              style={{ '--j': j }}
              onClick={() => verDetalhe(j)}
              aria-label={`Ver detalhe: ${d.titulo}`}
            >
              <span className="marcador__miolo">
                <span className="marcador__anel" />
                {j + 1}
              </span>
              <span className="marcador__dica">{d.titulo}</span>
            </button>
          ))}
        </div>
        {detalhe != null && produtos[mostrado].detalhes?.[detalhe] && (
          <div className="legenda" key={`l${mostrado}-${detalhe}`} role="status">
            <p className="olho">
              Detalhe {dois(detalhe + 1)} / {dois(produtos[mostrado].detalhes.length)}
            </p>
            <strong>{produtos[mostrado].detalhes[detalhe].titulo}</strong>
            <p className="legenda__texto">{produtos[mostrado].detalhes[detalhe].texto}</p>
            <div className="legenda__nav">
              <button type="button" aria-label="Detalhe anterior" onClick={() => verDetalhe((detalhe + produtos[mostrado].detalhes.length - 1) % produtos[mostrado].detalhes.length)}>
                ←
              </button>
              <button type="button" aria-label="Próximo detalhe" onClick={() => verDetalhe((detalhe + 1) % produtos[mostrado].detalhes.length)}>
                →
              </button>
              <button type="button" className="legenda__afastar" onClick={() => vitrine.current?.definirZoom(1)}>
                <Lupa className="icone" /> Afastar
              </button>
            </div>
          </div>
        )}
        <p className="dica-zoom">
          <Lupa className="icone" /> {toque ? 'Toque nos pontos para ver de perto' : 'Clique nos pontos ou role para aproximar'}
        </p>
        <button type="button" className="afastar" onClick={() => vitrine.current?.definirZoom(1)} tabIndex={zoom ? 0 : -1}>
          <Lupa className="icone" /> Afastar
        </button>
      </section>

      <footer className="rodape">
        <span className="rodape__serie">
          <i className="ponto" aria-hidden="true" /> {marca.colecao} <em>/</em> {n} modelos
        </span>
        <p className="rodape__status" role="status">
          {status}
        </p>
        <button type="button" className="rodape__sobre" onClick={() => setPainel('sobre')}>
          Sobre a loja <span aria-hidden="true">↗</span>
        </button>
      </footer>

      {recado && (
        <div className="recado" key={recado.chave} role="status">
          <span className="olho">Adicionado à sacola</span>
          <strong>
            {recado.nome} · BR {recado.tamanho}
          </strong>
          <button type="button" className="link" onClick={() => setPainel('sacola')}>
            Ver sacola <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}

      <PainelSacola aberto={painel === 'sacola'} itens={sacola} fechar={fecharPainel} alterar={alterar} remover={remover} finalizar={finalizar} aviso={aviso} />
      <PainelSobre aberto={painel === 'sobre'} fechar={fecharPainel} />

      <div className="carregando" aria-hidden={fase === 'pronto'}>
        <div className="carregando__marca">
          <Marca className="logo__marca" />
          <span>
            {marca.nome}
            <b>.</b>
          </span>
        </div>
        <div className="carregando__barra">
          <i style={{ transform: `scaleX(${progresso})` }} />
        </div>
        <p>{fase === 'erro' ? 'Não foi possível abrir a vitrine 3D neste navegador.' : `Montando a vitrine · ${Math.round(progresso * 100)}%`}</p>
      </div>
    </div>
  )
}
