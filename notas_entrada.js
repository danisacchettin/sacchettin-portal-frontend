/* ==========================================================================================
   NOTAS DE ENTRADA (NF-e recebidas) -- pedido da Danielle (11/10/2026).
   Menu Financeiro > Notas de entrada. As notas sao baixadas automaticamente da SEFAZ pelo
   backend (certificado A1 da empresa), ficam guardadas no portal (nao expiram) e aparecem em
   tabela; ao clicar numa linha abre o cartao da NF (emitente, itens, pagamento previsto).
   Parcelas previstas na NF sao conferidas com o Contas a pagar: se nao ha lancamento, o portal
   SUGERE o preenchimento e a cliente/o escritorio apenas AUTORIZA. Nada e lancado sozinho.
   Backend: src/routes/nfeEntrada.js (/api/nfe-entrada). Depende de index.html:
   apiFetch, openOverlay, closeOverlay, fmtBRL, fmtDate, escapeHtml, carregarCadastros,
   CADASTROS, carregarDados, numeroBoletoParaEnvio, USUARIO.
   ========================================================================================== */
let neLista = [];
let neStatus = null;
let neFiltro = { periodo: '90d', situacao: '', financeiro: '', q: '' };
const neAbertas = new Set();
const neDetalhes = {};
const neMsgPend = {};   // mensagem a mostrar depois que o cartão for redesenhado

(function neEstilo(){
  if (document.getElementById('neStyle')) return;
  const st = document.createElement('style'); st.id = 'neStyle';
  st.textContent = `
  .ne-kpis{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin:0 0 14px;}
  .ne-kpi{border:1px solid rgba(27,43,58,.12); border-radius:10px; padding:10px 12px; background:var(--paper-2);}
  .ne-kpi .l{font-size:10.5px; letter-spacing:.4px; text-transform:uppercase; color:var(--ink-faint);}
  .ne-kpi .v{font-size:17px; font-weight:600; color:var(--ink); margin-top:2px;}
  .ne-kpi.alerta .v{color:var(--red);}
  .ne-filtros{display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;}
  .ne-filtros .field{margin:0; min-width:130px;}
  .ne-status{font-size:12px; color:var(--ink-soft); border:1px dashed rgba(27,43,58,.2); border-radius:8px; padding:8px 10px; margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;}
  .ne-status.erro{border-color:var(--red); color:var(--red);}
  tr.ne-row{cursor:pointer;}
  tr.ne-row .tag-status{white-space:nowrap;}
  tr.ne-row td:first-child::before{content:'▸'; display:inline-block; width:14px; color:var(--ink-faint); transition:transform .15s;}
  tr.ne-row.aberta td:first-child::before{transform:rotate(90deg);}
  tr.ne-row.cancelada td{text-decoration:line-through; opacity:.65;}
  tr.ne-detail td{background:var(--paper-2); padding:14px 12px;}
  .ne-card{border:1px solid rgba(27,43,58,.18); border-radius:10px; background:#fff; padding:16px 18px; max-width:980px; margin:0 auto; color:#1b2b3a;}
  body.tema-escritorio .ne-card{background:#f7f4ec;}
  .ne-card h4{margin:0 0 6px; font-family:'Playfair Display',serif; font-weight:500; font-size:16px;}
  .ne-nfhead{display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; border-bottom:2px solid #1b2b3a; padding-bottom:10px; margin-bottom:12px;}
  .ne-nfhead .tit{font-weight:700; font-size:15px; letter-spacing:.3px;}
  .ne-chave{font-family:ui-monospace,Menlo,monospace; font-size:11.5px; word-break:break-all; color:#445;}
  .ne-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:8px 18px; margin-bottom:12px; font-size:12.5px;}
  .ne-grid .k{font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#667;}
  .ne-grid .v{font-weight:500;}
  .ne-wrap{width:0; min-width:100%; overflow-x:auto;}
  table.report td.ne-celula{padding:12px 10px;}
  .ne-card table{width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:12px;}
  table.report .ne-card th{text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#667; border-bottom:1px solid #1b2b3a; padding:5px 6px; background:transparent;}
  table.report .ne-card td{padding:6px; border-bottom:1px solid rgba(27,43,58,.1); color:#1b2b3a; background:transparent;}
  table.report .ne-card tr:hover td{background:transparent; color:#1b2b3a;}
  table.report .ne-card td.n, table.report .ne-card th.n{text-align:right; white-space:nowrap;}
  table.report tr.ne-detail:hover td{background:var(--paper-2); color:inherit;}
  .ne-totais{display:flex; gap:18px; justify-content:flex-end; flex-wrap:wrap; font-size:12.5px; margin-bottom:12px;}
  .ne-totais b{font-size:14px;}
  .ne-sec{margin-top:14px; padding-top:12px; border-top:1px solid rgba(27,43,58,.15);}
  .ne-aviso{border-radius:8px; padding:9px 12px; font-size:12.5px; margin:8px 0; background:var(--gold-wash); color:#5a4510;}
  .ne-aviso.vermelho{background:var(--red-wash); color:var(--red);}
  .ne-aviso.verde{background:var(--olive-wash); color:var(--olive);}
  .ne-confirma{display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; border-radius:8px; padding:10px 12px; margin:8px 0; background:var(--gold-wash); color:#5a4510; font-size:12.5px;}
  .ne-confirma .btn{white-space:nowrap;}
  .ne-pend-conf{font-size:10.5px; color:#8a6d1c; margin-top:3px;}
  .ne-sug{border:1px solid var(--gold-line, #c9a24b); border-radius:8px; padding:10px 12px; background:#fffdf6;}
  body.tema-escritorio .ne-sug{background:#faf6e8;}
  .ne-sug input, .ne-sug select{font-size:12.5px; padding:4px 6px; max-width:100%;}
  .ne-acoes{display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;}
  .ne-msg{font-size:12px; margin-top:8px;}
  @media(max-width:700px){ .ne-hide-m{display:none;} }
  `;
  document.head.appendChild(st);
})();

