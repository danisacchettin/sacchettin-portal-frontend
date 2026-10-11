# Instruções para o próximo agente — Portal do Cliente (frontend)

Atualizado em 11/10/2026. Leia este arquivo inteiro antes de mexer. Ele deve ser atualizado em TODO deploy.

## Antes de começar (regra do Project)
1. Validar no GitHub o último commit da `main` (danisacchettin/sacchettin-portal-frontend). Não confiar em clone local antigo: `git fetch origin` e partir de `origin/main`.
2. Conferir PRs abertos (#24 deve ser fechado sem merge; #28 aguarda rebase sobre a `main` atual).

## Estado desta atualização
- Filtro do painel "A pagar": Dia / Semana / Mês / Todos, setas ‹ ›, "Ir para a data", "Voltar para hoje". Funções novas em index.html: `pagarOffsetPara`, `pagarIntervalo`, `pagarMudarTipo`, `pagarNavegar`, `pagarIrParaData`; `filtroPagar = {tipo, offset, credor, busca}`; `tabelasPagar()` e `renderPagarPanel()` reescritos nesse ponto. O select `#filtroMesPagar` não existe mais.
- Só frontend. Backend, banco e cálculo de saldo não foram alterados.

## Como o projeto funciona
- Frontend: index.html único + scripts externos, Render static site com autoDeploy na `main` (~10 s). Backend Express (repo privado sacchettin-portal-backend) + Postgres no Render.
- Cliente em produção: Casa de Carnes Cristal (empresa_id=1).
- Regras da Dani: nunca pedir/digitar senhas ou tokens; não alterar dados de produção/SQL sem ok explícito (migrations vão como arquivo para ela rodar no Beekeeper); backend só por diff que ela aplica após "Create export" no Render; ela mesma faz o merge dos PRs; exclusões no portal são soft delete; auditoria segue PARCIAL; "Em conferência" é só proposta até ela aprovar.

## Testes
- Sintaxe: extrair os `<script>` inline e rodar `node --check`.
- Playwright com API simulada (`teste_pagar_2026-10-11.py` guardado no Project em `claude/`): relógio fixo, 25 verificações.

## Pendências conhecidas
- `todayISO()` ainda é UTC (vira o dia ~21h de Brasília) — usado em outros painéis; o A pagar já usa data local.
- Backend: boleto obrigatório só quando forma = Boleto (diff pronto, aguardando ok da Dani).
- Conferir contrato 3 (HASHTAG SISTEMAS) com 25 parcelas ativas; anexar o PDF.
- Demais itens no Project: `claude/*.md` (mais recente: A-PAGAR-FILTRO-DIA-SEMANA-DATA-2026-10-11.md).
