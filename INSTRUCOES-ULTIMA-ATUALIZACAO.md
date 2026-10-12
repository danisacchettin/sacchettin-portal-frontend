# Instruções para o próximo agente — Portal do Cliente (frontend)

Atualizado em 12/10/2026. Leia este arquivo inteiro antes de mexer. Ele deve ser atualizado em TODO deploy.

## Antes de começar (regra do Project)
1. Validar no GitHub o último commit da `main` (danisacchettin/sacchettin-portal-frontend). Não confiar em clone local antigo: `git fetch origin` e partir de `origin/main`. Última `main` validada: d689c44 (12/10/2026).
2. Conferir PRs abertos: #24 deve ser fechado sem merge (superado); #28 (cards) precisa ser refeito sobre a `main` atual; #30, #31 e #32 abaixo aguardam merge da Dani.

## Modo de trabalho pedido pela Dani (11/10/2026)
- A cada comando dela, pensar e dizer ANTES se há implicação ruim (algo que já funciona e pode quebrar) e como foi evitada.
- Sempre que houver sugestão de melhoria ou de integração entre telas/dados, propor (e fazer, quando for seguro e dentro das regras abaixo).
- Meta do portal: ser um ERP integrado, fácil de entender e usar, para decisões estratégicas baseadas em números confiáveis do negócio.

## PRs abertos (todos aguardando o merge da Dani; agente nunca faz merge)
- #31 — A pagar: filtro por Dia / Semana / Mês / Todos, setas, "Ir para a data", "Voltar para hoje". Branch `feat/pagar-filtro-dia-semana` (30632aa). Funções novas em index.html: `pagarOffsetPara`, `pagarIntervalo`, `pagarMudarTipo`, `pagarNavegar`, `pagarIrParaData`; `filtroPagar = {tipo, offset, credor, busca}`. O select `#filtroMesPagar` não existe mais. 25 verificações Playwright, 0 falhas.
- #30 — PDV: selo da coluna Fechamento em "Dias e fechamento": hoje = "em andamento" (neutro); dia passado com fechamento abaixo das vendas = "fechamento desatualizado" (vermelho). Branch `fix/pdv-selo-em-andamento` (d9526ee), só `pdv_vendas.js`.
- #32 — PDV: lucro bruto estimado (margem, markup, cobertura de custo) no Resumo e coluna "Lucro est." em Dias e fechamento, só escritório. Branch `feat/pdv-lucro-do-dia` (bd720e9), EMPILHADA sobre o #30 (mesclar #30 antes). Depende do ajuste de backend `claude/AJUSTE-BACKEND-pdv-lucro-2026-10-11.md` (3 trocas em pdvRelatorios.js). Sem o ajuste a tela não muda. Fonte: pdv_vendas_itens.custo_total (custo do AutoPlus; ~81% da venda de mercadoria tem custo; estimativa).

## Notas de entrada (SEFAZ) — construído, ainda NÃO publicado
- PR #33 (aberto, aguardando merge da Dani, DEPOIS do backend). Branch `feat/notas-entrada` (frontend, commit 8a34a15): novo `notas_entrada.js` + 4 ganchos em `index.html` (script, card `#btnNotasEntrada`, listener, item de menu "Notas de entrada" no grupo Financeiro). Tabela com Nº da nota, Emissão, Forma de pagamento prevista, Status, Emissor (+CNPJ), Optante Simples, Valor e vínculo com A pagar; a linha abre cartão em formato de NF (itens com quantidade, peso e valor), sugestão pré-preenchida de lançamento (a cliente/escritório só autoriza), vincular a lançamento existente, dispensar, baixar XML, "Sincronizar agora" (só escritório).
- **Ordem obrigatória:** o backend vai ANTES. Pacote `NOTAS-DE-ENTRADA-BACKEND-2026-10-11.zip` (migration 026 aditiva, `src/nfe/*`, `src/routes/nfeEntrada.js`, testes, `APLICAR-server.js.diff.txt` com 2 linhas em server.js + deps `node-forge` e `xml-crypto`). Sem o backend o painel mostra erro ao clicar (nada mais quebra).
- Envs no Render (backend): NFE_PFX_PATH (Secret File), NFE_PFX_SENHA, NFE_CNPJ=32051232000165 (M A ARDIGO COMÉRCIO DE CARNES LTDA, informado pela Dani em 12/10), NFE_UF_AUTOR=PR (cUF 41), NFE_AMBIENTE (1 produção / 2 homologação), NFE_AUTO_SYNC=1, NFE_EMPRESA_ID=1; opcionais NFE_DIST_URL, NFE_EVENTO_URL, NFE_CA_PATH. O .pfx e a senha só a Dani coloca no Render; nunca por chat.
- Decisões da Dani: certificado A1; só Ciência da Operação automática (conclusivas manuais); nenhum outro sistema baixa as NFs; visível ao escritório e ao cliente.
- NÃO testado ao vivo: aceitação real da Ciência pela SEFAZ, URLs de produção/homologação, cadeia TLS ICP-Brasil (pode exigir NFE_CA_PATH). Testes locais: parser, SOAP simulado, certificado sintético, assinatura, migration 2x, idempotência, rotas, permissões, isolamento por empresa.
- Não altera contas_pagar nem rotas existentes; lançamentos criados usam origem 'Documento'. O número do boleto continua obrigatório quando a forma é Boleto (regra atual).
- Só 33 de 123 fornecedores têm CNPJ: o casamento por CNPJ cobre parte; há botão "completar cadastro".

