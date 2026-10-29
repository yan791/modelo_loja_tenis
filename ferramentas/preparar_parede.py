# Prepara a textura da parede a partir de duas texturas CC0 da Poly Haven (polyhaven.com):
#   "Beige Wall 001": grão fino de tinta sobre reboco (cor e relevo)
#   "Plastered Wall 04" (Rob Tuytel): só a variação suave de tom, bem desfocada (sem os furos de concreto)
# Lê material/parede-original/*_2k.jpg (baixados de dl.polyhaven.org) e grava em site/public/parede:
#   cor.webp / cor-m.webp        cinza neutro (o tom final vem do material na cena)
#   normal.webp / normal-m.webp  relevo da pintura (formato OpenGL, igual ao three.js)
# python ferramentas/preparar_parede.py
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

raiz = Path(__file__).resolve().parent.parent
origem = raiz / 'material' / 'parede-original'
saida = raiz / 'site' / 'public' / 'parede'
saida.mkdir(parents=True, exist_ok=True)

grao = np.asarray(Image.open(origem / 'beige_wall_001_diff_2k.jpg').convert('L')).astype(np.float32)
manchas = Image.open(origem / 'plastered_wall_04_diff_2k.jpg').convert('L').filter(ImageFilter.GaussianBlur(48))
manchas = np.asarray(manchas).astype(np.float32)
cor = 200 + (grao - grao.mean()) * 2.6 + (manchas - manchas.mean()) * 0.55
cor = Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8)).convert('RGB')
normal = Image.open(origem / 'beige_wall_001_nor_gl_2k.jpg').convert('RGB')

for img, nome, q in ((cor, 'cor', 84), (normal, 'normal', 86)):
    img.save(saida / f'{nome}.webp', quality=q, method=6)
    img.resize((1024, 1024), Image.LANCZOS).save(saida / f'{nome}-m.webp', quality=q, method=6)
for f in sorted(saida.iterdir()):
    print(f'{f.name:14s} {f.stat().st_size // 1024} KB')