/* ---------- utilitarios ---------- */
function neISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function neIntervalo(periodo){
  const hoje = new Date();
  if (periodo === 'mes') return { de: neISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: neISO(hoje) };
  if (periodo === 'mes_ant') return { de: neISO(new Date(hoje.getFullYear(), hoje.getMonth()-1, 1)), ate: neISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) };
  if (periodo === '90d') { const d = new Date(hoje); d.setDate(d.getDate()-90); return { de: neISO(d), ate: neISO(hoje) }; }
  return {};
}
function neEhEscritorio(){ try { return typeof USUARIO !== 'undefined' && USUARIO && USUARIO.papel === 'escritorio'; } catch(e){ return false; } }
function neCnpj(c){
  const d = String(c || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return c || '—';
}
function neChave(c){ return String(c || '').trim().replace(/(\d{4})(?=\d)/g, '$1 '); }
function neDataHora(iso){
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function neDataEmissao(iso){ if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR'); }
function neNum(v, casas){ return v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
function neTagSituacao(s){
  if (s === 'cancelada') return '<span class="tag-status tag-atraso">Cancelada</span>';
  if (s === 'denegada') return '<span class="tag-status tag-atraso">Denegada</span>';
  return '<span class="tag-status tag-pago">Ativa</span>';
}
function neTagSimples(v){
  if (v === true) return '<span class="tag-status tag-pago" title="Regime tributário do emitente lido do XML (CRT 1/2/4)">Simples</span>';
  if (v === false) return '<span class="tag-status tag-aberto" title="Regime normal (CRT 3)">Não optante</span>';
  return '<span style="color:var(--ink-faint);" title="O resumo da nota não traz o regime; aparece quando o XML completo chega.">—</span>';
}
function neTagFinanceiro(n){
  const total = Number(n.parcelas), pend = Number(n.parcelas_pendentes), vinc = Number(n.parcelas_vinculadas);
  if (n.situacao === 'cancelada') return '<span style="color:var(--ink-faint);">—</span>';
  if (!n.xml_completo) return '<span class="tag-status tag-aberto" title="Só o resumo foi recebido">aguardando XML</span>';
  if (!total) return '<span style="color:var(--ink-faint);" title="A nota não prevê pagamento a prazo">sem parcelas</span>';
  if (pend === 0) return `<span class="tag-status tag-pago">lançado${total>1?` (${vinc}/${total})`:''}</span>`;
  return `<span class="tag-status tag-atraso">sem lançamento${total>1?` (${pend}/${total})`:''}</span>`;
}
function neFormaSugerida(pagamentos){
  const mapa = { '15':'Boleto', '14':'Boleto', '17':'PIX', '16':'TED', '18':'TED', '03':'Cartão', '04':'Cartão', '01':'Dinheiro' };
  const p = (pagamentos || []).find(x => mapa[x.t_pag]);
  return p ? mapa[p.t_pag] : '';
}

/* ---------- painel ---------- */
async function openNotasEntradaPanel(){
  openOverlay(`<div class="panel-head"><div><h2>Notas de entrada</h2><p>Carregando...</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
  try {
    await carregarCadastros();
    await Promise.all([neCarregarStatus(), neCarregarLista()]);
    neRender();
  } catch (err) {
    openOverlay(`<div class="panel-head"><div><h2>Notas de entrada</h2><p style="color:var(--red);">Erro ao carregar: ${escapeHtml(err.message)}</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
  }
}
async function neCarregarStatus(){ neStatus = await apiFetch('/api/nfe-entrada/status'); }
async function neCarregarLista(){
  const qs = new URLSearchParams();
  const iv = neIntervalo(neFiltro.periodo);
  if (iv.de) qs.set('de', iv.de);
  if (iv.ate) qs.set('ate', iv.ate);
  if (neFiltro.situacao) qs.set('situacao', neFiltro.situacao);
  if (neFiltro.financeiro) qs.set('financeiro', neFiltro.financeiro);
  if (neFiltro.q) qs.set('q', neFiltro.q);
  neLista = await apiFetch('/api/nfe-entrada' + (qs.toString() ? '?' + qs : '')) || [];
}

function neStatusHtml(){
  const s = neStatus; if (!s) return '';
  if (!s.configurado) {
    if (neEhEscritorio()) {
      return `<div class="ne-status erro"><div><b>Integração com a SEFAZ ainda não configurada.</b> Faltam no servidor: ${escapeHtml((s.faltando||[]).join(', '))}. O certificado digital e a senha são cadastrados diretamente no Render (nunca por este sistema nem por mensagem).</div></div>`;
    }
    return `<div class="ne-status"><div>As notas fiscais de entrada aparecerão aqui assim que a integração com a SEFAZ for ativada pelo escritório.</div></div>`;
  }
  const quando = s.ultima_consulta ? neDataHora(s.ultima_consulta) : 'ainda não consultou';
  const prox = s.proxima_consulta_apos && new Date(s.proxima_consulta_apos) > new Date() ? ` · próxima consulta liberada a partir de ${neDataHora(s.proxima_consulta_apos)}` : '';
  const explicaResumo = s.ciencia_automatica === true ? 'o XML completo chega após a Ciência da Operação, feita automaticamente' : 'a SEFAZ só libera o XML completo após a Ciência da Operação, que o portal não envia automaticamente';
  const resumo = Number(s.notas_so_resumo) > 0 ? ` · <b>${s.notas_so_resumo}</b> nota(s) só com resumo (${explicaResumo})` : '';
  const auto = Number(s.sincronizacao_automatica_min) > 0 ? ` · busca automática a cada ${Number(s.sincronizacao_automatica_min)} min (a SEFAZ só atende cerca de 1 consulta por hora quando não há novidades)` : '';
  const botao = neEhEscritorio() ? `<button type="button" class="btn ghost" id="neSincronizar">Sincronizar agora</button>` : '';
  const erro = s.ultimo_erro ? `<div style="color:var(--red);">Último aviso: ${escapeHtml(s.ultimo_erro)}</div>` : '';
  return `<div class="ne-status${s.ultimo_erro ? ' erro' : ''}"><div>SEFAZ (${escapeHtml(s.ambiente)}): última consulta ${escapeHtml(quando)}${prox}${auto}${resumo}${erro}</div>${botao}<span id="neSyncMsg" class="ne-msg"></span></div>`;
}

function neKpisHtml(){
  const ativas = neLista.filter(n => n.situacao !== 'cancelada');
  const total = ativas.reduce((a, n) => a + (Number(n.valor_total) || 0), 0);
  const sem = ativas.filter(n => n.xml_completo && Number(n.parcelas_pendentes) > 0);
  const valSem = sem.reduce((a, n) => a + (Number(n.valor_total) || 0), 0);
  const canc = neLista.filter(n => n.situacao === 'cancelada').length;
  return `<div class="ne-kpis">
    <div class="ne-kpi"><div class="l">Notas ativas</div><div class="v">${ativas.length}</div></div>
    <div class="ne-kpi"><div class="l">Valor das notas</div><div class="v">${fmtBRL(total)}</div></div>
    <div class="ne-kpi${sem.length ? ' alerta' : ''}"><div class="l">Sem lançamento no contas a pagar</div><div class="v">${sem.length} · ${fmtBRL(valSem)}</div></div>
    <div class="ne-kpi"><div class="l">Canceladas</div><div class="v">${canc}</div></div>
  </div>`;
}

function neLinhaHtml(n){
  const aberta = neAbertas.has(String(n.id));
  const emissor = `<div>${escapeHtml(n.emitente_nome || '—')}</div><div style="font-size:11px; color:var(--ink-faint);">${escapeHtml(neCnpj(n.emitente_cnpj))}</div>`;
  return `<tr class="ne-row${aberta ? ' aberta' : ''}${n.situacao==='cancelada' ? ' cancelada' : ''}" data-id="${n.id}">
      <td>${escapeHtml(n.numero || '—')}${n.serie ? `<span style="color:var(--ink-faint);"> /${escapeHtml(n.serie)}</span>` : ''}</td>
      <td>${neDataEmissao(n.data_emissao)}</td>
      <td class="ne-hide-m">${escapeHtml(n.forma_pagamento_prevista || (n.xml_completo ? 'não informada' : '—'))}</td>
      <td>${neTagSituacao(n.situacao)}${n.situacao === 'autorizada' && !n.recebimento_confirmado_em ? '<div class="ne-pend-conf">recebimento a confirmar</div>' : ''}</td>
      <td>${emissor}</td>
      <td>${neTagSimples(n.emitente_simples)}</td>
      <td style="text-align:right;">${n.valor_total != null ? fmtBRL(Number(n.valor_total)) : '—'}</td>
      <td>${neTagFinanceiro(n)}</td>
    </tr>${aberta ? `<tr class="ne-detail" data-det="${n.id}"><td colspan="8" class="ne-celula"><div class="ne-wrap"><div id="neCard-${n.id}">Carregando nota...</div></div></td></tr>` : ''}`;
}

function neRender(){
  const f = neFiltro;
  const sel = (v, o) => v === o ? ' selected' : '';
  openOverlay(`
    <div class="panel-head">
      <div><h2>Notas de entrada</h2><p>Notas fiscais emitidas contra o CNPJ da empresa, baixadas da SEFAZ e guardadas aqui (não expiram). Clique numa linha para abrir a nota.</p></div>
      <button class="close-x" onclick="closeOverlay()">X</button>
    </div>
    ${neStatusHtml()}
    ${neKpisHtml()}
    <div class="ne-filtros">
      <div class="field"><label>Período (emissão)</label><select id="neFPeriodo">
        <option value="mes"${sel(f.periodo,'mes')}>Este mês</option><option value="mes_ant"${sel(f.periodo,'mes_ant')}>Mês anterior</option>
        <option value="90d"${sel(f.periodo,'90d')}>Últimos 90 dias</option><option value="todos"${sel(f.periodo,'todos')}>Todas</option></select></div>
      <div class="field"><label>Status da nota</label><select id="neFSituacao">
        <option value=""${sel(f.situacao,'')}>Todas</option><option value="autorizada"${sel(f.situacao,'autorizada')}>Ativas</option>
        <option value="cancelada"${sel(f.situacao,'cancelada')}>Canceladas</option><option value="denegada"${sel(f.situacao,'denegada')}>Denegadas</option></select></div>
      <div class="field"><label>Contas a pagar</label><select id="neFFin">
        <option value=""${sel(f.financeiro,'')}>Todas</option><option value="sem"${sel(f.financeiro,'sem')}>Sem lançamento</option>
        <option value="com"${sel(f.financeiro,'com')}>Já lançadas</option></select></div>
      <div class="field" style="flex:1; min-width:180px;"><label>Buscar (nº, emissor, CNPJ, chave)</label><input type="text" id="neFBusca" value="${escapeHtml(f.q)}"></div>
      <button type="button" class="btn ghost" id="neFiltrar">Filtrar</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="report">
        <thead><tr><th>Nº da nota</th><th>Emissão</th><th class="ne-hide-m">Forma de pagamento prevista</th><th>Status</th><th>Emissor</th><th>Optante Simples</th><th style="text-align:right;">Valor</th><th>Contas a pagar</th></tr></thead>
        <tbody id="neBody">${neLista.length ? neLista.map(neLinhaHtml).join('') : `<tr><td colspan="8">${neStatus && neStatus.configurado ? 'Nenhuma nota no filtro escolhido.' : 'Nenhuma nota recebida ainda.'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel-actions" style="margin-top:20px;"><button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button></div>
  `);
  document.getElementById('neFiltrar').addEventListener('click', neAplicarFiltro);
  document.getElementById('neFBusca').addEventListener('keydown', e => { if (e.key === 'Enter') neAplicarFiltro(); });
  ['neFPeriodo', 'neFSituacao', 'neFFin'].forEach(id => document.getElementById(id).addEventListener('change', neAplicarFiltro));
  const bs = document.getElementById('neSincronizar'); if (bs) bs.addEventListener('click', neSincronizarAgora);
  document.getElementById('neBody').addEventListener('click', e => {
    const tr = e.target.closest('tr.ne-row'); if (!tr) return;
    neAlternar(tr.dataset.id);
  });
  neAbertas.forEach(id => neCarregarCard(id));
}

async function neAplicarFiltro(){
  neFiltro = {
    periodo: document.getElementById('neFPeriodo').value, situacao: document.getElementById('neFSituacao').value,
    financeiro: document.getElementById('neFFin').value, q: document.getElementById('neFBusca').value.trim(),
  };
  try { await neCarregarLista(); neRender(); } catch (err) { alert('Não foi possível filtrar: ' + err.message); }
}

async function neSincronizarAgora(){
  const msg = document.getElementById('neSyncMsg'); const btn = document.getElementById('neSincronizar');
  btn.disabled = true; msg.style.color = 'var(--ink-soft)'; msg.textContent = 'Consultando a SEFAZ...';
  try {
    const r = await apiFetch('/api/nfe-entrada/sincronizar', { method: 'POST', body: JSON.stringify({}) });
    if (r.pulado) { msg.textContent = 'A SEFAZ exige intervalo mínimo de 1 hora entre consultas; nova consulta liberada em ' + neDataHora(r.proxima_consulta_apos) + '.'; btn.disabled = false; return; }
    if (r.motivo === 'configuracao_incompleta') { msg.style.color = 'var(--red)'; msg.textContent = 'Configuração incompleta no servidor: ' + (r.faltando || []).join(', '); btn.disabled = false; return; }
    await Promise.all([neCarregarStatus(), neCarregarLista()]);
    neRender();
    const m2 = document.getElementById('neSyncMsg');
    if (m2) { m2.textContent = r.ok ? `Concluído: ${r.importadas} documento(s) novo(s)${Number(r.ciencias) > 0 ? ', ' + r.ciencias + ' Ciência(s) registrada(s)' : ''}, ${r.vinculadas} parcela(s) vinculada(s).` : 'Atenção: ' + (r.erro || r.motivo); }
  } catch (err) { msg.style.color = 'var(--red)'; msg.textContent = err.message; btn.disabled = false; }
}

function neAlternar(id){
  id = String(id);
  if (neAbertas.has(id)) neAbertas.delete(id); else neAbertas.add(id);
  const n = neLista.find(x => String(x.id) === id); if (!n) return;
  const tr = document.querySelector(`tr.ne-row[data-id="${id}"]`);
  const det = document.querySelector(`tr.ne-detail[data-det="${id}"]`);
  if (neAbertas.has(id)) {
    tr.classList.add('aberta');
    if (!det) { tr.insertAdjacentHTML('afterend', `<tr class="ne-detail" data-det="${id}"><td colspan="8" class="ne-celula"><div class="ne-wrap"><div id="neCard-${id}">Carregando nota...</div></div></td></tr>`); }
    neCarregarCard(id);
  } else { tr.classList.remove('aberta'); if (det) det.remove(); }
}

async function neCarregarCard(id){
  const alvo = document.getElementById('neCard-' + id); if (!alvo) return;
  try {
    const d = await apiFetch('/api/nfe-entrada/' + id);
    neDetalhes[id] = d;
    const alvo2 = document.getElementById('neCard-' + id); if (alvo2) { alvo2.innerHTML = neCardHtml(d); neLigarCard(d); if (neMsgPend[id]) { neMsg(id, neMsgPend[id].texto, neMsgPend[id].erro); delete neMsgPend[id]; } }
  } catch (err) { alvo.innerHTML = `<span style="color:var(--red);">Erro ao abrir a nota: ${escapeHtml(err.message)}</span>`; }
}

/* ---------- cartao da NF ---------- */
function neCardHtml(n){
  const manif = { sem_manifestacao: 'sem manifestação', ciencia: 'Ciência da Operação registrada', confirmada: 'Operação confirmada', desconhecida: 'Operação desconhecida', nao_realizada: 'Operação não realizada' }[n.manifestacao] || n.manifestacao;
  const regime = n.emitente_simples === true ? 'Optante pelo Simples Nacional' : n.emitente_simples === false ? 'Regime normal (não optante)' : 'não informado no resumo';
  let aviso = '';
  if (!n.xml_completo) aviso = `<div class="ne-aviso">Somente o <b>resumo</b> desta nota foi recebido. A SEFAZ libera o XML completo (itens, pagamento, regime do emitente) após a Ciência da Operação${(typeof neStatus !== 'undefined' && neStatus && neStatus.ciencia_automatica === true) ? ', que o portal registra automaticamente na próxima sincronização' : ', que o portal não envia automaticamente. Até lá, a nota fica listada apenas com os dados do resumo (emitente, valor e data)'}.</div>`;
  if (n.situacao === 'cancelada') aviso += `<div class="ne-aviso vermelho">Nota <b>cancelada</b> pelo emitente — não gera obrigação de pagamento.</div>`;
  if (n.situacao === 'denegada') aviso += `<div class="ne-aviso vermelho">Uso da nota <b>denegado</b> pela SEFAZ.</div>`;

  let confirma = '';
  if (n.situacao === 'autorizada') {
    if (n.recebimento_confirmado_em) {
      confirma = `<div class="ne-aviso verde">Recebimento <b>confirmado</b> em ${neDataHora(n.recebimento_confirmado_em)}${n.recebimento_confirmado_por ? ' (' + (n.recebimento_confirmado_por === 'cliente' ? 'cliente' : 'escritório') + ')' : ''}.</div>`;
    } else {
      confirma = `<div class="ne-confirma"><div><b>Esta mercadoria foi recebida?</b> Ao confirmar, o portal confere se as parcelas e boletos desta nota já estão no Contas a pagar e, se faltar algum, sugere o lançamento já preenchido para você só autorizar.</div>
        <button type="button" class="btn gold" data-ne-confirmar="${n.id}">Confirmar recebimento</button></div>`;
    }
  }

  const itens = (n.itens || []).map(i => `<tr><td>${i.n_item ?? ''}</td><td>${escapeHtml(i.descricao || '')}<div style="font-size:10.5px; color:#778;">${escapeHtml(i.codigo || '')}${i.ncm ? ' · NCM ' + escapeHtml(i.ncm) : ''}</div></td>
      <td class="n">${neNum(i.quantidade, 3)} ${escapeHtml(i.unidade || '')}</td><td class="n">${i.peso_kg != null ? neNum(i.peso_kg, 3) + ' kg' : '—'}</td>
      <td class="n">${i.valor_unitario != null ? fmtBRL(Number(i.valor_unitario)) : '—'}</td><td class="n">${i.valor_total != null ? fmtBRL(Number(i.valor_total)) : '—'}</td></tr>`).join('');

  const pesoTotal = (n.itens || []).reduce((a, i) => a + (i.peso_kg != null ? Number(i.peso_kg) : 0), 0);
  const tabelaItens = n.xml_completo ? `<table><thead><tr><th>#</th><th>Descrição</th><th class="n">Quantidade</th><th class="n">Peso</th><th class="n">Vl. unit.</th><th class="n">Valor total</th></tr></thead><tbody>${itens || '<tr><td colspan="6">Sem itens.</td></tr>'}</tbody></table>
    <div class="ne-totais"><span>Produtos: <b>${n.valor_produtos != null ? fmtBRL(Number(n.valor_produtos)) : '—'}</b></span>${Number(n.valor_frete) ? `<span>Frete: <b>${fmtBRL(Number(n.valor_frete))}</b></span>` : ''}${Number(n.valor_desconto) ? `<span>Desconto: <b>${fmtBRL(Number(n.valor_desconto))}</b></span>` : ''}
      <span>Peso líquido: <b>${n.peso_liquido != null ? neNum(n.peso_liquido, 3) + ' kg' : (pesoTotal ? neNum(pesoTotal, 3) + ' kg (soma dos itens)' : '—')}</b></span><span>Total da nota: <b>${fmtBRL(Number(n.valor_total) || 0)}</b></span></div>` : '';

  return `<div class="ne-card">
    <div class="ne-nfhead">
      <div><div class="tit">NF-e Nº ${escapeHtml(n.numero || '—')} · Série ${escapeHtml(n.serie || '—')}</div><div class="ne-chave">Chave: ${escapeHtml(neChave(n.chave))}</div></div>
      <div style="text-align:right;">${neTagSituacao(n.situacao)}<div style="font-size:11px; color:#667; margin-top:4px;">${escapeHtml(manif)}</div></div>
    </div>
    ${aviso}
    ${confirma}
    <div class="ne-grid">
      <div><div class="k">Emitente</div><div class="v">${escapeHtml(n.emitente_nome || '—')}</div></div>
      <div><div class="k">CNPJ</div><div class="v">${escapeHtml(neCnpj(n.emitente_cnpj))}${n.emitente_uf ? ' · ' + escapeHtml(n.emitente_uf) : ''}</div></div>
      <div><div class="k">Regime tributário</div><div class="v">${escapeHtml(regime)}</div></div>
      <div><div class="k">Emissão</div><div class="v">${neDataHora(n.data_emissao)}</div></div>
      <div><div class="k">Natureza da operação</div><div class="v">${escapeHtml(n.nat_op || '—')}</div></div>
      <div><div class="k">Fornecedor no cadastro</div><div class="v">${n.fornecedor_id ? escapeHtml(n.fornecedor_nome || '') : '<span style="color:var(--red);">não vinculado</span>'}</div></div>
    </div>
    ${tabelaItens}
    ${n.xml_completo ? neFinanceiroHtml(n) : ''}
    <div class="ne-acoes" style="border-top:1px solid rgba(27,43,58,.15); padding-top:10px;">
      <button type="button" class="btn ghost" data-ne-xml="${n.id}">Baixar XML</button>
      ${n.fornecedor_id ? '' : `<button type="button" class="btn ghost" data-ne-forn="${n.id}" title="Vincula esta nota a um fornecedor já cadastrado e preenche CNPJ / Simples só se estiverem vazios">Vincular a fornecedor cadastrado…</button>`}
      ${n.fornecedor_id ? `<button type="button" class="btn ghost" data-ne-atualiza="${n.id}" title="Preenche CNPJ e optante pelo Simples no cadastro do fornecedor, somente se estiverem vazios">Completar cadastro do fornecedor</button>` : ''}
    </div>
    <div class="ne-msg" id="neCardMsg-${n.id}"></div>
  </div>`;
}

function neFinanceiroHtml(n){
  const dups = n.duplicatas || [];
  if (n.situacao === 'cancelada') return '';
  if (!dups.length) return `<div class="ne-sec"><h4>Pagamento</h4><div class="ne-aviso verde">${n.forma_pagamento_prevista ? 'Forma prevista: ' + escapeHtml(n.forma_pagamento_prevista) + '.' : ''} Esta nota não prevê pagamento a prazo (sem parcelas).</div></div>`;
  const pend = dups.filter(d => d.vinculo_status === 'pendente');
  const linhas = dups.map(d => {
    let est = '';
    if (d.vinculo_status === 'vinculada') est = `<span class="tag-status tag-pago">Lançada</span> ${escapeHtml(d.cp_codigo || '')}${d.vinculo_origem === 'automatico' ? ' <span style="font-size:10.5px; color:#778;">(detectada automaticamente)</span>' : ''}`;
    else if (d.vinculo_status === 'dispensada') est = '<span class="tag-status tag-aberto">Dispensada</span>';
    else est = '<span class="tag-status tag-atraso">Sem lançamento</span>';
    return `<tr><td>${escapeHtml(d.numero || '—')}</td><td>${d.vencimento ? fmtDate(d.vencimento) : '—'}</td><td class="n">${fmtBRL(Number(d.valor) || 0)}</td><td>${est}</td></tr>`;
  }).join('');
  let corpo = `<table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Contas a pagar</th></tr></thead><tbody>${linhas}</tbody></table>`;
  if (!pend.length) {
    corpo += `<div class="ne-aviso verde">Todas as parcelas desta nota estão conferidas com o Contas a pagar.</div>`;
  } else {
    const nenhuma = pend.length === dups.filter(d => d.vinculo_status !== 'dispensada').length && !dups.some(d => d.vinculo_status === 'vinculada');
    if (!n.recebimento_confirmado_em) {
      corpo += `<div class="ne-aviso">Confirme o recebimento da mercadoria (botão acima) para o portal conferir estas parcelas com o Contas a pagar e sugerir o lançamento.</div>`;
    } else {
      corpo += `<div class="ne-aviso vermelho"><b>${nenhuma ? 'Não foi detectado nenhum lançamento financeiro desta nota no Contas a pagar.' : `${pend.length} parcela(s) desta nota sem lançamento no Contas a pagar.`}</b> Deseja incluir? O portal já preencheu os dados abaixo — revise e autorize.</div>`;
      corpo += neSugestaoHtml(n);
    }
  }
  return `<div class="ne-sec"><h4>Pagamento previsto na nota${n.forma_pagamento_prevista ? ' — ' + escapeHtml(n.forma_pagamento_prevista) : ''}</h4>${corpo}</div>`;
}

function neSugestaoHtml(n){
  const sugs = n.sugestoes || [];
  const forma = neFormaSugerida(n.pagamentos);
  const cats = (CADASTROS.categoriasDespesa || []);
  const catSel = n.categoria_sugerida_id ? String(n.categoria_sugerida_id) : (n.fornecedor_categoria_id ? String(n.fornecedor_categoria_id) : '');
  const optCat = '<option value="">Selecione a categoria…</option>' + cats.map(c => `<option value="${c.id}"${String(c.id) === catSel ? ' selected' : ''}>${escapeHtml(c.nome_categoria || c.nome || '')}</option>`).join('') + optionNovaCategoria(false);
  const optForma = ['', 'PIX', 'Boleto', 'TED', 'Cartão', 'Dinheiro'].map(f => `<option value="${f}"${f === forma ? ' selected' : ''}>${f || 'Selecione…'}</option>`).join('');
  const linhas = sugs.map((s, i) => {
    const l = s.lancamento; const cand = s.candidatos_existentes || [];
    const candHtml = cand.length ? `<div style="margin-top:4px; font-size:11.5px;">Já existe lançamento parecido: <select class="ne-cand" data-dup="${s.duplicata_id}">${cand.map(c => `<option value="${c.id}">${escapeHtml(c.codigo || '')} · ${escapeHtml(c.documento || 's/ doc')} · ${fmtDate(c.vencimento)} · ${fmtBRL(Number(c.valor_original))}${c.forma_pagamento ? ' · ' + escapeHtml(c.forma_pagamento) : ''}</option>`).join('')}</select>
      <button type="button" class="btn ghost" data-ne-vinc="${s.duplicata_id}" data-nfe="${n.id}">Vincular a este</button></div>` : '';
    return `<tr data-dup="${s.duplicata_id}">
      <td><input type="checkbox" class="ne-sel" checked></td>
      <td><input type="text" class="ne-doc" value="${escapeHtml(l.documento || '')}" style="width:130px;"></td>
      <td><input type="date" class="ne-venc" value="${l.vencimento || ''}">${l.vencimento ? '' : '<div style="font-size:10.5px; color:var(--red);">a nota não informa — preencha</div>'}</td>
      <td class="n"><input type="number" step="0.01" class="ne-valor" value="${l.valor_original != null ? Number(l.valor_original).toFixed(2) : ''}" style="width:100px;"></td>
      <td><input type="text" class="ne-boleto" placeholder="Nº do boleto (obrigatório se Boleto)" style="width:150px;"></td>
      <td><button type="button" class="btn ghost" data-ne-disp="${s.duplicata_id}" data-nfe="${n.id}" title="Esta parcela não gera conta a pagar (ex.: bonificação, já quitada)">Dispensar</button>${candHtml}</td></tr>`;
  }).join('');
  const fornInfo = n.fornecedor_id ? `Fornecedor: <b>${escapeHtml(n.fornecedor_nome || '')}</b> (cadastrado)` : `Fornecedor: <b>${escapeHtml(String(n.emitente_nome || '').toUpperCase())}</b> — será criado no cadastro, pois ainda não existe um com este CNPJ`;
  return `<div class="ne-sug" id="neSug-${n.id}">
    <div style="font-size:12.5px; margin-bottom:8px;">${fornInfo}</div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px; font-size:12.5px;">
      <label>Categoria *<br><select id="neCat-${n.id}">${optCat}</select>${novaCategoriaFormHtml('neNovaCat-' + n.id, false)}</label>
      <label>Forma de pagamento *<br><select id="neForma-${n.id}">${optForma}</select></label>
    </div>
    <div style="overflow-x:auto;"><table style="font-size:12.5px;"><thead><tr><th></th><th>Documento</th><th>Vencimento *</th><th class="n">Valor *</th><th>Nº do boleto</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
    <div class="ne-acoes"><button type="button" class="btn gold" data-ne-lancar="${n.id}">Autorizar e lançar no Contas a pagar</button></div>
    <div style="font-size:11px; color:#667; margin-top:6px;">Os lançamentos nascem “Em aberto”, com origem “Documento” e observação com a chave da nota. Nada é pago por este botão.</div>
  </div>`;
}

function neLigarCard(n){
  const raiz = document.getElementById('neCard-' + n.id); if (!raiz) return;
  raiz.querySelectorAll('[data-ne-confirmar]').forEach(b => b.addEventListener('click', () => neConfirmarRecebimento(n.id, b)));
  raiz.querySelectorAll('[data-ne-xml]').forEach(b => b.addEventListener('click', () => neBaixarXml(n.id)));
  raiz.querySelectorAll('[data-ne-lancar]').forEach(b => b.addEventListener('click', () => neLancar(n.id)));
  ligarNovaCategoria(document.getElementById('neCat-' + n.id), 'neNovaCat-' + n.id);
  raiz.querySelectorAll('[data-ne-vinc]').forEach(b => b.addEventListener('click', () => neVincularExistente(n.id, b.dataset.neVinc, b)));
  raiz.querySelectorAll('[data-ne-disp]').forEach(b => b.addEventListener('click', () => neDispensar(n.id, b.dataset.neDisp)));
  raiz.querySelectorAll('[data-ne-atualiza]').forEach(b => b.addEventListener('click', () => neAtualizarFornecedor(n.id)));
  raiz.querySelectorAll('[data-ne-forn]').forEach(b => b.addEventListener('click', () => neEscolherFornecedor(n.id)));
}

function neMsg(id, texto, erro){ const m = document.getElementById('neCardMsg-' + id); if (m) { m.style.color = erro ? 'var(--red)' : 'var(--olive)'; m.textContent = texto; } }

async function neRecarregarNota(id){
  await Promise.all([neCarregarLista(), neCarregarStatus()]);
  const corpo = document.getElementById('neBody');
  if (corpo) {
    corpo.innerHTML = neLista.length ? neLista.map(neLinhaHtml).join('') : '<tr><td colspan="8">Nenhuma nota no filtro escolhido.</td></tr>';
    neAbertas.forEach(a => neCarregarCard(a));
  }
}

async function neBaixarXml(id){
  try {
    const res = await fetch(API_BASE + '/api/nfe-entrada/' + id + '/xml', { headers: { Authorization: 'Bearer ' + authToken } });
    if (!res.ok) throw new Error('Erro ' + res.status);
    const blob = await res.blob(); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const n = neDetalhes[id]; a.download = ((n && n.chave) ? String(n.chave).trim() : 'nfe') + '.xml';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) { neMsg(id, 'Não foi possível baixar o XML: ' + err.message, true); }
}

async function neConfirmarRecebimento(id, btn){
  if (btn) btn.disabled = true;
  try {
    const r = await apiFetch('/api/nfe-entrada/' + id + '/confirmar-recebimento', { method: 'POST', body: JSON.stringify({}) });
    let texto;
    if (r.aguardando_xml) texto = 'Recebimento confirmado. Os dados de pagamento ainda não chegaram (só o resumo da nota foi recebido); assim que o XML completo chegar, a conferência com o Contas a pagar aparece aqui.';
    else if (!r.parcelas) texto = 'Recebimento confirmado. Esta nota não prevê pagamento a prazo (sem parcelas).';
    else if (!r.pendentes) texto = `Recebimento confirmado. ${r.vinculadas} de ${r.parcelas} parcela(s) já estavam lançadas no Contas a pagar — nada a incluir.`;
    else texto = `Recebimento confirmado. ${r.vinculadas} de ${r.parcelas} parcela(s) já estavam no Contas a pagar; ${r.pendentes} ainda sem lançamento — revise a sugestão abaixo e autorize.`;
    neMsgPend[id] = { texto, erro: false };
    await neRecarregarNota(id);
  } catch (err) { if (btn) btn.disabled = false; neMsg(id, 'Não foi possível confirmar o recebimento: ' + err.message, true); }
}

async function neLancar(id){
  const n = neDetalhes[id]; if (!n) return;
  const caixa = document.getElementById('neSug-' + id);
  let categoria = document.getElementById('neCat-' + id).value;
  const forma = document.getElementById('neForma-' + id).value;
  if (!categoria) return neMsg(id, 'Selecione a categoria.', true);
  let novaCat = null;
  if (categoria === VALOR_NOVA_CATEGORIA) {
    novaCat = lerNovaCategoria('neNovaCat-' + id);
    if (novaCat.erro) return neMsg(id, novaCat.erro, true);
  }
  if (!forma) return neMsg(id, 'Selecione a forma de pagamento.', true);
  const linhas = Array.from(caixa.querySelectorAll('tr[data-dup]')).filter(tr => tr.querySelector('.ne-sel').checked).map(tr => ({
    dupId: tr.dataset.dup, documento: tr.querySelector('.ne-doc').value.trim(), vencimento: tr.querySelector('.ne-venc').value,
    valor: parseFloat(tr.querySelector('.ne-valor').value) || 0,
    boleto: numeroBoletoParaEnvio(forma, tr.querySelector('.ne-boleto').value),
  }));
  if (!linhas.length) return neMsg(id, 'Marque ao menos uma parcela.', true);
  const invalida = linhas.find(l => !l.vencimento || !(l.valor > 0));
  if (invalida) return neMsg(id, 'Informe vencimento e valor em todas as parcelas marcadas.', true);
  if (linhas.some(l => !l.boleto)) return neMsg(id, 'Informe o número do boleto em todas as parcelas (obrigatório quando a forma é Boleto).', true);
  const btn = caixa.querySelector('[data-ne-lancar]'); btn.disabled = true;
  let feitas = 0;
  try {
    // Categoria nova: criada só agora, depois de todas as validações (nada é criado se a pessoa desistir).
    if (novaCat) categoria = await criarCategoriaDespesa(novaCat.nome, novaCat.grupo);
    for (const l of linhas) {
      const body = {
        categoria_id: categoria, documento: l.documento || null, numero_boleto: l.boleto, vencimento: l.vencimento,
        valor_original: l.valor, forma_pagamento: forma, origem: 'Documento',
        observacoes: `Lançado a partir da NF-e ${n.numero || ''} (chave ${String(n.chave).trim()}), autorizado por ${USUARIO && USUARIO.papel === 'escritorio' ? 'escritório' : 'cliente'}.`,
      };
      if (n.fornecedor_id) body.fornecedor_id = n.fornecedor_id; else body.fornecedor_nome = String(n.emitente_nome || '').toUpperCase();
      const cp = await apiFetch('/api/contas-pagar', { method: 'POST', body: JSON.stringify(body) });
      await apiFetch('/api/nfe-entrada/duplicatas/' + l.dupId + '/vincular', { method: 'POST', body: JSON.stringify({ contas_pagar_id: cp.id, origem: 'autorizado' }) });
      feitas++;
    }
    await carregarDados();
    await neRecarregarNota(id);
    neMsg(id, `${feitas} lançamento(s) criado(s) e vinculado(s) à nota.`, false);
  } catch (err) {
    btn.disabled = false;
    neMsg(id, `Interrompido após ${feitas} lançamento(s): ${err.message}. Feche e reabra a nota — o que já foi lançado é reconhecido automaticamente, sem duplicar.`, true);
    try { await carregarDados(); } catch (e) { /* segue */ }
  }
}

async function neVincularExistente(nfeId, dupId, btn){
  const sel = document.querySelector(`#neCard-${nfeId} .ne-cand[data-dup="${dupId}"]`); if (!sel) return;
  try {
    await apiFetch('/api/nfe-entrada/duplicatas/' + dupId + '/vincular', { method: 'POST', body: JSON.stringify({ contas_pagar_id: Number(sel.value), origem: 'manual' }) });
    await neRecarregarNota(nfeId); neMsg(nfeId, 'Parcela vinculada ao lançamento existente.', false);
  } catch (err) { neMsg(nfeId, err.message, true); }
}

async function neDispensar(nfeId, dupId){
  if (!confirm('Esta parcela não vai gerar conta a pagar (ex.: bonificação ou já quitada fora do portal). Confirmar?')) return;
  try {
    await apiFetch('/api/nfe-entrada/duplicatas/' + dupId + '/dispensar', { method: 'POST', body: JSON.stringify({}) });
    await neRecarregarNota(nfeId);
  } catch (err) { neMsg(nfeId, err.message, true); }
}

async function neAtualizarFornecedor(id){
  try {
    await apiFetch('/api/nfe-entrada/' + id + '/atualizar-fornecedor', { method: 'POST', body: JSON.stringify({}) });
    await carregarCadastros(); neMsg(id, 'Cadastro do fornecedor completado (somente campos que estavam vazios).', false);
    await neRecarregarNota(id);
  } catch (err) { neMsg(id, err.message, true); }
}

function neEscolherFornecedor(id){
  const forn = (CADASTROS.fornecedores || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const msg = document.getElementById('neCardMsg-' + id);
  msg.style.color = 'var(--ink)';
  msg.innerHTML = `Fornecedor do cadastro: <select id="neEscolhaForn-${id}"><option value="">Selecione…</option>${forn.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join('')}</select> <button type="button" class="btn ghost" id="neConfForn-${id}">Vincular e completar cadastro</button>`;
  document.getElementById('neConfForn-' + id).addEventListener('click', async () => {
    const v = document.getElementById('neEscolhaForn-' + id).value; if (!v) return;
    try {
      await apiFetch('/api/nfe-entrada/' + id + '/atualizar-fornecedor', { method: 'POST', body: JSON.stringify({ fornecedor_id: Number(v) }) });
      await carregarCadastros(); await neRecarregarNota(id);
    } catch (err) { neMsg(id, err.message, true); }
  });
}