## Modernização (APROVADA pela Dani em 12/10/2026) — diagnóstico e plano
- `claude/DIAGNOSTICO-MODERNIZACAO-V1-2026-10-11.md`: auditoria somente leitura da V1 (dados, indicadores, ERP, plano incremental). Aprovado, com condições abaixo.
- **Condição inegociável:** a Cristal está em PRODUÇÃO usando o PDV. Nada pode atrapalhar a versão vigente. Por isso a nova versão é um ambiente PARALELO e a cliente escolhe o momento de trocar.
- **Identidade DSSJ (vinho) deve migrar para todos** (cliente, escritório, Fernando) e também para o Portal Jurídico. A V2 existe só no computador da Dani (`~/.codex/.chatgpt-projects/g-p-6abaf24e712081919a6a320c7c6f9d3e/sites/cristal-v2`, Next/Cloudflare, backend próprio): serve APENAS como referência visual; nenhum dado/código dela é usado.
- Elemento elegante para alternar entre o Jurídico e o Financeiro da Cristal (mesma identidade): feito na nova versão (ver abaixo). O código do Portal Jurídico AINDA NÃO FOI LOCALIZADO (a Dani indicou a conversa "CPO RECONCILIADOR CHATGPT PORTAL JURIDICO", que o agente não consegue abrir): pedir o zip/pasta ou o endereço publicado. Enquanto isso o botão "Jurídico" avisa que não foi ligado (`novo/config.js` → `juridicoUrl`).

