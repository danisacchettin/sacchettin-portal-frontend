# Atualização 13/10/2026 — DAV no menu e no Fechamento de caixa

Pedido da Danielle. Para qualquer agente de IA que continue o trabalho: leia também o `INSTRUCOES-ULTIMA-ATUALIZACAO.md` do projeto (Portal DSSJ) e valide no GitHub a última atualização antes de começar.

## O que mudou (portal atual, raiz do repositório)
1. **Menu "DAV"** no grupo *Relatórios*, logo abaixo de *PDV*. Abre uma tela com: Nº do pedido, Cliente, Data do pedido, Vencimento (data do pedido + 7 dias) e Valor (+ Situação).
   Filtros: cliente/nº do pedido, data do pedido (início e término) e vencimento (início e término). Ordenação clicando no cabeçalho.
2. **Produtos de cada pedido** (item, quantidade, valor unitário e valor): clicar na linha expande. Taxa de entrega aparece separada nos subtotais.
3. **Menu "Fechamento de caixa"** no grupo *Financeiro*, logo abaixo de *A receber* (aciona o mesmo cartão já existente).
4. **Fechamento de caixa → DAV**: o cabeçalho "DAV", o total do período e cada dia/mês da coluna DAV viram botões. Clicar abre um **cartão expansível** com a mesma lista (e os mesmos produtos), já filtrada pelo vencimento do período/dia clicado, com o botão "Abrir a tela DAV completa".

## Arquivos
- `dav.js` (novo): toda a lógica. Só LÊ `DATA.contasReceber`; não grava, não altera A receber, Fechamento, DRE ou fluxo.
- `index.html`: +1 `<script src="dav.js">`, +1 cartão `#btnDAV` (o menu aciona esse cartão, como os demais itens), +2 itens em `MENU`, e em `openFechamentoPanel` o cabeçalho/células DAV chamam `davCab/davCelula/davCelulaTotal` (com fallback para o texto simples se `dav.js` não carregar) + `<div id="fcDavCard">`.

## Regras de dados
- DAV = título de A receber com categoria `CLIENTE DISTRIBUIDORA` (`FC_CAT_DAV`), status diferente de Cancelado. Nº do pedido = `documento`; data do pedido = `data_compra`; vencimento = `vencimento` (D+7 nos 175 de 250 títulos com data; o resto são lançamentos manuais antigos — marcados com "†" quando o prazo não é 7 dias).
- O total do cartão do Fechamento é o mesmo valor da coluna DAV do Fechamento para o mesmo período (usa `valor_original`, como `fcPrevisto`). Verificado no teste.
- Datas: usa a data local do navegador (o `todayISO()` do portal é UTC — bug conhecido, não mexido aqui).

## Itens dos pedidos — depende do backend
Os produtos vêm de `GET /api/dav/itens?numeros=1001,1002` (rota nova, somente leitura, em `src/routes/davItens.js`, montada em `server.js` ANTES do handler 404 de `app.use((req,res)=>res.status(404)...)`). Lê `pdv_registros_brutos` (fonte `pedidos_consolidados`) e a unidade em `pdv_produtos`. **Sem a rota, a lista funciona normalmente e cada pedido mostra "falta atualizar o servidor (rota /api/dav/itens)".** O servidor responde `{erro:'Rota não encontrada.'}` quando a rota não existe; `dav.js` trata esse texto e `Erro 404`.
Cobertura medida em 13/10/2026: 233 dos 258 títulos DAV têm itens no AutoPlus; 16 têm soma dos itens diferente do valor do título (a tela avisa); 15 títulos não têm nº de pedido.

## Testes (Playwright com API simulada, relógio fixo em 13/10/2026)
Roteiro `claude/teste_dav_2026-10-13.py` (no projeto Portal DSSJ, fora do repositório) — menu (ordem/grupos), colunas, filtros inclusivos, ordenação, itens, aviso de divergência, 404 do servidor, perfil cliente, cartão do Fechamento (período, dia, trimestre), total conciliado com o Fechamento, mobile 390px, sem erros de JS.

## Cuidados para merge (PRs abertos #30–#33 mexem em `index.html`)
Mudanças em pontos isolados: `<script>` após `custo_produto.js`, cartão após `#btnPDV`, itens de MENU após `pdv` e `receber`, e 3 trechos dentro de `openFechamentoPanel`. Se houver conflito, resolver mantendo as duas versões.

## Pendente
- Aplicar a rota do backend (pacote entregue à parte) e conferir um pedido real.
- A versão `/novo` (PR #35) não inclui estas mudanças; regenerar com `tools/gerar_novo.py` depois dos merges.
