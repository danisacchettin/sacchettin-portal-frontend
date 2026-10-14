/* ==========================================================================================
   DAV — pedidos da distribuidora (pedido da Danielle, 13/10/2026).
   DAV = pedido de venda a prazo emitido no AutoPlus para a distribuidora. No portal ele entra em
   A receber, categoria CLIENTE DISTRIBUIDORA, com vencimento = data da compra + 7 dias.
   Este arquivo só LÊ DATA.contasReceber (já carregado pela tela); não grava nada, não chama a API
   e não altera A receber, Fechamento de caixa, DRE ou fluxo.

   Telas:
     - openDavPanel(): item de menu "DAV" (grupo Relatórios, abaixo de PDV). Colunas: nº do pedido,
       cliente, data do pedido, vencimento, valor (+ situação). Filtros: cliente, data do pedido
       (de/até) e vencimento (de/até).
     - davFechamentoToggle(): no Fechamento de caixa, clicar em "DAV" abre esta mesma lista num
       cartão expansível dentro do próprio Fechamento, já filtrada pelo período/dia clicado.
   Depende de index.html: DATA, saldoAberto, fmtBRL, fmtDate, escapeHtml, openOverlay, closeOverlay,
   openDetalhesForItem, normalizarBusca, FC_CAT_DAV (se existir).
   ========================================================================================== */
(function davEstilo(){
  if (document.getElementById('davStyle')) return;
  const st = document.createElement('style'); st.id = 'davStyle';
  st.textContent = `
  .dav-filtros{display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin:0 0 12px;}
  .dav-filtros label{display:flex; flex-direction:column; gap:4px; font-size:11px; letter-spacing:.3px; color:var(--ink-faint);}
  .dav-filtros input{font:inherit; font-size:13px; padding:7px 9px; border:1px solid rgba(27,43,58,.2); border-radius:8px; background:var(--paper-2,#fff); color:var(--ink); min-width:140px;}
  .dav-filtros .dav-q{flex:1; min-width:200px;}
  .dav-filtros select{font:inherit; font-size:13px; padding:7px 9px; border:1px solid rgba(27,43,58,.2); border-radius:8px; background:var(--paper-2,#fff); color:var(--ink); min-width:150px;}
  .dav-grupo{display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; padding:0 0 0 10px; border-left:2px solid rgba(27,43,58,.12);}
  .dav-grupo .dav-gt{flex:0 0 100%; font-size:11px; font-weight:600; color:var(--ink-soft); letter-spacing:.3px; margin-bottom:-2px;}
  .dav-erro{color:var(--red); font-size:12.5px; margin:0 0 8px; min-height:0;}
  .dav-resumo{display:flex; gap:18px; flex-wrap:wrap; font-size:12.5px; color:var(--ink-soft); margin:0 0 8px;}
  .dav-resumo b{color:var(--ink);}
  .dav-tabela{overflow-x:auto;}
  .dav-tabela th .dav-ord{all:unset; cursor:pointer; font:inherit; color:inherit; letter-spacing:inherit; text-transform:inherit; display:inline-flex; gap:4px; align-items:center;}
  .dav-tabela th .dav-ord:focus-visible{outline:2px solid var(--nav-accent, #5a2132); outline-offset:2px;}
  .dav-tabela td.n, .dav-tabela th.n{text-align:right; white-space:nowrap;}
  .dav-tabela tr.dav-row.clic{cursor:pointer;}
  .dav-tabela tr.dav-total td{font-weight:600; border-top:2px solid rgba(27,43,58,.25);}
  .dav-sit{font-size:11px; padding:2px 8px; border-radius:10px; white-space:nowrap; display:inline-block;}
  .dav-sit.ok{background:var(--olive-wash,#e6f1ea); color:var(--olive,#1f6b47);}
  .dav-sit.vencido{background:var(--red-wash,#f8e5e2); color:var(--red,#b3402f);}
  .dav-sit.aberto{background:var(--gold-wash,#f6efdc); color:#6b5316;}
  .dav-tabela tr.dav-row .dav-seta{display:inline-block; width:14px; color:var(--ink-faint); transition:transform .15s;}
  .dav-tabela tr.dav-row.aberta .dav-seta{transform:rotate(90deg);}
  .dav-tabela tr.dav-det > td{background:var(--paper,#f8f5f0); padding:12px 14px; border-top:0;}
  .dav-itens{width:100%; border-collapse:collapse; font-size:12.5px; background:var(--paper-2,#fff); border:1px solid rgba(27,43,58,.12);}
  .dav-itens th{font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:var(--ink-faint); text-align:left; padding:6px 8px; border-bottom:1px solid rgba(27,43,58,.2); background:transparent; position:static;}
  .dav-itens td{padding:6px 8px; border-bottom:1px solid rgba(27,43,58,.08); background:transparent;}
  .dav-itens th.n, .dav-itens td.n{text-align:right; white-space:nowrap;}
  .dav-itens tr.taxa td{color:var(--ink-soft); font-style:italic;}
  .dav-itens tfoot td{font-weight:600; border-bottom:0;}
  .dav-det-aviso{font-size:12px; margin:8px 0 0; color:var(--ink-soft);}
  .dav-det-aviso.alerta{color:var(--red);}
  .dav-det-acoes{margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;}
  .dav-nota{font-size:11.5px; color:var(--ink-soft); margin:8px 0 0; line-height:1.5;}
  .dav-vazio{font-size:13px; color:var(--ink-soft); padding:14px 0;}
  .dav-card{border:1px solid rgba(27,43,58,.18); border-radius:10px; background:var(--paper-2,#fff); padding:14px 16px; margin:14px 0;}
  .dav-card[hidden]{display:none;}
  .dav-card-cab{display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; margin:0 0 10px;}
  .dav-card-cab h4{margin:0; font-size:14px;}
  .dav-card-cab p{margin:2px 0 0; font-size:12px; color:var(--ink-soft);}
  .dav-link{all:unset; cursor:pointer; color:var(--gold, #8a6d2f); text-decoration:underline; text-underline-offset:3px; font-weight:600;}
  .dav-link:focus-visible{outline:2px solid var(--nav-accent, #5a2132); outline-offset:2px;}
  .dav-link[aria-expanded="true"]{color:var(--ink);}
  .dav-tabela th.dav-chk, .dav-tabela td.dav-chk{width:34px; text-align:center; padding-left:6px; padding-right:6px;}
  .dav-tabela input[type=checkbox]{width:17px; height:17px; cursor:pointer; accent-color:var(--nav-accent,#5a2132);}
  .dav-tabela input[type=checkbox]:disabled{cursor:not-allowed; opacity:.35;}
  .dav-tabela .dav-exp{all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:2px;}
  .dav-tabela .dav-exp:focus-visible{outline:2px solid var(--nav-accent,#5a2132); outline-offset:2px;}
  .dav-th-sit{white-space:nowrap;}
  .dav-th-sit select{display:block; margin-top:4px; font:inherit; font-size:12px; text-transform:none; letter-spacing:0; font-weight:400; padding:4px 6px; border:1px solid rgba(27,43,58,.25); border-radius:6px; background:var(--paper-2,#fff); color:var(--ink); max-width:150px;}
  .dav-th-sit select.filtrando{border-color:var(--nav-accent,#5a2132); box-shadow:0 0 0 1px var(--nav-accent,#5a2132);}
  .dav-barra{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:0 0 10px; padding:8px 12px; border:1px solid rgba(27,43,58,.15); border-radius:8px; background:var(--paper,#f8f5f0); font-size:12.5px; color:var(--ink-soft);}
  .dav-barra b{color:var(--ink);}
  .dav-barra .dav-barra-txt{flex:1; min-width:200px;}
  .dav-msg{font-size:12.5px; margin:0 0 10px; padding:0; color:var(--olive,#1f6b47);}
  .dav-msg:not(:empty){padding:8px 12px; border-radius:8px; background:var(--olive-wash,#e6f1ea);}
  .dav-msg.erro{color:var(--red,#b3402f); background:var(--red-wash,#f8e5e2);}
  .dav-bx-lista{max-height:230px; overflow:auto; border:1px solid rgba(27,43,58,.12); border-radius:8px; margin:0 0 12px;}
  .dav-bx-aviso{font-size:12px; color:var(--ink-soft); line-height:1.5; margin:0 0 14px; padding:10px 12px; border-left:3px solid var(--gold,#8a6d2f); background:var(--paper,#f8f5f0);}
  @media(max-width:700px){ .dav-filtros label{flex:1 1 140px;} .dav-grupo{flex:1 1 100%;} }
  @media print{ .dav-filtros{display:none;} }
  `;
  document.head.appendChild(st);
})();

