import { useEffect, useRef, useState } from 'react'
import { marca, loja, produtos, reais, dois } from '../dados/loja.js'
import { Sacola, Seta } from './Icones.jsx'

const toque = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// Título letra a letra: cada letra sobe com um pequeno atraso
function Letras({ texto }) {
  return [...texto].map((l, i) => (
    <span key={i} className="letra" style={{ '--i': i }}>
      {l === ' ' ? ' ' : l}
    </span>
  ))
}

export function Titulo({ indice }) {
  const p = produtos[indice]
  return (
    <div className="produto-titulo">
      <p className="olho surgir" style={{ '--d': 0 }}>
        {marca.nome} / {dois(indice + 1)}
      </p>
      <h2 className="titulo-produto" aria-label={p.nome}>
        <Letras texto={p.nome} />
      </h2>
      <p className="frase surgir" style={{ '--d': 2 }}>
        {p.frase}
      </p>
    </div>
  )
}

export function Compra({ indice, aoAdicionar }) {
  const p = produtos[indice]
  const [tamanho, setTamanho] = useState(null)
  const [lista, setLista] = useState(false)
  const [aviso, setAviso] = useState(false)
  const [ficha, setFicha] = useState(false)
  const [feito, setFeito] = useState(false)
  const caixa = useRef(null)

  useEffect(() => {
    if (!lista) return
    const fora = (e) => !caixa.current?.contains(e.target) && setLista(false)
    const esc = (e) => e.key === 'Escape' && setLista(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [lista])

  const escolher = (t) => {
    setTamanho(t)
    setAviso(false)
    setLista(false)
  }

  const adicionar = () => {
    if (!tamanho) {
      setAviso(true)
      if (!toque) setLista(true)
      return
    }
    aoAdicionar(p.slug, tamanho)
    setFeito(true)
    setTimeout(() => setFeito(false), 1800)
  }

  return (
    <div className="compra">
      <p className="olho surgir" style={{ '--d': 0 }}>
        {marca.colecao} / {p.linha}
      </p>
      <div className="compra__linha surgir" style={{ '--d': 1 }}>
        <span className="compra__cor">{p.cor}</span>
        <span className="compra__preco">{reais(p.preco)}</span>
      </div>

      <div className="compra__rotulo surgir" style={{ '--d': 2 }}>
        <span>Escolha seu tamanho</span>
        <span>BR</span>
      </div>
      <div className={`seletor surgir${aviso ? ' seletor--aviso' : ''}${lista ? ' seletor--aberto' : ''}`} style={{ '--d': 2 }} ref={caixa}>
        <button type="button" className="seletor__botao" aria-haspopup="listbox" aria-expanded={lista} onClick={() => setLista((v) => !v)} tabIndex={toque ? -1 : 0}>
          <span>{tamanho ? `BR ${tamanho}` : 'Selecione um tamanho'}</span>
          <Seta className="icone" />
        </button>
        {toque ? (
          <select className="seletor__nativo" aria-label="Tamanho" value={tamanho ?? ''} onChange={(e) => escolher(+e.target.value)}>
            <option value="" disabled>
              Selecione um tamanho
            </option>
            {loja.tamanhos.map((t) => (
              <option key={t} value={t}>
                BR {t}
              </option>
            ))}
          </select>
        ) : (
          <div className="seletor__lista" role="listbox" aria-label="Tamanhos">
            {loja.tamanhos.map((t) => (
              <button key={t} type="button" role="option" aria-selected={tamanho === t} className={tamanho === t ? 'ativo' : ''} onClick={() => escolher(t)}>
                <span>{t}</span>
                <small>{loja.guia[t]} cm</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className={`pilula surgir${tamanho ? ' pilula--pronta' : ''}${feito ? ' pilula--feito' : ''}`} style={{ '--d': 3 }} onClick={adicionar}>
        <span className="pilula__texto">
          <strong>{feito ? 'Adicionado à sacola' : 'Adicionar à sacola'}</strong>
          <small>{tamanho ? `BR ${tamanho} · ${reais(p.preco)}` : aviso ? 'Escolha um tamanho para continuar' : 'Escolha seu tamanho para continuar'}</small>
        </span>
        <span className="pilula__icone">
          <Sacola className="icone" />
        </span>
      </button>

      <div className={`ficha surgir${ficha ? ' ficha--aberta' : ''}`} style={{ '--d': 4 }}>
        <button type="button" className="ficha__botao" aria-expanded={ficha} onClick={() => setFicha((v) => !v)}>
          <span>Detalhes do modelo</span>
          <span className="ficha__mais" aria-hidden="true" />
        </button>
        <div className="ficha__corpo">
          <dl>
            <div>
              <dt>Cor</dt>
              <dd>{p.cor}</dd>
            </div>
            {p.ficha.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