## Nova versão em /novo (PR da branch `feat/versao-nova-dssj`, sem merge)
- **Arquitetura:** pasta `novo/` no MESMO site estático (Render publica o repositório inteiro, `publishPath` "."). Mesmo domínio ⇒ mesmo login (localStorage), mesma API e mesmo banco, sem mudar CORS. Por isso mudanças de backend devem ser sempre ADITIVAS (as duas versões convivem). O PDV Bot só fala com o backend: o frontend não o afeta.
- **`novo/index.html` é GERADO** por `python3 tools/gerar_novo.py` a partir do `index.html` da raiz (+ cópia dos .js). Nunca editar à mão; rodar o gerador sempre que a raiz mudar (inclusive depois dos merges de #30–#33, para a nova versão ganhar PDV/lucro/Notas de entrada). O gerador falha em voz alta se um trecho esperado sumir.
- Escritos à mão em `novo/`: `tema-dssj.css` (tokens vinho + menu flutuante arredondado + Bodoni Moda itálico nos títulos), `dssj-shell.js` (marca DSSJ, seletor Jurídico ⇄ Financeiro só para o escritório, "Voltar à versão anterior"), `config.js`, `assets/` (fonte Bodoni Moda itálico e monograma DS, copiados da V2).
- **Na versão vigente** o único acréscimo é UMA linha em `index.html` (`<script src="versao-nova.js" defer>`) + o arquivo `versao-nova.js`. Com `habilitado:false` (padrão) a cliente NÃO vê nada; a equipe do escritório vê o convite como pré-visualização. Para liberar à cliente: trocar `habilitado:false` por `true` em `versao-nova.js` (1 linha, PR, merge da Dani). Para mostrar só num navegador: `?novaversao=ver` (e `?novaversao=ocultar`). `?versao=atual` volta à vigente e lembra a escolha. Se `habilitado:true` e a cliente escolheu a nova, ela é levada direto à nova nos acessos seguintes; `habilitado:false` desliga isso para todos (chave geral).
- **Reversão:** `habilitado:false`; ou remover a linha do `index.html` e `versao-nova.js`; ou apagar a pasta `novo/`. Nada de dados é alterado.
- **Testes** (39 verificações Playwright com API simulada, 0 falhas): vigente idêntica (verde p/ cliente, vinho p/ escritório) com o convite oculto; convite por perfil/flag; redirecionamento só com flag ligada; nova versão vinho para cliente e escritório; seletor visível só ao escritório; Jurídico sem/com endereço; `?layout=antigo` não contamina a vigente; celular (menu sem fresta, sem rolagem horizontal); contraste dos pares principais ≥ 4,5:1 (menu 11,1:1; texto secundário 5,9:1; destaque #8C4358 sobre fundo 6,1:1). Não medido: contraste de todas as telas internas e o comportamento de impressão da nova.
- **NÃO verificado (dizer com clareza):** (1) `/novo/` servindo corretamente no Render (sem preview de PR; só confirmável depois do merge; as regras de rewrite/redirect do site não aparecem na API consultada); (2) o código do Portal Jurídico; (3) a nova versão ainda não inclui Notas de entrada/#30–#32 porque a base é a `main` (regerar depois dos merges).
- Depois de mergear: abrir `https://portal.daniellesacchettin.com.br/novo/` (com a barra final), conferir login e o Painel; só então decidir quando ligar o convite à cliente.

## Como o projeto funciona
- Frontend: index.html único (+ `novo/` gerado) + scripts externos (pdv_vendas.js, custo_produto.js, carga_tributaria.js, maquininhas.js, notas_entrada.js no branch), Render static site com autoDeploy na `main` (~10 s). Backend Express (repo privado sacchettin-portal-backend) + Postgres no Render (leitura via Render MCP somente leitura).
- Cliente em produção: Casa de Carnes Cristal (empresa_id=1).
- Regras da Dani: nunca pedir/digitar senhas, tokens ou certificado; não alterar dados de produção/SQL sem ok explícito (migrations vão como arquivo para ela rodar no Beekeeper); backend só por diff que ela aplica após "Create export" no Render; ela mesma faz o merge dos PRs; exclusões no portal são soft delete; auditoria segue PARCIAL; "Em conferência" é só proposta até ela aprovar.
- Restrição "só administrador" das telas do PDV é visual; a API devolve o mesmo a qualquer autenticado, exceto os campos novos de custo (gate por papel no diff do #32).

## Publicação (armadilhas já vistas)
- Push só pelo GitHub Desktop. O app tem DOIS cadastros do mesmo repositório; o certo é o que mostra as branches novas (o primeiro da lista, com contador). Branch criada com `checkout -b ... origin/main` herda upstream `origin/main`: usar `--no-track` ou `git branch --unset-upstream <branch>` antes, para o botão ser "Publish branch" e nunca empurrar para a main. Reiniciar o app derruba a permissão de controle.
- Para entregar arquivo grande ao clone: gerar na nuvem, SendUserFile e `device_commit_files`; edição pequena: python com asserts via device_bash.
- PR: criado pelo Chrome (compare/<base>...<branch>); a integração GitHub do agente só lê. O botão "Create pull request" muda de lugar conforme o tamanho do texto.
- Evitar `find ~`: dispara avisos de privacidade do macOS.

## Testes
- Sintaxe: extrair os `<script>` inline e rodar `node --check` (e em cada .js).
- Playwright com API simulada: `claude/teste_pagar_2026-10-11.py` (A pagar, relógio fixo). Para o PDV, harness com `/api/pdv-relatorios/*` simulado; `innerText` aplica text-transform: conferir com `textContent`.

## Pendências conhecidas
- `todayISO()` ainda é UTC (vira o dia ~21h de Brasília) — usado em outros painéis; o A pagar já usa data local.
- Backend: boleto obrigatório só quando forma = Boleto (diff pronto, aguardando ok da Dani); custo por dia do PDV (#32).
- Conferir contrato 3 (HASHTAG SISTEMAS) com 25 parcelas ativas; anexar o PDF.
- Aprovada em 12/10: migrar a identidade DSSJ também para o Portal Jurídico (aguarda o código dele); decidir a data de ligar o convite à cliente; regerar `novo/` após os merges.
- Sugestões de integração: lista "itens vendidos sem custo" e alerta "vendido abaixo do custo" no PDV; ligar o custo das compras ao PDV para CMV; levar o lucro bruto ao Fechamento de caixa e ao DRE só depois de validado.
- Demais itens no Project: `claude/*.md`.
