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

// amostras: cores da sacola. detalhes: pontos na foto (x, y de 0 a 1 a partir do canto de cima à esquerda)
export const produtos = [
  {
    slug: 'brasa-01',
    detalhes: [
      { x: 0.4, y: 0.8, titulo: 'Bolhas de ar translúcidas', texto: 'Câmaras de ar ao longo de toda a sola, que amortecem cada passada.' },
      { x: 0.33, y: 0.46, titulo: 'Malha esculpida', texto: 'Relevos em ondas que acompanham o movimento do pé.' },
      { x: 0.56, y: 0.3, titulo: 'Cadarço tom sobre tom', texto: 'O mesmo coral do cabedal, do bico ao calcanhar.' },
    ],
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
    detalhes: [
      { x: 0.25, y: 0.33, titulo: 'Tira com fivela', texto: 'Ajusta o tornozelo e dá firmeza ao cano alto.' },
      { x: 0.82, y: 0.63, titulo: 'Bico perfurado', texto: 'Furos de ventilação no couro do bico.' },
      { x: 0.17, y: 0.15, titulo: 'Gola acolchoada', texto: 'Acolchoamento macio em volta do tornozelo.' },
    ],
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
    detalhes: [
      { x: 0.42, y: 0.43, titulo: 'Gomos acolchoados', texto: 'Painéis estofados em couro, com costura aparente.' },
      { x: 0.38, y: 0.78, titulo: 'Bolhas de ar azuis', texto: 'Câmaras translúcidas do calcanhar ao bico.' },
      { x: 0.9, y: 0.62, titulo: 'Bico em couro branco', texto: 'Reforço na ponta e contraste com o azul.' },
    ],
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
    detalhes: [
      { x: 0.08, y: 0.17, titulo: 'Dois puxadores', texto: 'Ajudam a calçar e marcam o desenho do calcanhar.' },
      { x: 0.5, y: 0.76, titulo: 'Sola ondulada', texto: 'Camadas de espuma que formam ondas na lateral.' },
      { x: 0.46, y: 0.4, titulo: 'Volumes em camadas', texto: 'Painéis sobrepostos em camurça e couro sintético.' },
    ],
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
    detalhes: [
      { x: 0.49, y: 0.15, titulo: 'Cadarço com trava', texto: 'Ajuste rápido, sem precisar dar laço.' },
      { x: 0.93, y: 0.6, titulo: 'Biqueira de borracha', texto: 'Protege a ponta contra pedras e raízes.' },
      { x: 0.3, y: 0.9, titulo: 'Cravos profundos', texto: 'Tração na terra, na pedra e no asfalto molhado.' },
    ],
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