/* ---------- dados ---------- */
function davCategoria(){ return (typeof FC_CAT_DAV !== 'undefined' && FC_CAT_DAV) ? FC_CAT_DAV : 'CLIENTE DISTRIBUIDORA'; }
function davNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase(); }
function davHoje(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function davDias(a, b){ // dias entre duas datas ISO (b - a), sem depender de fuso
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function davLinhas(){
  const cat = davNorm(davCategoria());
  const hoje = davHoje();
  return (DATA.contasReceber || [])
    .filter(x => x.status !== 'Cancelado' && davNorm(x.categoria) === cat)
    .map(x => {
      const compra = x.data_compra ? String(x.data_compra).slice(0, 10) : '';
      const venc = x.vencimento ? String(x.vencimento).slice(0, 10) : '';
      const valor = Number(x.valor_original || 0);
      const aberto = saldoAberto(x, 'receber');
      let sit = 'ok', rot = 'Recebido';
      if (aberto > 0) {
        sit = venc && venc < hoje ? 'vencido' : 'aberto';
        rot = (sit === 'vencido' ? 'Vencido' : 'A vencer') + (aberto < valor ? ' (parcial)' : '');
      }
      return {
        id: x.id, pedido: String(x.documento || '').trim(), cliente: String(x.cliente || '').trim(),
        compra, venc, valor, aberto, sit, rot,
        prazoAtipico: !!(compra && venc && davDias(compra, venc) !== 7),
      };
    });
}
function davFiltrar(linhas, f){
  const q = typeof normalizarBusca === 'function' ? normalizarBusca(f.q) : String(f.q || '').toLowerCase().trim();
  const norm = typeof normalizarBusca === 'function' ? normalizarBusca : (s => String(s || '').toLowerCase());
  return linhas.filter(l => {
    if (q && !norm(l.cliente).includes(q) && !norm(l.pedido).includes(q)) return false;
    if (f.sit && l.sit !== f.sit) return false;
    if (f.pIni && !(l.compra && l.compra >= f.pIni)) return false;
    if (f.pFim && !(l.compra && l.compra <= f.pFim)) return false;
    if (f.vIni && !(l.venc && l.venc >= f.vIni)) return false;
    if (f.vFim && !(l.venc && l.venc <= f.vFim)) return false;
    return true;
  });
}
function davOrdenar(linhas, s){
  const dir = s.dir;
  const cmp = {
    pedido: (a, b) => { const na = Number(a.pedido), nb = Number(b.pedido); return (a.pedido && b.pedido && !isNaN(na) && !isNaN(nb)) ? na - nb : a.pedido.localeCompare(b.pedido, 'pt-BR'); },
    cliente: (a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'),
    compra: (a, b) => a.compra.localeCompare(b.compra),
    venc: (a, b) => a.venc.localeCompare(b.venc),
    valor: (a, b) => a.valor - b.valor,
  }[s.k] || (() => 0);
  return linhas.slice().sort((a, b) => dir * (cmp(a, b) || a.pedido.localeCompare(b.pedido, 'pt-BR')));
}

/* ---------- itens do pedido (produto, quantidade, valor) ----------
   Vêm do backend (GET /api/dav/itens?numeros=...), que lê os pedidos já capturados do AutoPlus.
   Busca sob demanda, só dos pedidos abertos na tela, e guarda em memória. Se a rota ainda não
   existir no servidor (404), a tela avisa em vez de falhar. */
const davItens = {};
function davNumQ(v, casas){ return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas }); }
async function davCarregarItens(numeros){
  const faltam = numeros.filter(n => n && !davItens[n]);
  if (!faltam.length) return;
  faltam.forEach(n => { davItens[n] = { carregando: true }; });
  try {
    const r = await apiFetch('/api/dav/itens?numeros=' + encodeURIComponent(faltam.join(',')));
    const ped = (r && r.pedidos) || {};
    faltam.forEach(n => { davItens[n] = ped[n] ? { itens: ped[n].itens || [], total: ped[n].total } : { vazio: true }; });
  } catch (e) {
    const indisponivel = /^Erro 404$|^Rota n[aã]o encontrada/i.test(String(e.message)); // o servidor responde {erro:'Rota não encontrada.'} quando a rota não existe
    faltam.forEach(n => { davItens[n] = { erro: indisponivel ? 'indisponivel' : String(e.message || e) }; });
  }
}
function davEhTaxa(i){ return /^\s*TAXA DE ENT/i.test(String(i.descricao || '')); }
function davItensHtml(l){
  const d = davItens[l.pedido];
  if (!l.pedido) return '<p class="dav-det-aviso">Este título não tem nº de pedido, então não há itens vinculados.</p>';
  if (!d || d.carregando) return '<p class="dav-det-aviso" role="status">Carregando itens do pedido…</p>';
  if (d.erro === 'indisponivel') return '<p class="dav-det-aviso alerta">Os itens ainda não estão disponíveis: falta atualizar o servidor (rota /api/dav/itens).</p>';
  if (d.erro) return `<p class="dav-det-aviso alerta">Não foi possível carregar os itens: ${escapeHtml(d.erro)}</p>`;
  if (d.vazio || !d.itens.length) return '<p class="dav-det-aviso">O AutoPlus ainda não enviou os itens deste pedido.</p>';
  const taxa = d.itens.filter(davEhTaxa).reduce((a, i) => a + Number(i.valor_total || 0), 0);
  const soma = d.itens.reduce((a, i) => a + Number(i.valor_total || 0), 0);
  const merc = soma - taxa;
  const linhas = d.itens.map(i => `<tr class="${davEhTaxa(i) ? 'taxa' : ''}">
      <td>${escapeHtml(i.descricao || '(sem descrição)')}</td>
      <td class="n">${davNumQ(i.quantidade, 3)}${i.unidade ? ' ' + escapeHtml(String(i.unidade).toLowerCase()) : ''}</td>
      <td class="n">${fmtBRL(Number(i.valor_unitario || 0))}</td>
      <td class="n">${fmtBRL(Number(i.valor_total || 0))}</td></tr>`).join('');
  const dif = Math.abs(soma - l.valor) > 0.009;
  return `<table class="dav-itens"><caption class="sr-only" style="position:absolute;left:-9999px;">Itens do pedido ${escapeHtml(l.pedido)}</caption>
      <thead><tr><th scope="col">Produto</th><th scope="col" class="n">Quantidade</th><th scope="col" class="n">Valor unitário</th><th scope="col" class="n">Valor</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot>${taxa ? `<tr><td colspan="3">Mercadorias</td><td class="n">${fmtBRL(merc)}</td></tr><tr><td colspan="3">Taxa de entrega</td><td class="n">${fmtBRL(taxa)}</td></tr>` : ''}
        <tr><td colspan="3">Total dos itens</td><td class="n">${fmtBRL(soma)}</td></tr></tfoot></table>
    ${dif ? `<p class="dav-det-aviso alerta">A soma dos itens (${fmtBRL(soma)}) é diferente do valor do título (${fmtBRL(l.valor)}). Confira o pedido no AutoPlus.</p>` : ''}`;
}

/* ---------- montagem (usada pela tela do menu e pelo cartão do Fechamento) ---------- */
function davEstadoNovo(base){ return Object.assign({ q: '', sit: '', pIni: '', pFim: '', vIni: '', vFim: '', k: 'compra', dir: -1, abertos: new Set(), sel: new Set() }, base || {}); }

// mensagem do último resultado de baixa (mostrada uma vez, mesmo que a tela seja redesenhada/reaberta)
let davMsgPendente = null;
const davAberto = l => l.aberto > 0.004;

function davMontar(el, est, opcoes){
  opcoes = opcoes || {};
  const clicavel = !!opcoes.clicavel;
  el.innerHTML = `
    <div class="dav-filtros" role="search" aria-label="Filtros de DAV">
      <label class="dav-q">Cliente ou nº do pedido<input type="search" data-f="q" value="${escapeHtml(est.q)}" placeholder="Digite parte do nome"></label>
      <div class="dav-grupo" role="group" aria-label="Data do pedido"><span class="dav-gt">Data do pedido</span>
        <label>Início<input type="date" data-f="pIni" value="${est.pIni}"></label>
        <label>Término<input type="date" data-f="pFim" value="${est.pFim}"></label></div>
      <div class="dav-grupo" role="group" aria-label="Data de vencimento"><span class="dav-gt">Data de vencimento</span>
        <label>Início<input type="date" data-f="vIni" value="${est.vIni}"></label>
        <label>Término<input type="date" data-f="vFim" value="${est.vFim}"></label></div>
      <button type="button" class="btn ghost" data-dav="limpar">Limpar filtros</button>
    </div>
    <p class="dav-erro" role="alert" data-dav="erro"></p>
    <p class="dav-msg" role="status" data-dav="msg"></p>
    <div data-dav="res"></div>`;

  const elMsg = el.querySelector('[data-dav="msg"]');
  function mostrarMsg(texto, erro){ elMsg.textContent = texto || ''; elMsg.classList.toggle('erro', !!erro); }
  if (davMsgPendente) { mostrarMsg(davMsgPendente.texto, davMsgPendente.erro); davMsgPendente = null; }

  function periodoInvalido(){
    if (est.pIni && est.pFim && est.pIni > est.pFim) return 'Data do pedido: o término deve ser igual ou posterior ao início.';
    if (est.vIni && est.vFim && est.vIni > est.vFim) return 'Vencimento: o término deve ser igual ou posterior ao início.';
    return '';
  }
  function desenhar(foco){
    const erro = periodoInvalido();
    el.querySelector('[data-dav="erro"]').textContent = erro;
    const alvo = el.querySelector('[data-dav="res"]');
    if (erro) { alvo.innerHTML = ''; return; }
    const todas = davLinhas();
    const lista = davOrdenar(davFiltrar(todas, est), est);
    // só se dá baixa no que está na tela: seleção de linhas que saíram do filtro (ou já foram recebidas) é descartada
    const visiveisAbertas = new Set(lista.filter(davAberto).map(l => String(l.id)));
    Array.from(est.sel).forEach(id => { if (!visiveisAbertas.has(id)) est.sel.delete(id); });
    const escolhidas = lista.filter(l => est.sel.has(String(l.id)));
    const saldoEscolhido = escolhidas.reduce((a, l) => a + l.aberto, 0);
    const total = lista.reduce((a, l) => a + l.valor, 0);
    const aberto = lista.reduce((a, l) => a + l.aberto, 0);
    const sem = lista.filter(l => !l.compra).length;
    const atip = lista.filter(l => l.prazoAtipico).length;
    const th = (k, rot, cls) => {
      const ativo = est.k === k;
      const seta = ativo ? (est.dir === 1 ? '▲' : '▼') : '';
      return `<th scope="col" class="${cls || ''}" aria-sort="${ativo ? (est.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="dav-ord" data-ord="${k}">${rot}<span aria-hidden="true">${seta}</span></button></th>`;
    };
    const opt = (v, r) => `<option value="${v}"${est.sit === v ? ' selected' : ''}>${r}</option>`;
    const thSit = `<th scope="col" class="dav-th-sit"><span>Situação</span>
      <select data-f="sit" class="${est.sit ? 'filtrando' : ''}" aria-label="Filtrar por situação">${opt('', 'Todas')}${opt('vencido', 'Vencidos')}${opt('aberto', 'A vencer')}${opt('ok', 'Pagos (recebidos)')}</select></th>`;
    const linhas = lista.map(l => {
      const aberta = est.abertos.has(String(l.id));
      const marcada = est.sel.has(String(l.id));
      return `
      <tr class="dav-row clic${aberta ? ' aberta' : ''}${marcada ? ' marcada' : ''}" data-id="${escapeHtml(String(l.id))}" title="Clique para ver os produtos deste pedido">
        <td class="dav-chk"><input type="checkbox" data-sel="${escapeHtml(String(l.id))}" ${marcada ? 'checked' : ''} ${davAberto(l) ? '' : 'disabled title="Pedido já recebido"'} aria-label="Selecionar o pedido ${escapeHtml(l.pedido || 'sem número')} de ${escapeHtml(l.cliente || 'cliente não informado')} para dar baixa"></td>
        <td><button type="button" class="dav-exp" aria-expanded="${aberta}"><span class="dav-seta" aria-hidden="true">▸</span>${escapeHtml(l.pedido) || '—'}</button></td>
        <td>${escapeHtml(l.cliente) || '—'}</td>
        <td>${l.compra ? fmtDate(l.compra) : '—'}</td>
        <td>${l.venc ? fmtDate(l.venc) : '—'}${l.prazoAtipico ? ' <span title="Vencimento diferente de 7 dias após a compra (lançamento manual ou prazo combinado)" aria-label="prazo diferente de 7 dias">†</span>' : ''}</td>
        <td class="n">${fmtBRL(l.valor)}</td>
        <td><span class="dav-sit ${l.sit}">${l.rot}</span></td>
      </tr>${aberta ? `<tr class="dav-det" data-det="${escapeHtml(String(l.id))}"><td colspan="7"><div data-itens>${davItensHtml(l)}</div>${clicavel ? `<div class="dav-det-acoes"><button type="button" class="btn ghost" data-titulo="${escapeHtml(String(l.id))}">Ver detalhes do título</button></div>` : ''}</td></tr>` : ''}`;
    }).join('');
    const nAbertas = visiveisAbertas.size;
    const todasMarcadas = nAbertas > 0 && escolhidas.length === nAbertas;
    const corpo = lista.length
      ? linhas + `<tr class="dav-total"><td></td><td colspan="4">Total (${lista.length} pedido${lista.length > 1 ? 's' : ''})</td><td class="n">${fmtBRL(total)}</td><td></td></tr>`
      : `<tr><td colspan="7" class="dav-vazio">Nenhum pedido encontrado com esses filtros.</td></tr>`;
    alvo.innerHTML = todas.length ? `
      ${lista.length ? `<div class="dav-resumo" aria-live="polite"><span><b>${lista.length}</b> pedido(s)</span><span>Valor total: <b>${fmtBRL(total)}</b></span><span>Ainda em aberto: <b>${fmtBRL(aberto)}</b></span></div>
      <div class="dav-barra" data-dav="barra">
        <span class="dav-barra-txt">${escolhidas.length ? `<b>${escolhidas.length}</b> pedido(s) selecionado(s) · saldo a baixar <b>${fmtBRL(saldoEscolhido)}</b>` : (nAbertas ? 'Marque os pedidos na primeira coluna para dar baixa (recebimento).' : 'Nenhum pedido em aberto nesta lista para dar baixa.')}</span>
        <button type="button" class="btn gold" data-dav="baixar" ${escolhidas.length ? '' : 'disabled'}>Dar baixa nos selecionados</button>
        ${escolhidas.length ? '<button type="button" class="btn ghost" data-dav="desmarcar">Limpar seleção</button>' : ''}
      </div>` : ''}
      <div class="dav-tabela"><table class="report">
        <thead><tr><th scope="col" class="dav-chk"><input type="checkbox" data-dav="todos" ${todasMarcadas ? 'checked' : ''} ${nAbertas ? '' : 'disabled'} aria-label="Selecionar todos os pedidos em aberto desta lista"></th>${th('pedido', 'Nº do pedido')}${th('cliente', 'Cliente')}${th('compra', 'Data do pedido')}${th('venc', 'Vencimento')}${th('valor', 'Valor', 'n')}${thSit}</tr></thead>
        <tbody>${corpo}</tbody></table></div>
      <p class="dav-nota">${atip ? '† Vencimento diferente de 7 dias após a data do pedido (' + atip + '). ' : ''}${sem ? sem + ' pedido(s) sem data de pedido cadastrada: aparecem com "—" e ficam fora dos filtros de data do pedido. ' : ''}Lista os títulos a receber da categoria ${escapeHtml(davCategoria())}, exceto cancelados. A base de A receber começa em 18/08/2026.</p>`
      : `<p class="dav-vazio">Nenhum pedido encontrado com esses filtros.</p>`;
    const cabTodos = alvo.querySelector('[data-dav="todos"]');
    if (cabTodos) cabTodos.indeterminate = escolhidas.length > 0 && !todasMarcadas;
    const porId = id => lista.find(x => String(x.id) === String(id));
    const alternar = tr => {
      const id = tr.dataset.id, l = porId(id); if (!l) return;
      if (est.abertos.has(id)) { est.abertos.delete(id); if (l.pedido && davItens[l.pedido] && davItens[l.pedido].erro) delete davItens[l.pedido]; }
      else est.abertos.add(id);
      desenhar('exp:' + id);
    };
    // busca os itens dos pedidos abertos que ainda não foram carregados e atualiza só o bloco deles
    const faltantes = lista.filter(l => est.abertos.has(String(l.id)) && l.pedido && !davItens[l.pedido]);
    if (faltantes.length) {
      davCarregarItens(faltantes.map(l => l.pedido)).then(() => {
        faltantes.forEach(l => {
          const det = alvo.querySelector('tr.dav-det[data-det="' + String(l.id) + '"] [data-itens]');
          if (det) det.innerHTML = davItensHtml(l);
        });
      });
    }
    // clique na linha (fora de caixas/botões próprios) abre/fecha os produtos; o botão do nº do pedido faz o mesmo pelo teclado
    alvo.querySelectorAll('tr.dav-row').forEach(tr => {
      tr.addEventListener('click', e => { if (e.target.closest('input, select, label, [data-titulo]')) return; alternar(tr); });
    });
    alvo.querySelectorAll('input[data-sel]').forEach(c => c.addEventListener('change', () => {
      if (c.checked) est.sel.add(c.dataset.sel); else est.sel.delete(c.dataset.sel);
      desenhar('sel:' + c.dataset.sel);
    }));
    if (cabTodos) cabTodos.addEventListener('change', () => {
      if (cabTodos.checked) visiveisAbertas.forEach(id => est.sel.add(id)); else visiveisAbertas.forEach(id => est.sel.delete(id));
      desenhar('todos');
    });
    const bDes = alvo.querySelector('[data-dav="desmarcar"]');
    if (bDes) bDes.addEventListener('click', () => { est.sel.clear(); desenhar('todos'); });
    const bBx = alvo.querySelector('[data-dav="baixar"]');
    if (bBx) bBx.addEventListener('click', () => {
      davBaixaAbrir(escolhidas, (ok, falha, dados) => {
        ok.forEach(l => est.sel.delete(String(l.id)));
        const partes = [];
        if (ok.length) partes.push(`${ok.length} pedido(s) baixado(s), ${fmtBRL(ok.reduce((a, l) => a + Math.round(l.aberto * 100) / 100, 0))}, recebido(s) em ${fmtDate(dados.data)} via ${dados.forma} (${dados.contaNome}). Já entram no Fluxo e no Fechamento de caixa dessa data.`);
        if (falha.length) partes.push(`ATENÇÃO: ${falha.length} pedido(s) NÃO foram baixados: ` + falha.map(f => (f.l.pedido || 'sem nº') + ' (' + f.msg + ')').join('; ') + '. Confira a coluna Situação antes de tentar de novo.');
        davMsgPendente = { texto: partes.join(' '), erro: falha.length > 0 };
        if (typeof opcoes.aposBaixa === 'function') { opcoes.aposBaixa(); return; }
        mostrarMsg(davMsgPendente.texto, davMsgPendente.erro); davMsgPendente = null;
        desenhar();
      });
    });
    const sitSel = alvo.querySelector('[data-f="sit"]');
    if (sitSel) sitSel.addEventListener('change', () => { est.sit = sitSel.value; desenhar('sit'); });
    alvo.querySelectorAll('[data-titulo]').forEach(b => b.addEventListener('click', () => {
      if (typeof openDetalhesForItem === 'function') openDetalhesForItem('receber', b.dataset.titulo, 'receber');
    }));
    alvo.querySelectorAll('[data-ord]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.ord;
      if (est.k === k) est.dir = -est.dir; else { est.k = k; est.dir = (k === 'cliente' || k === 'pedido') ? 1 : -1; }
      desenhar();
    }));
    // devolve o foco ao controle que o usuário acabou de usar (a tabela é redesenhada a cada ação)
    if (foco) {
      let alvoFoco = null;
      if (foco === 'sit') alvoFoco = alvo.querySelector('[data-f="sit"]');
      else if (foco === 'todos') alvoFoco = alvo.querySelector('[data-dav="todos"]');
      else if (foco.startsWith('sel:')) alvoFoco = alvo.querySelector('input[data-sel="' + foco.slice(4) + '"]');
      else if (foco.startsWith('exp:')) alvoFoco = alvo.querySelector('tr.dav-row[data-id="' + foco.slice(4) + '"] .dav-exp');
      if (alvoFoco && alvoFoco.focus) alvoFoco.focus();
    }
    if (typeof opcoes.aoMudar === 'function') opcoes.aoMudar(est);
  }
  el.querySelectorAll('.dav-filtros [data-f]').forEach(inp => {
    inp.addEventListener(inp.type === 'date' ? 'change' : 'input', () => { est[inp.dataset.f] = inp.value; desenhar(); });
  });
  el.querySelector('[data-dav="limpar"]').addEventListener('click', () => {
    Object.assign(est, { q: '', sit: '', pIni: '', pFim: '', vIni: '', vFim: '' });
    el.querySelectorAll('.dav-filtros [data-f]').forEach(inp => { inp.value = ''; });
    desenhar();
  });
  desenhar();
}

