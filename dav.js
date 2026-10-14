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
function davEstadoNovo(base){ return Object.assign({ q: '', pIni: '', pFim: '', vIni: '', vFim: '', k: 'compra', dir: -1, abertos: new Set() }, base || {}); }

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
    <div data-dav="res"></div>`;

  function periodoInvalido(){
    if (est.pIni && est.pFim && est.pIni > est.pFim) return 'Data do pedido: o término deve ser igual ou posterior ao início.';
    if (est.vIni && est.vFim && est.vIni > est.vFim) return 'Vencimento: o término deve ser igual ou posterior ao início.';
    return '';
  }
  function desenhar(){
    const erro = periodoInvalido();
    el.querySelector('[data-dav="erro"]').textContent = erro;
    const alvo = el.querySelector('[data-dav="res"]');
    if (erro) { alvo.innerHTML = ''; return; }
    const todas = davLinhas();
    const lista = davOrdenar(davFiltrar(todas, est), est);
    const total = lista.reduce((a, l) => a + l.valor, 0);
    const aberto = lista.reduce((a, l) => a + l.aberto, 0);
    const sem = lista.filter(l => !l.compra).length;
    const atip = lista.filter(l => l.prazoAtipico).length;
    const th = (k, rot, cls) => {
      const ativo = est.k === k;
      const seta = ativo ? (est.dir === 1 ? '▲' : '▼') : '';
      return `<th scope="col" class="${cls || ''}" aria-sort="${ativo ? (est.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="dav-ord" data-ord="${k}">${rot}<span aria-hidden="true">${seta}</span></button></th>`;
    };
    const linhas = lista.map(l => {
      const aberta = est.abertos.has(String(l.id));
      return `
      <tr class="dav-row clic${aberta ? ' aberta' : ''}" data-id="${escapeHtml(String(l.id))}" tabindex="0" role="button" aria-expanded="${aberta}" title="Ver os produtos deste pedido">
        <td><span class="dav-seta" aria-hidden="true">▸</span>${escapeHtml(l.pedido) || '—'}</td>
        <td>${escapeHtml(l.cliente) || '—'}</td>
        <td>${l.compra ? fmtDate(l.compra) : '—'}</td>
        <td>${l.venc ? fmtDate(l.venc) : '—'}${l.prazoAtipico ? ' <span title="Vencimento diferente de 7 dias após a compra (lançamento manual ou prazo combinado)" aria-label="prazo diferente de 7 dias">†</span>' : ''}</td>
        <td class="n">${fmtBRL(l.valor)}</td>
        <td><span class="dav-sit ${l.sit}">${l.rot}</span></td>
      </tr>${aberta ? `<tr class="dav-det" data-det="${escapeHtml(String(l.id))}"><td colspan="6"><div data-itens>${davItensHtml(l)}</div>${clicavel ? `<div class="dav-det-acoes"><button type="button" class="btn ghost" data-titulo="${escapeHtml(String(l.id))}">Ver detalhes do título</button></div>` : ''}</td></tr>` : ''}`;
    }).join('');
    alvo.innerHTML = lista.length ? `
      <div class="dav-resumo" aria-live="polite"><span><b>${lista.length}</b> pedido(s)</span><span>Valor total: <b>${fmtBRL(total)}</b></span><span>Ainda em aberto: <b>${fmtBRL(aberto)}</b></span></div>
      <div class="dav-tabela"><table class="report">
        <thead><tr>${th('pedido', 'Nº do pedido')}${th('cliente', 'Cliente')}${th('compra', 'Data do pedido')}${th('venc', 'Vencimento')}${th('valor', 'Valor', 'n')}<th scope="col">Situação</th></tr></thead>
        <tbody>${linhas}
          <tr class="dav-total"><td colspan="4">Total (${lista.length} pedido${lista.length > 1 ? 's' : ''})</td><td class="n">${fmtBRL(total)}</td><td></td></tr>
        </tbody></table></div>
      <p class="dav-nota">${atip ? '† Vencimento diferente de 7 dias após a data do pedido (' + atip + '). ' : ''}${sem ? sem + ' pedido(s) sem data de pedido cadastrada: aparecem com "—" e ficam fora dos filtros de data do pedido. ' : ''}Lista os títulos a receber da categoria ${escapeHtml(davCategoria())}, exceto cancelados. A base de A receber começa em 18/08/2026.</p>`
      : `<p class="dav-vazio">Nenhum pedido encontrado com esses filtros.</p>`;
    const porId = id => lista.find(x => String(x.id) === String(id));
    const alternar = tr => {
      const id = tr.dataset.id, l = porId(id); if (!l) return;
      if (est.abertos.has(id)) { est.abertos.delete(id); if (l.pedido && davItens[l.pedido] && davItens[l.pedido].erro) delete davItens[l.pedido]; }
      else est.abertos.add(id);
      desenhar();
      const nova = alvo.querySelector('tr.dav-row[data-id="' + id + '"]'); if (nova && nova.focus) nova.focus();
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
    alvo.querySelectorAll('tr.dav-row').forEach(tr => {
      tr.addEventListener('click', () => alternar(tr));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(tr); } });
    });
    alvo.querySelectorAll('[data-titulo]').forEach(b => b.addEventListener('click', () => {
      if (typeof openDetalhesForItem === 'function') openDetalhesForItem('receber', b.dataset.titulo, 'receber');
    }));
    alvo.querySelectorAll('[data-ord]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.ord;
      if (est.k === k) est.dir = -est.dir; else { est.k = k; est.dir = (k === 'cliente' || k === 'pedido') ? 1 : -1; }
      desenhar();
    }));
    if (typeof opcoes.aoMudar === 'function') opcoes.aoMudar(est);
  }
  el.querySelectorAll('[data-f]').forEach(inp => {
    inp.addEventListener(inp.type === 'date' ? 'change' : 'input', () => { est[inp.dataset.f] = inp.value; desenhar(); });
  });
  el.querySelector('[data-dav="limpar"]').addEventListener('click', () => {
    Object.assign(est, { q: '', pIni: '', pFim: '', vIni: '', vFim: '' });
    el.querySelectorAll('[data-f]').forEach(inp => { inp.value = ''; });
    desenhar();
  });
  desenhar();
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
  davMontar(caixa.querySelector('[data-dav="corpo"]'), est, { clicavel: false });
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
