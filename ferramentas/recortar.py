# Recorta as imagens dos tênis e prepara para as prateleiras do site.
#
# Lê material/tenis-ia/01.png, 02.png... (cópias numeradas das imagens geradas por IA, na ordem de
# src/dados/loja.js). Para cada imagem:
#   1. fundo: usa a transparência da imagem só quando ela é limpa. O ChatGPT às vezes pinta um fundo
#      "falso" (névoa cinza, xadrez desenhado); nesses casos o fundo sai com o rembg (BiRefNet)
#   2. bordas: estima a cor verdadeira dos pixels semitransparentes (sem halo do fundo antigo)
#      e espalha a cor para fora do recorte, para a filtragem da GPU não puxar branco
#   3. corta rente ao tênis e grava site/public/tenis/NN.webp (2048 px) e NN-m.webp (1024 px, celular)
#   4. tenis.json com tamanho, onde fica a sola (base) e bytes de cada arquivo
#
# python ferramentas/recortar.py [--so=03,05] [--modelo=birefnet-general]   (o modelo do rembg baixa sozinho na primeira vez)
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

raiz = Path(__file__).resolve().parent.parent
entrada = raiz / 'material' / 'tenis-ia'
saida = raiz / 'site' / 'public' / 'tenis'
saida.mkdir(parents=True, exist_ok=True)
so = next((a.split('=')[1].split(',') for a in sys.argv if a.startswith('--so=')), None)
modelo_ia = next((a.split('=')[1] for a in sys.argv if a.startswith('--modelo=')), 'isnet-general-use')

_sessao = None


def sem_fundo(img):
    global _sessao
    from rembg import remove, new_session
    if _sessao is None:
        _sessao = new_session(modelo_ia)
    return remove(img, session=_sessao, post_process_mask=True)


def transparencia_limpa(rgba):
    a = np.asarray(rgba)[..., 3].astype(np.float32) / 255
    fora = (a < 0.02).mean()
    meio = ((a > 0.05) & (a < 0.95)).mean()
    return fora > 0.2 and meio < 0.03


def preparar(caminho):
    img = Image.open(caminho)
    rgba = img.convert('RGBA')
    if transparencia_limpa(rgba):
        modo = 'alfa da imagem'
    else:
        # achata sobre cinza neutro antes de recortar (a névoa semitransparente vira fundo comum)
        plano = Image.new('RGB', rgba.size, (128, 128, 128))
        plano.paste(rgba, mask=rgba.split()[3])
        rgba = sem_fundo(plano).convert('RGBA')
        modo = 'fundo removido'
    arr = np.asarray(rgba).astype(np.float32) / 255.0
    cor, alfa = arr[..., :3], arr[..., 3]

    try:
        from pymatting import estimate_foreground_ml
        cor = estimate_foreground_ml(cor.astype(np.float64), alfa.astype(np.float64)).astype(np.float32)
    except Exception as e:
        print('  aviso: sem estimativa de borda', e)
    cheio = Image.fromarray((np.clip(cor, 0, 1) * 255).astype(np.uint8))
    mascara = Image.fromarray((alfa > 0.5).astype(np.uint8) * 255)
    borrado = cheio
    for raio in (2, 6, 16, 40):
        bn = np.asarray(cheio.filter(ImageFilter.GaussianBlur(raio))).astype(np.float32)
        mn = np.asarray(mascara.filter(ImageFilter.GaussianBlur(raio))).astype(np.float32)[..., None] / 255.0
        media = np.where(mn > 0.02, bn / np.maximum(mn, 1e-3), 0)
        fora = (alfa < 0.5)[..., None] & (mn > 0.02)
        borrado = Image.fromarray(np.clip(np.where(fora, media, np.asarray(borrado).astype(np.float32)), 0, 255).astype(np.uint8))
    rgb = np.where((alfa > 0.5)[..., None], np.asarray(cheio), np.asarray(borrado))

    ys, xs = np.where(alfa > 0.03)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    folga = int((x1 - x0) * 0.015)
    x0, y0 = max(0, x0 - folga), max(0, y0 - folga)
    x1, y1 = min(alfa.shape[1] - 1, x1 + folga), min(alfa.shape[0] - 1, y1 + folga)
    final = np.dstack([rgb, (alfa * 255).astype(np.uint8)])[y0:y1 + 1, x0:x1 + 1]
    # base: altura (fração da imagem, de baixo para cima) onde a sola encosta
    solido = np.where((final[..., 3] > 128).any(axis=1))[0]
    base = (final.shape[0] - 1 - solido.max()) / final.shape[0]
    return Image.fromarray(final, 'RGBA'), modo, base


arquivos = sorted(entrada.glob('[0-9][0-9].png'))
anterior = {r['n']: r for r in json.loads((saida / 'tenis.json').read_text())} if (saida / 'tenis.json').exists() else {}
info = []
for caminho in arquivos:
    n = caminho.stem
    if so and n not in so and n in anterior:
        info.append(anterior[n])
        continue
    recorte, modo, base = preparar(caminho)
    l, a = recorte.size
    registro = {'n': n, 'largura': l, 'altura': a, 'base': round(base, 4)}
    for sufixo, alvo in (('', 2048), ('-m', 1024)):
        escala = min(1, alvo / l)
        img = recorte.resize((round(l * escala), round(a * escala)), Image.LANCZOS) if escala < 1 else recorte
        arq = saida / f'{n}{sufixo}.webp'
        img.save(arq, quality=92, method=6, exact=True)
        registro['bytes' + sufixo.replace('-', '_')] = arq.stat().st_size
    info.append(registro)
    print(f'{n}: {modo}, {l}x{a}, base {base:.3f}, {registro["bytes"] // 1024} KB / {registro["bytes_m"] // 1024} KB')
(saida / 'tenis.json').write_text(json.dumps(info, indent=1))