/* ---------- baixa (recebimento) de vários pedidos de uma vez ----------
   Usa a MESMA rota do botão "Dar baixa" de A receber: POST /api/contas-receber/:id/baixa, uma chamada por pedido,
   em sequência. Cada chamada, no servidor e numa única transação: marca o título como recebido (Pago Total),
   grava a data do recebimento e cria a entrada correspondente em Caixa e Bancos na DATA escolhida, com forma e conta.
   É isso que faz o valor aparecer no Fluxo/Fechamento de caixa do dia do recebimento. O servidor só cria essa
   entrada quando há conta bancária/PIX/Caixa, por isso forma e conta são obrigatórias aqui.
   A receita do DRE continua sendo o valor do título no mês de vencimento (regime de competência); a baixa não a altera. */
async function davBaixaAbrir(selecionadas, aoConcluir){
  if (!selecionadas || !selecionadas.length) return;
  const painel = document.getElementById('panelBaixa'), overlay = document.getElementById('overlayBaixa');
  if (!painel || !overlay) { alert('Não foi possível abrir a tela de baixa.'); return; }
  if (typeof carregarCadastros === 'function') { try { await carregarCadastros(); } catch (e) { /* segue: a conta é obrigatória e o formulário avisa se a lista vier vazia */ } }
  const n = selecionadas.length;
  const total = selecionadas.reduce((a, l) => a + Math.round(l.aberto * 100) / 100, 0);
  const hoje = davHoje();
  const formas = ['PIX', 'Boleto', 'TED', 'Cartão', 'Dinheiro'];
  const linhas = selecionadas.map(l => `<tr><td>${escapeHtml(l.pedido) || '—'}</td><td>${escapeHtml(l.cliente) || '—'}</td><td>${l.venc ? fmtDate(l.venc) : '—'}</td><td class="n" style="text-align:right;">${fmtBRL(Math.round(l.aberto * 100) / 100)}</td></tr>`).join('');
  painel.innerHTML = `
    <div class="panel-head">
      <div><h2>Dar baixa em ${n} pedido(s) DAV</h2><p>Confira os pedidos e informe como e quando o dinheiro foi recebido.</p></div>
      <button class="close-x" type="button" data-bx="fechar" aria-label="Fechar">✕</button>
    </div>
    <div class="dav-bx-lista"><table class="report" style="margin:0;">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Vencimento</th><th style="text-align:right;">Saldo a receber</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total</strong></td><td style="text-align:right;"><strong>${fmtBRL(total)}</strong></td></tr></tfoot></table></div>
    <div class="form-grid">
      <div class="field"><label for="davBxData">Data do recebimento</label><input type="date" id="davBxData" value="${hoje}" max="${hoje}"></div>
      <div class="field"><label for="davBxForma">Forma de recebimento (obrigatória)</label>
        <select id="davBxForma"><option value="">Selecione…</option>${formas.map(f => `<option>${f}</option>`).join('')}</select></div>
      <div class="field"><label for="davBxConta">Conta bancária, PIX ou Caixa onde entrou (obrigatória)</label>
        <select id="davBxConta">${typeof optionsContaBancaria === 'function' ? optionsContaBancaria(null).replace('— Não informado —', 'Selecione…') : '<option value="">Selecione…</option>'}</select></div>
      <div class="field full"><label for="davBxObs">Observações (opcional)</label><input type="text" id="davBxObs" placeholder="Ex.: PIX único do cliente cobrindo estes pedidos"></div>
    </div>
    <p class="dav-bx-aviso">Cada pedido é baixado pelo <strong>saldo em aberto inteiro</strong> e entra em Fluxo de Caixa / Fechamento de caixa na <strong>data do recebimento</strong>, na forma e na conta escolhidas (a forma decide em qual linha do fechamento ele aparece). Para recebimento parcial de um pedido, use “Ver detalhes do título”. Não existe botão de desfazer baixa de A receber no portal: confira os dados antes de confirmar.</p>
    <p class="dav-erro" role="alert" data-bx="erro"></p>
    <div style="display:flex; gap:10px; justify-content:flex-end;">
      <button type="button" class="btn ghost" data-bx="cancelar">Cancelar</button>
      <button type="button" class="btn olive" data-bx="ok">Confirmar baixa de ${n} pedido(s) — ${fmtBRL(total)}</button>
    </div>`;
  overlay.classList.add('open');
  const fechar = () => { if (typeof closeBaixa === 'function') closeBaixa(); else overlay.classList.remove('open'); };
  painel.querySelector('[data-bx="fechar"]').addEventListener('click', fechar);
  painel.querySelector('[data-bx="cancelar"]').addEventListener('click', fechar);
  const bOk = painel.querySelector('[data-bx="ok"]'), eErro = painel.querySelector('[data-bx="erro"]');
  const rotOk = bOk.textContent;
  bOk.addEventListener('click', async () => {
    const data = painel.querySelector('#davBxData').value;
    const forma = painel.querySelector('#davBxForma').value;
    const conta = painel.querySelector('#davBxConta').value;
    const obs = painel.querySelector('#davBxObs').value.trim();
    eErro.textContent = '';
    if (!data) { eErro.textContent = 'Informe a data do recebimento.'; return; }
    if (data > hoje) { eErro.textContent = 'A data do recebimento não pode ser futura.'; return; }
    if (!forma) { eErro.textContent = 'Escolha a forma de recebimento: ela decide onde o valor aparece no fechamento de caixa e no DRE.'; return; }
    if (!conta) { eErro.textContent = 'Selecione a conta bancária, PIX ou "Caixa" onde o valor entrou. Sem isso ele não entra no fluxo/fechamento de caixa.'; return; }
    if (typeof confirmaFormaConta === 'function' && !confirmaFormaConta(forma, conta)) return;
    const contaNome = (painel.querySelector('#davBxConta').selectedOptions[0] || {}).textContent || '';
    bOk.disabled = true;
    painel.querySelectorAll('input, select').forEach(x => { x.disabled = true; });
    const ok = [], falha = [];
    const nota = `[Baixa em lote DAV: ${n} pedido(s), recebido em ${fmtDate(data)} via ${forma}]${obs ? ' ' + obs : ''}`;
    for (let i = 0; i < selecionadas.length; i++) {
      const l = selecionadas[i];
      bOk.textContent = `Baixando ${i + 1} de ${n}…`;
      try {
        await apiFetch('/api/contas-receber/' + encodeURIComponent(l.id) + '/baixa', { method: 'POST', body: JSON.stringify({
          valor: Math.round(l.aberto * 100) / 100, data, forma, conta_bancaria_id: conta, observacoes: nota }) });
        ok.push(l);
      } catch (e) { falha.push({ l, msg: String((e && e.message) || e) }); }
    }
    fechar();
    try { if (typeof carregarDados === 'function') await carregarDados(); } catch (e) { /* a tela é redesenhada com o que houver */ }
    aoConcluir(ok, falha, { data, forma, contaNome });
  });
}

