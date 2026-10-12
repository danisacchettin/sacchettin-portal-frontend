#!/usr/bin/env python3
"""Gera novo/index.html (e copia os scripts) a partir do index.html da versão vigente.

Uso (na raiz do repositório):  python3 tools/gerar_novo.py
Rode de novo sempre que o index.html ou algum .js da raiz mudar, para a nova versão acompanhar a vigente.
Não toca em nenhum arquivo da raiz. Falha (com mensagem) se algum trecho esperado não for encontrado,
para nunca gerar uma versão nova "meio aplicada".
Arquivos escritos à mão em novo/: config.js, dssj-shell.js, tema-dssj.css, assets/ (este script não os altera).
"""
import re, shutil, sys, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
NOVO = RAIZ / 'novo'
html = (RAIZ / 'index.html').read_text(encoding='utf-8')

def trocar(texto, antigo, novo, rotulo):
    n = texto.count(antigo)
    if n != 1:
        sys.exit(f'ERRO: trecho "{rotulo}" encontrado {n} vez(es); esperado 1. A vigente mudou: ajuste tools/gerar_novo.py.')
    return texto.replace(antigo, novo)

# 1) layout novo sempre ligado e classe dssj; sem mexer na chave 'layoutNovo' que a versão vigente usa
ini = html.index('(function(){\n  var desligado = false;')
fim_marca = "if(!desligado) document.body.classList.add('layout-novo');\n})();"
fim = html.index(fim_marca) + len(fim_marca)
html = html[:ini] + "(function(){ document.body.classList.add('layout-novo','dssj'); })();" + html[fim:]

# 2) tema vinho DSSJ para todos os perfis (cliente, escritório e Fernando)
html = trocar(html,
  "document.body.classList.toggle('tema-escritorio', !!(u && u.papel === 'escritorio'));",
  "document.body.classList.add('tema-escritorio','dssj'); document.body.classList.toggle('papel-escritorio', !!(u && u.papel === 'escritorio'));",
  'tema-escritorio')
html = trocar(html,
  "document.body.classList.toggle('tema-laranja', !!(u && u.papel === 'escritorio' && temaLaranjaDoUsuario(u)));",
  "document.body.classList.remove('tema-laranja');",
  'tema-laranja')
# tela de login mantém a identidade
html = trocar(html,
  "document.body.classList.remove('tema-escritorio'); document.body.classList.remove('tema-laranja'); document.getElementById('loginScreen')",
  "document.body.classList.remove('papel-escritorio'); document.body.classList.remove('tema-laranja'); document.getElementById('loginScreen')",
  'showLogin')

# 3) identidade da nova versão
html = trocar(html, '<head>', '<head>\n<!-- GERADO por tools/gerar_novo.py a partir de ../index.html — não editar à mão -->\n<meta name="robots" content="noindex">', '<head>')
html = trocar(html, '</head>',
  '<link rel="stylesheet" href="tema-dssj.css">\n<script src="config.js"></script>\n<script src="dssj-shell.js" defer></script>\n</head>', '</head>')

(NOVO).mkdir(exist_ok=True)
(NOVO / 'index.html').write_text(html, encoding='utf-8')

# 4) scripts locais referenciados pelo index.html (cópia fiel)
copiados = []
for nome in sorted(set(re.findall(r'<script src="([A-Za-z0-9_\-]+\.js)"', (RAIZ / 'index.html').read_text(encoding='utf-8')))):
    if nome == 'versao-nova.js':
        continue
    origem = RAIZ / nome
    if not origem.exists():
        sys.exit(f'ERRO: {nome} é referenciado pelo index.html mas não existe na raiz.')
    shutil.copyfile(origem, NOVO / nome)
    copiados.append(nome)
print('novo/index.html gerado;', 'scripts copiados:', ', '.join(copiados))
