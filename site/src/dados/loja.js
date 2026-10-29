// Tudo o que é texto ou dado da loja fica aqui. Trocar o nome e os produtos do cliente começa por este arquivo.
// As imagens dos tênis ficam em public/tenis/NN.webp, na mesma ordem desta lista (ferramentas/recortar.py gera).

export const marca = {
  nome: 'SOLA',
  colecao: 'Série 01',
  slogan: 'Uma outra perspectiva.',
  instagram: 'https://instagram.com/',
  // Número com DDI e DDD, só dígitos (ex.: 5581999999999). Vazio = o botão de finalizar avisa que é protótipo.
  whatsapp: '',
}

export const loja = {
  tamanhos: [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44],
  guia: { 34: '22,5', 35: '23,0', 36: '23,5', 37: '24,5', 38: '25,0', 39: '25,5', 40: '26,5', 41: '27,0', 42: '27,5', 43: '28,5', 44: '29,0' },
}

// cor: usada na sacola (amostras) e na luz de destaque de cada prateleira
export const produtos = [
  {
    slug: 'brasa-01',
    nome: 'BRASA 01',
    linha: 'Corrida',
    preco: 649,
    cor: 'Coral / Âmbar',
    amostras: ['#f07a45', '#f3a25e', '#e8b27a'],
    frase: 'Linhas esculpidas sobre uma sola de bolhas translúcidas.',
    ficha: [['Cabedal', 'Malha técnica em relevo'], ['Entressola', 'Bolhas de ar translúcidas'], ['Cadarço', 'Tom sobre tom'], ['Indicação', 'Corrida e dia a dia']],
  },
  {
    slug: 'mata-02',
    nome: 'MATA 02',
    linha: 'Cano alto',
    preco: 599,
    cor: 'Off-white / Verde mata',
    amostras: ['#ece6d8', '#1f4d33', '#f4f2ec'],
    frase: 'Cano alto em couro, com fivela no tornozelo.',
    ficha: [['Cabedal', 'Couro liso'], ['Fechamento', 'Cadarço e tira com fivela'], ['Sola', 'Borracha reta'], ['Indicação', 'Uso casual']],
  },
  {
    slug: 'anil-03',
    nome: 'ANIL 03',
    linha: 'Corrida',
    preco: 689,
    cor: 'Azul cobalto / Branco',
    amostras: ['#1f4fd8', '#f2f2f2', '#6f9cff'],
    frase: 'Gomos acolchoados sobre bolhas de ar em azul.',
    ficha: [['Cabedal', 'Painéis acolchoados e malha'], ['Entressola', 'Bolhas de ar azuis'], ['Bico', 'Couro branco'], ['Indicação', 'Corrida e dia a dia']],
  },
  {
    slug: 'quartzo-04',
    nome: 'QUARTZO 04',
    linha: 'Chunky',
    preco: 629,
    cor: 'Lilás / Creme',
    amostras: ['#b9a2dd', '#efe8d6', '#cdbbe9'],
    frase: 'Volumes macios em camadas e sola ondulada.',
    ficha: [['Cabedal', 'Camurça e couro sintético'], ['Detalhe', 'Dois puxadores no calcanhar'], ['Sola', 'Grossa e ondulada'], ['Indicação', 'Uso casual']],
  },
  {
    slug: 'grafite-05',
    nome: 'GRAFITE 05',
    linha: 'Trilha',
    preco: 719,
    cor: 'Grafite / Oliva / Laranja',
    amostras: ['#2f3130', '#5d6b3a', '#ff6a1a'],
    frase: 'Perfil robusto, cadarço com trava e cravos profundos.',
    ficha: [['Cabedal', 'Malha com reforços'], ['Biqueira', 'Borracha protegida'], ['Solado', 'Cravos profundos'], ['Indicação', 'Trilha e cidade']],
  },
]

export const reais = (v) => `R$ ${v.toLocaleString('pt-BR')}`
export const dois = (n) => String(n).padStart(2, '0')
