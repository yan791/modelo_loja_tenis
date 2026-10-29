import { useEffect } from 'react'
import { marca, produtos, reais } from '../dados/loja.js'

function useEsc(aberto, fechar) {
  useEffect(() => {
    if (!aberto) return
    const f = (e) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', f)
    return () => document.removeEventListener('keydown', f)
  }, [aberto, fechar])
}

const Amostra = ({ cores }) => (
  <span className="amostra" aria-hidden="true">
    {cores.map((c) => (
      <i key={c} style={{ background: c }} />
    ))}
  </span>
)

export function PainelSacola({ aberto, itens, fechar, alterar, remover, finalizar, aviso }) {
  useEsc(aberto, fechar)
  const linhas = itens.map((it) => ({ ...it, p: produtos.find((p) => p.slug === it.slug) })).filter((it) => it.p)
  const total = linhas.reduce((s, it) => s + it.p.preco * it.qtd, 0)
  return (
    <div className={`gaveta${aberto ? ' gaveta--aberta' : ''}`} aria-hidden={!aberto}>
      <div className="gaveta__fundo" onClick={fechar} />
      <aside className="gaveta__painel" role="dialog" aria-modal="true" aria-label="Sacola">
        <header className="gaveta__topo">
          <p className="olho">Sua sacola</p>
          <button type="button" className="fechar" onClick={fechar}>
            Fechar <span aria-hidden="true">×</span>
          </button>
        </header>
        {linhas.length === 0 ? (
          <div className="gaveta__vazia">
            <p>A sacola está vazia.</p>
            <button type="button" className="link" onClick={fechar}>
              Voltar à parede <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : (
          <>
            <ul className="itens">
              {linhas.map((it) => (
                <li key={`${it.slug}-${it.tamanho}`} className="item">
                  <Amostra cores={it.p.amostras} />
                  <div className="item__info">
                    <strong>{it.p.nome}</strong>
                    <span>
                      {it.p.cor} · BR {it.tamanho}
                    </span>
                    <div className="item__qtd">
                      <button type="button" aria-label="Diminuir" onClick={() => alterar(it, -1)}>
                        −
                      </button>
                      <span>{it.qtd}</span>
                      <button type="button" aria-label="Aumentar" onClick={() => alterar(it, 1)}>
                        +
                      </button>
                      <button type="button" className="link item__remover" onClick={() => remover(it)}>
                        Remover
                      </button>
                    </div>
                  </div>
                  <span className="item__preco">{reais(it.p.preco * it.qtd)}</span>
                </li>
              ))}
            </ul>
            <footer className="gaveta__rodape">
              <div className="gaveta__total">
                <span>Subtotal</span>
                <strong>{reais(total)}</strong>
              </div>
              <button type="button" className="pilula pilula--pronta pilula--cheia" onClick={() => finalizar(linhas, total)}>
                <span className="pilula__texto">
                  <strong>Finalizar pedido</strong>
                  <small>{marca.whatsapp ? 'Continue pelo WhatsApp' : 'Frete e pagamento na próxima etapa'}</small>
                </span>
                <span className="pilula__icone" aria-hidden="true">
                  ↗
                </span>
              </button>
              {aviso && <p className="gaveta__aviso">{aviso}</p>}
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

export function PainelSobre({ aberto, fechar }) {
  useEsc(aberto, fechar)
  return (
    <div className={`sobre${aberto ? ' sobre--aberto' : ''}`} aria-hidden={!aberto}>
      <div className="sobre__fundo" onClick={fechar} />
      <section className="sobre__cartao" role="dialog" aria-modal="true" aria-labelledby="sobre-titulo">
        <button type="button" className="fechar" onClick={fechar}>
          Fechar <span aria-hidden="true">×</span>
        </button>
        <p className="olho">
          {marca.nome}. / Sobre a loja
        </p>
        <h2 id="sobre-titulo">
          Cada par em destaque.
          <br />
          Uma outra perspectiva.
        </h2>
        <p>Cada modelo fica na parede como numa loja de verdade. Chegue perto, aproxime a imagem e confira cada detalhe antes de escolher o seu.</p>
        <div className="sobre__passos">
          <span>01 / Percorra a parede</span>
          <span>02 / Escolha o seu modelo</span>
          <span>03 / Aproxime e confira</span>
        </div>
        <p className="sobre__nota">Protótipo de demonstração. Nomes, preços e estoque são ilustrativos.</p>
        <button type="button" className="link" onClick={fechar}>
          Ver a coleção <span aria-hidden="true">↗</span>
        </button>
      </section>
    </div>
  )
}
