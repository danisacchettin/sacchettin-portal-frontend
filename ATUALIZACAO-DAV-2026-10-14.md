# DAV — filtro de Situação no cabeçalho + baixa em lote (14/10/2026)

Arquivo alterado: `dav.js` apenas (nenhuma mudança em `index.html` nem no backend).

## O que mudou
1. **Filtro de Situação no próprio cabeçalho da coluna** (Todas / Vencidos / A vencer / Pagos). Vale na tela DAV do menu e no cartão do Fechamento de caixa. Com a lista vazia o cabeçalho continua na tela (dá para voltar a Todas).
2. **Caixa de seleção em cada linha** + caixa no cabeçalho (seleciona todos os pedidos em aberto da lista filtrada). Pedido já recebido fica desabilitado. A seleção só vale para o que está visível: ao filtrar, linhas que saem da tela são desmarcadas.
3. **Botão "Dar baixa nos selecionados"**: abre uma tela (modal `#overlayBaixa`, a mesma da baixa de A receber) com a lista, data do recebimento (não aceita futura), forma (obrigatória), conta bancária/PIX/Caixa (obrigatória) e observação. Confirmar faz UMA chamada por pedido, em sequência, para a rota JÁ EXISTENTE `POST /api/contas-receber/:id/baixa` com o saldo inteiro do pedido. Nada novo no backend.
4. O nº do pedido virou um botão (expande os produtos pelo teclado); clicar na linha continua expandindo; clicar na caixa não expande.

## Onde a baixa aparece (verificado no código do backend, `src/routes/contasReceber.js`)
- A rota, numa única transação, marca o título como `Pago Total`, grava `data_recebimento` e insere uma entrada em `caixa_bancos` com `data_mov` = data do recebimento, forma e conta escolhidas. O Fluxo/Fechamento de caixa lê `caixaMovimentos` por essa data: o valor entra no caixa DO DIA DO RECEBIMENTO (não no do vencimento). O servidor só cria essa entrada quando há conta bancária; por isso a conta é obrigatória na tela.
- DRE: a receita bruta usa `valor_original` por mês de VENCIMENTO (regime de competência, `openDRE`). A baixa não altera esse valor; o pedido já compõe o DRE no mês do vencimento. Se a decisão for reconhecer a receita pela data do recebimento, é uma mudança de regra do DRE (não feita aqui).
- Observação (anterior a esta mudança): `openDRE` não filtra títulos `Cancelado` ao somar a receita; `fcPrevisto` filtra. Conferir se o `/api/dashboard/resumo` já exclui cancelados.

## Riscos / cuidados
- Não existe "desfazer baixa" de A receber no portal (só "Editar baixa" para A pagar). Testar primeiro com UM pedido pequeno.
- Falha no meio do lote: cada pedido é independente; os que falharam continuam selecionados e a mensagem lista o nº de cada um. Se a conexão cair sem resposta, o título pode ter sido baixado: conferir a coluna Situação antes de repetir (a tela recarrega os dados do servidor).
- Forma "Dinheiro" deve ir para a conta Caixa; PIX/TED/Cartão/Boleto para conta bancária (a tela pergunta se não combinar).

## Testes
`claude/teste_dav_2026-10-13.py` (Playwright, API simulada, relógio fixo 13/10/2026): 90 verificações OK, incluindo seleção, poda ao filtrar, validações do modal, POSTs enviados, entrada no caixa na data do recebimento, Fechamento do dia, DRE inalterado, falha parcial, cartão do Fechamento e mobile. NÃO testado contra o servidor real (o agente não loga em produção).