/* ---------- item de menu: DAV ---------- */
let davEstadoPainel = davEstadoNovo();
function openDavPanel(preset){
  if (preset && typeof preset === 'object') davEstadoPainel = davEstadoNovo(preset);
  openOverlay(`
    <div class="panel-head">
      <div><h2>DAV</h2><p>Pedidos de venda a prazo da distribuidora (AutoPlus), lançados em A receber. O vencimento é 7 dias após a data do pedido.</p></div>
      <button class="close-x" onclick="closeOverlay()" aria-label="Fechar">✕</button>
    </div>
    <div id="davPainel"></div>
    <div class="panel-actions" style="margin-top:20px;"><button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button></div>
  `, () => openDavPanel());
  davMontar(document.getElementById('davPainel'), davEstadoPainel, { clicavel: true });
}
(function davLigarBotao(){
  const lig = () => { const b = document.getElementById('btnDAV'); if (b && !b.dataset.davLigado) { b.dataset.davLigado = '1'; b.addEventListener('click', () => openDavPanel({})); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lig); else lig();
})();

/* ---------- Fechamento de caixa: cartão expansível ao clicar em DAV ---------- */
function davFechamentoToggle(btn, ini, fim){
  const caixa = document.getElementById('fcDavCard'); if (!caixa) return;
  const mesma = !caixa.hidden && caixa.dataset.ini === ini && caixa.dataset.fim === fim;
  document.querySelectorAll('.dav-link[data-dav-ini]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (mesma) { caixa.hidden = true; caixa.innerHTML = ''; return; }
  caixa.hidden = false; caixa.dataset.ini = ini; caixa.dataset.fim = fim;
  document.querySelectorAll('.dav-link[data-dav-ini="' + ini + '"][data-dav-fim="' + fim + '"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
  const rot = ini === fim ? fmtDate(ini) : fmtDate(ini) + ' a ' + fmtDate(fim);
  const est = davEstadoNovo({ vIni: ini, vFim: fim, k: 'venc', dir: 1 });
  caixa.innerHTML = `
    <div class="dav-card-cab">
      <div><h4>DAV — pedidos da distribuidora com vencimento em ${rot}</h4><p>É a parcela “DAV” da coluna de entradas por vencimento acima. Os filtros abaixo só valem para esta lista.</p></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;"><button type="button" class="btn ghost" data-dav="menu">Abrir a tela DAV completa</button><button type="button" class="btn ghost" data-dav="fechar">Fechar</button></div>
    </div>
    <div data-dav="corpo"></div>`;
  davMontar(caixa.querySelector('[data-dav="corpo"]'), est, { clicavel: false, aposBaixa: () => {
    // o Fechamento mostra o realizado do período: redesenha-o com os dados novos e reabre este cartão no mesmo período
    if (typeof openFechamentoPanel !== 'function') return;
    openFechamentoPanel();
    const novo = document.querySelector('.dav-link[data-dav-ini="' + ini + '"][data-dav-fim="' + fim + '"]');
    if (novo) davFechamentoToggle(novo, ini, fim);
  } });
  caixa.querySelector('[data-dav="fechar"]').addEventListener('click', () => { caixa.hidden = true; caixa.innerHTML = ''; document.querySelectorAll('.dav-link[data-dav-ini]').forEach(b => b.setAttribute('aria-expanded', 'false')); if (btn && btn.focus) btn.focus(); });
  caixa.querySelector('[data-dav="menu"]').addEventListener('click', () => { closeOverlay(true); openDavPanel(Object.assign({}, est)); });
  if (caixa.scrollIntoView) caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Fechamento de caixa: pontos clicáveis (chamados por openFechamentoPanel) ---------- */
function davFimDoMes(ym){ const [a, m] = ym.split('-').map(Number); return ym + '-' + String(new Date(a, m, 0).getDate()).padStart(2, '0'); }
function davBotao(ini, fim, conteudo, dica){
  return `<button type="button" class="dav-link" data-dav-ini="${ini}" data-dav-fim="${fim}" aria-expanded="false" aria-controls="fcDavCard" title="${escapeHtml(dica)}" onclick="davFechamentoToggle(this,'${ini}','${fim}')">${conteudo}</button>`;
}
// cabeçalho "DAV": abre os pedidos de todo o período mostrado
function davCab(ini, fim){ return davBotao(ini, fim, 'DAV ▾', 'Ver os pedidos DAV do período e os produtos de cada um'); }
// célula de um dia (ou de um mês, quando o período é trimestre/semestre/ano)
function davCelula(k, valor, texto){
  if (!Number(valor)) return texto;
  const mensal = k.length === 7;
  const ini = mensal ? k + '-01' : k, fim = mensal ? davFimDoMes(k) : k;
  return davBotao(ini, fim, texto, 'Ver os pedidos DAV com vencimento neste ' + (mensal ? 'mês' : 'dia'));
}
// total do período
function davCelulaTotal(ini, fim, valor, texto){
  if (!Number(valor)) return texto;
  return davBotao(ini, fim, texto, 'Ver todos os pedidos DAV do período');
}
