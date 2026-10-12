/* ==========================================================================================
   PDV (pedido da Danielle, 06-07/10/2026) -- um painel só, de leitura, sobre os dados que o bot da
   loja envia do AutoPlus (ver backend: src/routes/pdvIntegracao.js = entrada;
   src/routes/pdvRelatorios.js = estas leituras). Une o que antes eram "Vendas do PDV" e "Análise
   de vendas (PDV)" e acrescenta leituras de gestão.

   Abas visíveis a todos:  Resumo · Dias e fechamento · Produtos · Grupos · Quando vende
   Só administrador (escritório, fora do "entrar como cliente"):
     - comparação com o período anterior de mesmo tamanho, destaques automáticos, projeção do mês,
       produtos em alta/queda, variação de preço, coluna "vs. média do dia da semana";
     - aba Gestão (concentração, dependências, cauda longa, rascunho e pacote para o relatório mensal);
     - aba Qualidade dos dados (o que está faltando ou não fecha).
   Para o cliente ver também as leituras de gestão, trocar PDV_CLIENTE_VE_INTELIGENCIA para true.
   ATENÇÃO: o que é "só administrador" aqui é só a tela. As rotas /api/pdv-relatorios/* devolvem os mesmos
   dados a quem estiver autenticado; para bloquear de verdade é preciso restringir no backend.

   Dois números de faturamento aparecem lado a lado e NÃO são a mesma coisa:
     - "Fechamento" = total que o operador fechou no caixa do AutoPlus, por forma de pagamento.
       Só existe depois do fechamento do dia.
     - "Vendas por itens" = soma dos itens dos cupons (inclui a taxa de entrega). Chega em minutos,
       mas não tem forma de pagamento.
   Produtos, grupos e horários usam só mercadorias (sem a taxa de entrega): conferido em set/2026,
   vendas por itens − mercadorias = valor das taxas de entrega, exatamente.
   Nada aqui cria ou altera lançamento financeiro.
   ========================================================================================== */
const PDV_CLIENTE_VE_INTELIGENCIA = false;

let pdvPeriodo = { preset: 'mes', inicio: '', fim: '' };
let pdvAba = 'resumo';
let pdvResumo = null;       // período escolhido
let pdvAnalises = null;
let pdvResumoAnt = null;    // período anterior de mesmo tamanho (carrega em segundo plano)
let pdvAnalisesAnt = null;
let pdvBase = null;         // últimos 90 dias (média por dia da semana e projeção)
let pdvCmp = { inicio: '', fim: '', dias: 0 };
let pdvCmpEstado = 'carregando'; // 'carregando' | 'ok' | 'indisponivel'
let pdvFiltroProduto = '';
let pdvFiltroClasse = 'todos';
let pdvGraficos = [];
let pdvCargaSeq = 0;

const PDV_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PDV_DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const PDV_FAIXAS = { 1: 'Até R$ 20', 2: 'R$ 20 a 50', 3: 'R$ 50 a 100', 4: 'R$ 100 a 200', 5: 'Acima de R$ 200' };
const PDV_PRESETS = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['semana', 'Esta semana'], ['mes', 'Este mês'],
  ['mes_passado', 'Mês passado'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['livre', 'Personalizado'],
];

/* ---------- quem vê o quê ---------- */
// Administrador = escritório com a sessão do próprio escritório (não "entrando como cliente").
function pdvModoAdmin(){
  try{ return !!(typeof USUARIO !== 'undefined' && USUARIO && USUARIO.papel === 'escritorio' && !localStorage.getItem('portalAdminToken')); }
  catch(e){ return false; }
}
function pdvInteligencia(){ return pdvModoAdmin() || PDV_CLIENTE_VE_INTELIGENCIA; }
function pdvAbasDisponiveis(){
  const abas = [['resumo', 'Resumo'], ['dias', 'Dias e fechamento'], ['produtos', 'Produtos'], ['grupos', 'Grupos'], ['quando', 'Quando vende']];
  if(pdvModoAdmin()) abas.push(['gestao', 'Gestão'], ['qualidade', 'Qualidade dos dados']);
  return abas;
}

/* ---------- utilitários ---------- */
function pdvISO(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function pdvData(iso){ const p = String(iso).slice(0,10).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function pdvMoeda(v){ return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
function pdvNum(v, casas){ return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', {minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0}); }
function pdvPct(parte, total){ return total ? pdvNum(parte / total * 100, 1) + '%' : '—'; }
function pdvEsc(s){ return (typeof escapeHtml === 'function') ? escapeHtml(String(s === null || s === undefined ? '' : s)) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pdvDataBR(iso){ const p = String(iso).slice(0,10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function pdvDiaMes(iso){ return String(iso).slice(8,10) + '/' + String(iso).slice(5,7); }
function pdvDataHoraBR(ts){ if(!ts) return '—'; const d = new Date(ts); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
function pdvSomaDias(iso, n){ const d = pdvData(iso); d.setDate(d.getDate() + n); return pdvISO(d); }
function pdvDiasEntre(ini, fim){ return Math.round((pdvData(fim) - pdvData(ini)) / 86400000) + 1; }
function pdvTexto(html){ try{ return (new DOMParser().parseFromString(String(html), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); }catch(e){ return String(html).replace(/<[^>]+>/g, ''); } }

// Variação percentual de a sobre b (null quando não há base de comparação).
function pdvVar(a, b){ return (b === null || b === undefined || !b || a === null || a === undefined) ? null : (a - b) / b * 100; }
function pdvDelta(pct){
  if(pct === null || pct === undefined || !isFinite(pct)) return '';
  const sobe = pct > 0.5, desce = pct < -0.5;
  const cor = sobe ? 'var(--olive)' : (desce ? 'var(--red)' : 'var(--ink-faint)');
  return `<span style="color:${cor}; font-weight:600; white-space:nowrap;">${sobe ? '▲' : (desce ? '▼' : '≈')} ${pdvNum(Math.abs(pct), 1)}%</span>`;
}

function pdvAplicarPreset(preset){
  const hoje = new Date();
  let ini = new Date(hoje), fim = new Date(hoje);
  if(preset === 'ontem'){ ini.setDate(hoje.getDate()-1); fim = new Date(ini); }
  else if(preset === 'semana'){ const dow = (hoje.getDay()+6)%7; ini.setDate(hoje.getDate()-dow); fim = new Date(ini); fim.setDate(ini.getDate()+6); }
  else if(preset === 'mes'){ ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1); fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0); }
  else if(preset === 'mes_passado'){ ini = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1); fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); }
  else if(preset === '30'){ ini.setDate(hoje.getDate()-29); }
  else if(preset === '90'){ ini.setDate(hoje.getDate()-89); }
  else if(preset === 'livre'){ pdvPeriodo.preset = 'livre'; if(!pdvPeriodo.inicio){ pdvPeriodo.inicio = pdvISO(ini); pdvPeriodo.fim = pdvISO(fim); } return; }
  pdvPeriodo = { preset, inicio: pdvISO(ini), fim: pdvISO(fim) };
}

function pdvQS(){ return 'inicio=' + pdvPeriodo.inicio + '&fim=' + pdvPeriodo.fim; }

// Período efetivo = sem os dias que ainda não aconteceram (para comparar "o que já passou").
function pdvPeriodoEfetivo(){
  const hoje = pdvISO(new Date());
  let fim = pdvPeriodo.fim > hoje ? hoje : pdvPeriodo.fim;
  if(fim < pdvPeriodo.inicio) fim = pdvPeriodo.inicio;
  return { inicio: pdvPeriodo.inicio, fim };
}
// Período anterior de mesmo tamanho, colado no início do escolhido.
function pdvPeriodoAnterior(){
  const e = pdvPeriodoEfetivo(), n = pdvDiasEntre(e.inicio, e.fim);
  return { inicio: pdvSomaDias(e.inicio, -n), fim: pdvSomaDias(e.inicio, -1), dias: n };
}
function pdvTemCmp(){ return !!(pdvResumoAnt && pdvResumoAnt.totais && pdvResumoAnt.totais.dias_com_venda > 0); }

function pdvFiltroHtml(){
  const opts = PDV_PRESETS.map(p => `<option value="${p[0]}" ${pdvPeriodo.preset===p[0]?'selected':''}>${p[1]}</option>`).join('');
  const est = 'padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--paper-2); font-family:inherit; font-size:12.5px; color:var(--ink);';
  return `
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin-bottom:16px;">
      <label style="font-size:11px; color:var(--ink-faint);">Período<br><select id="pdvPreset" style="${est} margin-top:4px;">${opts}</select></label>
      <label style="font-size:11px; color:var(--ink-faint);">De<br><input type="date" id="pdvIni" value="${pdvPeriodo.inicio}" style="${est} margin-top:4px;"></label>
      <label style="font-size:11px; color:var(--ink-faint);">Até<br><input type="date" id="pdvFim" value="${pdvPeriodo.fim}" style="${est} margin-top:4px;"></label>
      <button type="button" class="btn gold" id="pdvAplicar">Aplicar</button>
    </div>`;
}

function pdvLigarFiltro(recarregar){
  const preset = document.getElementById('pdvPreset'), ini = document.getElementById('pdvIni'), fim = document.getElementById('pdvFim');
  if(!preset) return;
  preset.addEventListener('change', () => { pdvAplicarPreset(preset.value); if(preset.value !== 'livre') recarregar(); });
  const livre = () => { preset.value = 'livre'; pdvPeriodo.preset = 'livre'; };
  ini.addEventListener('change', livre); fim.addEventListener('change', livre);
  document.getElementById('pdvAplicar').addEventListener('click', () => {
    if(!ini.value || !fim.value){ return; }
    pdvPeriodo.inicio = ini.value; pdvPeriodo.fim = fim.value;
    if(pdvPeriodo.inicio > pdvPeriodo.fim){ const t = pdvPeriodo.inicio; pdvPeriodo.inicio = pdvPeriodo.fim; pdvPeriodo.fim = t; }
    recarregar();
  });
}

function pdvTile(rotulo, valor, sub){
  return `<div style="border:1px solid var(--border); border-radius:12px; padding:14px 16px; background:var(--paper-2); min-width:0;">
    <div style="font-size:10.5px; letter-spacing:1px; text-transform:uppercase; color:var(--ink-faint);">${rotulo}</div>
    <div style="font-size:20px; font-weight:600; color:var(--ink); margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${valor}</div>
    ${sub ? `<div style="font-size:11.5px; color:var(--ink-faint); margin-top:4px;">${sub}</div>` : ''}
  </div>`;
}
// Cartão com seta de variação contra o período anterior (só quando a leitura de gestão está liberada).
function pdvTileCmp(rotulo, valor, atual, ant, sub){
  const d = (pdvInteligencia() && pdvTemCmp()) ? pdvDelta(pdvVar(atual, ant)) : '';
  return pdvTile(rotulo, valor, (d ? d + ' vs. período anterior' + (sub ? ' · ' : '') : '') + (sub || ''));
}
function pdvGrade(tiles){ return `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin-bottom:18px;">${tiles.join('')}</div>`; }
function pdvTitulo(txt, extra){ return `<div class="section-title" style="margin-top:${extra || 6}px;">${txt}</div>`; }
function pdvNota(html, margem){ return `<p style="font-size:11.5px; color:var(--ink-faint); margin:${margem || '10px 0 0'};">${html}</p>`; }

function pdvCabecalho(titulo, sub){
  return `<div class="panel-head"><div><h2>${titulo}</h2><p>${sub}</p></div><button class="close-x" onclick="closeOverlay()">✕</button></div>`;
}

function pdvLimparGraficos(){ pdvGraficos.forEach(g => { try{ g.destroy(); }catch(e){} }); pdvGraficos = []; }

function pdvEixo(){ return (typeof corEixoGrafico === 'function') ? corEixoGrafico() : 'rgba(27,43,58,.5)'; }
function pdvBarras(canvasId, rotulos, series, formatarValor){
  const el = document.getElementById(canvasId);
  if(!el || typeof Chart === 'undefined') return;
  const eixo = pdvEixo();
  const g = new Chart(el, {
    type: 'bar',
    data: { labels: rotulos, datasets: series.map(s => ({ label: s.rotulo, data: s.valores, backgroundColor: s.cor, borderRadius: 3, maxBarThickness: 34 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: series.length > 1, labels: { color: eixo, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => (series.length > 1 ? c.dataset.label + ': ' : '') + formatarValor(c.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: eixo, font: { size: 10.5 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: eixo, font: { size: 10.5 }, callback: v => formatarValor(v) }, grid: { color: 'rgba(127,127,127,.12)' } },
      },
    },
  });
  pdvGraficos.push(g);
}
// Barras diárias de vendas com média móvel de 7 dias (a linha mostra a tendência sem o sobe-e-desce de cada dia).
function pdvGraficoDias(canvasId, dias){
  const el = document.getElementById(canvasId);
  if(!el || typeof Chart === 'undefined') return;
  const eixo = pdvEixo();
  const curto = dias.length > 45;
  const rot = dias.map(d => curto ? pdvDiaMes(d.data) : pdvDiaMes(d.data) + ' ' + PDV_DIAS_CURTO[pdvData(d.data).getDay()]);
  const vals = dias.map(d => (d.vendas === null || d.vendas === undefined) ? null : d.vendas);
  const mm = vals.map((_, i) => {
    if(i < 6) return null;
    const w = vals.slice(i - 6, i + 1).filter(v => v !== null);
    return w.length >= 5 ? w.reduce((s, v) => s + v, 0) / w.length : null;
  });
  const datasets = [{ type: 'bar', label: 'Vendas por itens', data: vals, backgroundColor: pdvCor(), borderRadius: 3, maxBarThickness: 34, order: 2 }];
  if(mm.some(v => v !== null)) datasets.push({ type: 'line', label: 'Média móvel de 7 dias', data: mm, borderColor: eixo, backgroundColor: eixo, borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true, order: 1 });
  const g = new Chart(el, {
    data: { labels: rot, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { color: eixo, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => c.dataset.label + ': ' + pdvMoeda(c.parsed.y) } } },
      scales: {
        x: { ticks: { color: eixo, font: { size: 10.5 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: eixo, font: { size: 10.5 }, callback: v => pdvMoeda(v) }, grid: { color: 'rgba(127,127,127,.12)' } },
      },
    },
  });
  pdvGraficos.push(g);
}
function pdvCor(){ return (typeof corAccentGrafico === 'function') ? corAccentGrafico() : '#1F6B47'; }
function pdvCorClara(){ return 'rgba(127,127,127,.38)'; }

function pdvErro(titulo, err, tentar){
  openOverlay(`${pdvCabecalho(titulo, '')}
    <p style="color:var(--red); font-size:13px;">Não foi possível carregar: ${pdvEsc(err && err.message)}</p>
    <div class="panel-actions" style="margin-top:16px;"><button type="button" class="btn ghost" id="pdvTentar">Tentar de novo</button></div>`);
  const b = document.getElementById('pdvTentar'); if(b) b.addEventListener('click', tentar);
}

/* ==========================================================================================
   CARGA E CASCA DO PAINEL
   ========================================================================================== */
// Pontos de entrada antigos continuam existindo (cartões, atalhos e favoritos que apontavam para eles).
function openVendasPdvPanel(){ return openPdvPanel('dias'); }
function openAnalisesPdvPanel(aba){
  const mapa = { geral: 'resumo', produtos: 'produtos', grupos: 'grupos', horas: 'quando', semana: 'quando' };
  return openPdvPanel(mapa[aba] || 'resumo');
}

async function openPdvPanel(aba){
  if(typeof aba === 'string' && aba) pdvAba = aba;
  if(!pdvPeriodo.inicio) pdvAplicarPreset('mes');
  return pdvCarregar();
}

async function pdvCarregar(){
  const meu = ++pdvCargaSeq;
  pdvLimparGraficos();
  pdvCmp = pdvPeriodoAnterior();
  pdvResumoAnt = null; pdvAnalisesAnt = null; pdvBase = null; pdvCmpEstado = 'carregando';
  openOverlay(pdvCabecalho('PDV', 'Carregando…'));
  try{
    const [r, a] = await Promise.all([
      apiFetch('/api/pdv-relatorios/resumo?' + pdvQS()),
      apiFetch('/api/pdv-relatorios/analises?' + pdvQS()),
    ]);
    if(meu !== pdvCargaSeq) return;
    pdvResumo = r; pdvAnalises = a;
    renderPdv();
  }catch(err){ if(meu === pdvCargaSeq) pdvErro('PDV', err, () => pdvCarregar()); return; }

  // Comparação e base de 90 dias: só para a leitura de gestão, e em segundo plano (a tela já está de pé).
  if(!pdvInteligencia()) return;
  const qAnt = 'inicio=' + pdvCmp.inicio + '&fim=' + pdvCmp.fim;
  const hoje = pdvISO(new Date());
  const [ra, aa, rb] = await Promise.all([
    apiFetch('/api/pdv-relatorios/resumo?' + qAnt).catch(() => null),
    apiFetch('/api/pdv-relatorios/analises?' + qAnt).catch(() => null),
    apiFetch('/api/pdv-relatorios/resumo?inicio=' + pdvSomaDias(hoje, -90) + '&fim=' + hoje).catch(() => null),
  ]);
  if(meu !== pdvCargaSeq) return;
  pdvResumoAnt = ra; pdvAnalisesAnt = aa; pdvBase = rb;
  pdvCmpEstado = (ra && aa) ? 'ok' : 'indisponivel';
  pdvRenderAba();
}

function renderPdv(){
  if(!pdvResumo || !pdvAnalises){ openPdvPanel(); return; }
  const c = pdvResumo.cobertura || {};
  const abas = pdvAbasDisponiveis();
  if(!abas.some(x => x[0] === pdvAba)) pdvAba = 'resumo';
  const nq = pdvModoAdmin() ? pdvQualidade().filter(x => x.nivel === 'atencao').length : 0;
  const tabs = abas.map(x => `<button type="button" class="btn ${pdvAba===x[0]?'gold':'ghost'} pdv-tab" data-aba="${x[0]}" style="margin-right:8px; margin-bottom:8px;">${x[1]}${x[0] === 'qualidade' && nq ? ' (' + nq + ')' : ''}</button>`).join('');
  pdvLimparGraficos();
  openOverlay(`
    ${pdvCabecalho('PDV', 'Vendas, fechamento do caixa e análise de produtos, recebidos automaticamente do AutoPlus. Somente leitura: não gera lançamento financeiro.')}
    ${pdvFiltroHtml()}
    <p style="font-size:11.5px; color:var(--ink-faint); margin:-6px 0 14px;">
      Último fechamento recebido: <strong>${c.ultimo_fechamento ? pdvDataBR(c.ultimo_fechamento) : '—'}</strong> ·
      Última venda recebida: <strong>${c.ultima_venda ? pdvDataBR(c.ultima_venda) : '—'}</strong> ·
      Último envio da loja: <strong>${pdvDataHoraBR(c.ultimo_envio)}</strong>
    </p>
    <div style="margin-bottom:12px;">${tabs}</div>
    <div id="pdvAbaConteudo"></div>
    <div class="panel-actions" id="pdvAcoes" style="margin-top:20px;"></div>
  `);
  pdvLigarFiltro(() => pdvCarregar());
  document.querySelectorAll('.pdv-tab').forEach(b => b.addEventListener('click', () => { pdvAba = b.dataset.aba; pdvRenderAba(); }));
  pdvRenderAba();
}

// Redesenha só o conteúdo da aba (não mexe no filtro nem na posição de rolagem do painel).
function pdvRenderAba(){
  const alvo = document.getElementById('pdvAbaConteudo');
  const acoes = document.getElementById('pdvAcoes');
  if(!alvo || !acoes || !pdvResumo || !pdvAnalises) return;
  pdvLimparGraficos();
  document.querySelectorAll('.pdv-tab').forEach(b => { const on = b.dataset.aba === pdvAba; b.classList.toggle('gold', on); b.classList.toggle('ghost', !on); });
  const sem = !pdvResumo.por_dia.length && !pdvAnalises.geral.cupons;
  const fechar = '<button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button>';
  if(sem){
    alvo.innerHTML = '<p style="font-size:13px; color:var(--ink-soft);">Nenhuma venda ou fechamento recebido neste período.</p>';
    acoes.innerHTML = fechar; return;
  }
  const rend = { resumo: pdvAbaResumo, dias: pdvAbaDias, produtos: pdvAbaProdutos, grupos: pdvAbaGrupos, quando: pdvAbaQuando,
    gestao: pdvAbaGestao, qualidade: pdvAbaQualidade }[pdvAba] || pdvAbaResumo;
  rend(alvo);
  acoes.innerHTML = (pdvAba === 'dias' ? '<button type="button" class="btn ghost" id="pdvExcelDias">Exportar para Excel</button>' : '') +
    (pdvAba === 'produtos' ? '<button type="button" class="btn ghost" id="pdvExcelProdutos">Exportar para Excel</button>' : '') + fechar;
  const ed = document.getElementById('pdvExcelDias'); if(ed) ed.addEventListener('click', exportarVendasPdvExcel);
  const ep = document.getElementById('pdvExcelProdutos'); if(ep) ep.addEventListener('click', exportarProdutosPdvExcel);
}

// Abre um cartão interno do PDV: ao fechar, volta para o painel (precisa do index.html v3.4+;
// sem ele, cai no comportamento antigo).
function pdvOverlayFilho(html){ if(typeof openOverlayFilho === 'function') openOverlayFilho(renderPdv, html); else openOverlay(html); }

/* ==========================================================================================
   CÁLCULOS (sem tela)
   ========================================================================================== */
// Fechamento gravado no meio do dia (foto parcial): vendas por itens acima do fechamento + descontos.
function pdvIncompleto(d){
  const f = d.fechamento;
  return !!(f && d.vendas !== null && d.vendas !== undefined && (d.vendas - (f.total + (f.descontos || 0))) > Math.max(1, d.vendas * 0.002));
}

// Média por dia com venda, só com dias completos (hoje fica de fora: o dia ainda está andando).
function pdvMediaDia(r){
  if(!r || !r.por_dia) return null;
  const hoje = pdvISO(new Date());
  let ds = r.por_dia.filter(d => (d.vendas || 0) > 0 && d.data < hoje);
  if(!ds.length) ds = r.por_dia.filter(d => (d.vendas || 0) > 0);
  return ds.length ? { media: ds.reduce((s, d) => s + d.vendas, 0) / ds.length, dias: ds.length } : null;
}

// Venda esperada por dia da semana = soma das vendas ÷ vezes que aquele dia aconteceu no calendário
// (dias sem venda contam como zero, então domingo fechado dá zero). Janela: até 90 dias, a partir do primeiro dado.
function pdvEsperadoSemana(){
  if(!pdvBase || !pdvBase.por_dia) return null;
  const hoje = pdvISO(new Date());
  const dias = pdvBase.por_dia.filter(d => d.data < hoje);
  if(dias.length < 14) return null;
  const primeira = dias.reduce((m, d) => d.data < m ? d.data : m, dias[0].data);
  const soma = [0, 0, 0, 0, 0, 0, 0], oc = [0, 0, 0, 0, 0, 0, 0];
  for(let dt = pdvData(primeira); pdvISO(dt) < hoje; dt.setDate(dt.getDate() + 1)) oc[dt.getDay()]++;
  dias.forEach(d => { if(d.vendas > 0) soma[pdvData(d.data).getDay()] += d.vendas; });
  return { esp: soma.map((s, i) => oc[i] ? s / oc[i] : 0), desde: primeira, semanas: Math.round(oc.reduce((x, y) => x + y, 0) / 7) };
}

// Projeção do que falta no período escolhido (só quando ele tem dias futuros). É ESTIMATIVA: média por dia da semana,
// sem feriado, promoção ou sazonalidade.
function pdvProjecao(){
  const hoje = pdvISO(new Date());
  if(!pdvResumo || pdvPeriodo.inicio > hoje || pdvPeriodo.fim <= hoje) return null;
  const be = pdvEsperadoSemana(); if(!be) return null;
  let realizado = 0, hojeVenda = 0;
  pdvResumo.por_dia.forEach(d => { const v = d.vendas || 0; if(d.data < hoje) realizado += v; else if(d.data === hoje) hojeVenda = v; });
  const hojeEst = Math.max(hojeVenda, be.esp[new Date().getDay()]);
  let resto = 0, diasResto = 0;
  for(let dt = pdvData(hoje); ; ){
    dt.setDate(dt.getDate() + 1);
    if(pdvISO(dt) > pdvPeriodo.fim) break;
    resto += be.esp[dt.getDay()]; diasResto++;
  }
  return { valor: realizado + hojeEst + resto, realizado, hojeVenda, hojeEst, resto, diasResto, desde: be.desde, semanas: be.semanas };
}

/* ---------- produtos ---------- */
// Curva ABC por faturamento: A = até 80% acumulado, B = até 95%, C = restante.
function pdvCurvaABC(produtos, total){
  let acum = 0;
  return produtos.map((p, i) => {
    acum += p.vendas || 0;
    const pctAcum = total ? acum / total * 100 : 0;
    const antes = total ? (acum - (p.vendas || 0)) / total * 100 : 0;
    return Object.assign({}, p, { posicao: i + 1, pct: total ? (p.vendas || 0) / total * 100 : 0, pct_acum: pctAcum, classe: antes < 80 ? 'A' : (antes < 95 ? 'B' : 'C') });
  });
}
const pdvChaveProd = p => String(p.codigo_barras || p.descricao || '');
// Itens que não identificam produto (código 0 = avulso, 1 = "item em cadastro", sem cadastro): não entram em alta/queda.
const pdvEhGenerico = p => ['0', '1'].includes(String(p.codigo_barras)) || p.descricao === '(sem cadastro)';

// Uma linha por produto do período, com o que ele vendia no período anterior; produtos que sumiram entram ao final.
function pdvLinhasProdutos(){
  const a = pdvAnalises, g = a.geral;
  const abc = pdvCurvaABC(a.produtos, g.vendas);
  const cmp = !!(pdvInteligencia() && pdvTemCmp() && pdvAnalisesAnt && pdvAnalisesAnt.produtos);
  const antMap = new Map();
  if(cmp) pdvAnalisesAnt.produtos.forEach(o => antMap.set(pdvChaveProd(o), o));
  const limiar = Math.max(100, (g.vendas || 0) * 0.002);
  const linhas = abc.map(p => {
    const o = cmp ? (antMap.get(pdvChaveProd(p)) || null) : null;
    const delta = p.vendas - (o ? o.vendas : 0);
    const varPct = o ? pdvVar(p.vendas, o.vendas) : null;
    const precoAtual = p.quantidade ? p.vendas / p.quantidade : null;
    const precoAnt = (o && o.quantidade && o.unidade === p.unidade) ? o.vendas / o.quantidade : null;
    const gen = pdvEhGenerico(p);
    return { p, o, delta, varPct, precoVar: (precoAtual !== null && precoAnt !== null) ? pdvVar(precoAtual, precoAnt) : null,
      novo: cmp && !o && !gen, sumiu: false, gen,
      alta: cmp && !gen && !!o && varPct !== null && varPct >= 10 && delta >= limiar,
      queda: cmp && !gen && !!o && varPct !== null && varPct <= -10 && delta <= -limiar };
  });
  if(cmp){
    const atual = new Set(abc.map(pdvChaveProd));
    pdvAnalisesAnt.produtos.forEach(o => {
      if(atual.has(pdvChaveProd(o)) || pdvEhGenerico(o) || o.vendas < limiar) return;
      linhas.push({ p: null, o, delta: -o.vendas, varPct: -100, precoVar: null, novo: false, sumiu: true, gen: false, alta: false, queda: false });
    });
  }
  return { linhas, cmp, limiar };
}

function pdvMovimentos(){
  const { linhas, cmp, limiar } = pdvLinhasProdutos();
  if(!cmp) return null;
  const alta = linhas.filter(l => l.alta).sort((x, y) => y.delta - x.delta);
  const queda = linhas.filter(l => l.queda).sort((x, y) => x.delta - y.delta);
  const novos = linhas.filter(l => l.novo && l.delta >= limiar).sort((x, y) => y.delta - x.delta);
  const sumiram = linhas.filter(l => l.sumiu).sort((x, y) => x.delta - y.delta);
  // Preço médio por unidade de medida (kg/un) que mudou 5% ou mais, com volume nos dois períodos.
  const preco = linhas.filter(l => l.p && l.o && !l.gen && l.precoVar !== null && Math.abs(l.precoVar) >= 5 && l.p.cupons >= 10 && l.o.cupons >= 10)
    .sort((x, y) => Math.abs(y.precoVar) - Math.abs(x.precoVar));
  return { alta, queda, novos, sumiram, preco, limiar };
}

// Participação por grupo (somando subgrupos) e, quando há comparação, variação contra o período anterior.
function pdvGruposAgrupados(){
  const a = pdvAnalises, soma = (lista) => { const m = new Map(); (lista || []).forEach(x => { const k = x.grupo || '(sem grupo)'; const o = m.get(k) || { grupo: k, vendas: 0, kg: 0, itens: 0, cupons: 0 }; o.vendas += x.vendas || 0; o.kg += x.kg || 0; o.itens += x.itens || 0; o.cupons += x.cupons || 0; m.set(k, o); }); return m; };
  const atual = soma(a.grupos), ant = (pdvInteligencia() && pdvTemCmp() && pdvAnalisesAnt) ? soma(pdvAnalisesAnt.grupos) : null;
  return Array.from(atual.values()).sort((x, y) => y.vendas - x.vendas).map(x => Object.assign({}, x, { ant: ant ? (ant.get(x.grupo) || null) : null }));
}

/* ---------- concentração e dependências (aba Gestão) ---------- */
function pdvConcentracao(){
  const a = pdvAnalises, g = a.geral;
  const abc = pdvCurvaABC(a.produtos, g.vendas);
  const ident = abc.filter(p => !pdvEhGenerico(p));
  const top = n => ident.slice(0, n).reduce((s, p) => s + (p.vendas || 0), 0);
  const nA = abc.filter(p => p.classe === 'A').length, nC = abc.filter(p => p.classe === 'C');
  const cauda = abc.filter(p => (p.cupons || 0) <= 3);
  const grupos = pdvGruposAgrupados();
  const dias = a.por_dia_semana.filter(d => d.dias > 0), totalSem = dias.reduce((s, d) => s + d.vendas, 0);
  const melhorDia = dias.slice().sort((x, y) => y.vendas / y.dias - x.vendas / x.dias)[0];
  const piorDia = dias.slice().sort((x, y) => x.vendas / x.dias - y.vendas / y.dias)[0];
  const horas = a.por_hora.slice().sort((x, y) => y.vendas - x.vendas);
  const f1 = a.faixas_cupom.find(f => f.faixa === 1), f45 = a.faixas_cupom.filter(f => f.faixa >= 4);
  const totalCupons = a.faixas_cupom.reduce((s, f) => s + f.cupons, 0);
  return {
    abc, nA, nProdutos: abc.length, nC: nC.length, vendasC: nC.reduce((s, p) => s + p.vendas, 0),
    top1: ident[0] || null, top1Pct: ident[0] ? ident[0].vendas / g.vendas * 100 : 0,
    top5Pct: top(5) / (g.vendas || 1) * 100, top10Pct: top(10) / (g.vendas || 1) * 100,
    cauda: cauda.length, caudaVendas: cauda.reduce((s, p) => s + p.vendas, 0),
    grupos, grupoTop: grupos[0] || null,
    melhorDia, piorDia, melhorDiaPct: melhorDia && totalSem ? melhorDia.vendas / totalSem * 100 : 0,
    top3Horas: horas.slice(0, 3), top3HorasPct: horas.slice(0, 3).reduce((s, h) => s + h.vendas, 0) / (g.vendas || 1) * 100,
    cuponsPequenosPct: f1 && totalCupons ? f1.cupons / totalCupons * 100 : 0, cuponsPequenosVendasPct: f1 && g.vendas ? f1.vendas / g.vendas * 100 : 0,
    cuponsGrandesPct: totalCupons ? f45.reduce((s, f) => s + f.cupons, 0) / totalCupons * 100 : 0, cuponsGrandesVendasPct: g.vendas ? f45.reduce((s, f) => s + f.vendas, 0) / g.vendas * 100 : 0,
  };
}

/* ---------- qualidade dos dados (aba Qualidade; só administrador) ---------- */
function pdvQualidade(){
  const r = pdvResumo, a = pdvAnalises, t = r.totais, g = a.geral, c = r.cobertura || {};
  const hoje = pdvISO(new Date()), ontem = pdvSomaDias(hoje, -1), ef = pdvPeriodoEfetivo();
  const L = [];
  const add = (rotulo, valor, nivel, obs) => L.push({ rotulo, valor, nivel, obs: obs || '' });
  const lista = (arr, max) => arr.slice(0, max || 8).map(pdvDiaMes).join(', ') + (arr.length > (max || 8) ? ' e mais ' + (arr.length - (max || 8)) : '');

  // Chegada de dados
  if(c.ultimo_envio){
    const h = (Date.now() - new Date(c.ultimo_envio).getTime()) / 3600000;
    add('Último envio da loja', pdvDataHoraBR(c.ultimo_envio), h > 36 ? 'atencao' : 'ok', h > 36 ? 'Faz ' + pdvNum(h / 24, 1) + ' dia(s) sem envio: conferir o robô da loja.' : '');
  }else add('Último envio da loja', '—', 'atencao', 'Nenhum envio registrado.');
  add('Último fechamento recebido', c.ultimo_fechamento ? pdvDataBR(c.ultimo_fechamento) : '—',
    (!c.ultimo_fechamento || c.ultimo_fechamento < ontem) ? 'atencao' : 'ok',
    (!c.ultimo_fechamento || c.ultimo_fechamento < ontem) ? 'O fechamento de ontem ainda não chegou.' : '');

  // Dias do período
  const semFech = r.por_dia.filter(d => !d.fechamento && (d.vendas || 0) > 0 && d.data < hoje).map(d => d.data);
  add('Dias com venda e sem fechamento do caixa', pdvNum(semFech.length), semFech.length ? 'atencao' : 'ok', semFech.length ? lista(semFech) : '');
  const inc = r.por_dia.filter(pdvIncompleto).map(d => d.data);
  add('Fechamento gravado antes do fim do dia (incompleto)', pdvNum(inc.length), inc.length ? 'atencao' : 'ok', inc.length ? lista(inc) + '. Esses dias não são lançados no financeiro até o fechamento ser atualizado.' : '');
  const comVenda = new Set(r.por_dia.filter(d => (d.vendas || 0) > 0).map(d => d.data));
  const fimCal = ef.fim < hoje ? ef.fim : ontem, sv = [];
  for(let dt = pdvData(ef.inicio); pdvISO(dt) <= fimCal; dt.setDate(dt.getDate() + 1)) if(!comVenda.has(pdvISO(dt))) sv.push(pdvISO(dt));
  const porDow = [0, 0, 0, 0, 0, 0, 0]; sv.forEach(d => porDow[pdvData(d).getDay()]++);
  const dowTxt = porDow.map((n, i) => n ? n + ' ' + PDV_DIAS_CURTO[i] : '').filter(Boolean).join(', ');
  add('Dias do período sem nenhuma venda recebida', pdvNum(sv.length), sv.length ? 'atencao' : 'ok',
    sv.length ? (sv.length <= 12 ? lista(sv, 12) + '. ' : '') + 'Por dia da semana: ' + dowTxt + '. Pode ser loja fechada ou falha de envio; não tenho como distinguir só por estes dados.' : '');

  // Itens x fechamento
  const comp = r.por_dia.filter(d => d.fechamento && d.vendas !== null && d.vendas !== undefined);
  if(comp.length){
    const dif = comp.reduce((s, d) => s + (d.vendas - d.fechamento.total), 0);
    const desc = comp.reduce((s, d) => s + (d.fechamento.descontos || 0), 0);
    const sobra = dif - desc, base = comp.reduce((s, d) => s + d.fechamento.total, 0);
    const alerta = Math.abs(sobra) > Math.max(50, base * 0.005);
    add('Vendas por itens − fechamento do caixa (dias fechados)', pdvMoeda(dif) + (base ? ' (' + pdvNum(dif / base * 100, 1) + '%)' : ''), alerta ? 'atencao' : 'ok',
      'Descontos informados no fechamento: ' + pdvMoeda(desc) + '. Resta sem explicação: ' + pdvMoeda(sobra) + '. ' + (alerta ? 'Causa não confirmada: conferir cupom cancelado, recebimento fora do caixa ou diferença de gravação.' : ''));
  }
  // Conciliação com a análise de mercadorias
  const e = a.entregas || { valor: 0, taxas: 0 };
  const difConc = (t.vendas_itens || 0) - (g.vendas || 0) - (e.valor || 0);
  add('Vendas por itens = mercadorias + taxa de entrega', pdvMoeda(t.vendas_itens) + ' = ' + pdvMoeda(g.vendas) + ' + ' + pdvMoeda(e.valor), Math.abs(difConc) < 1 ? 'ok' : 'atencao',
    Math.abs(difConc) < 1 ? 'Fecha.' : 'Não fecha: diferença de ' + pdvMoeda(difConc) + '.');

  // Cadastro
  const gen = g.vendas_generico || 0;
  add('Vendido como item genérico (sem produto identificado)', pdvMoeda(gen) + ' (' + pdvPct(gen, g.vendas) + ')', (g.vendas && gen / g.vendas >= 0.01) ? 'atencao' : 'ok',
    pdvNum(g.itens_generico) + ' itens. Esse valor entra no faturamento, mas não pode ser atribuído a nenhum produto, custo ou estoque.');
  const semCad = a.grupos.filter(x => /sem cadastro/i.test(x.grupo || '')).reduce((s, x) => s + x.vendas, 0);
  add('Vendido com código fora do cadastro', pdvMoeda(semCad) + ' (' + pdvPct(semCad, g.vendas) + ')', (g.vendas && semCad / g.vendas >= 0.005) ? 'atencao' : 'ok', '');
  if(t.descontos) add('Descontos informados nos fechamentos', pdvMoeda(t.descontos), 'info', '');
  return L;
}
/* ==========================================================================================
   DESTAQUES AUTOMÁTICOS E INDICADORES (leitura de gestão)
   Cada destaque é uma frase com número calculado dos dados; nada é suposição. "interno" = não vai para a cliente.
   ========================================================================================== */
function pdvInsights(){
  const out = [], add = (nivel, html, interno) => out.push({ nivel, html, interno: !!interno });
  const r = pdvResumo, a = pdvAnalises, t = r.totais, g = a.geral, hoje = pdvISO(new Date());
  const cmp = pdvTemCmp(), ant = cmp ? pdvResumoAnt.totais : null;
  const perAnt = pdvDataBR(pdvCmp.inicio) + ' a ' + pdvDataBR(pdvCmp.fim);

  if(cmp){
    const v = pdvVar(t.vendas_itens, ant.vendas_itens), mA = pdvMediaDia(r), mB = pdvMediaDia(pdvResumoAnt);
    let h = `Vendas por itens de <strong>${pdvMoeda(t.vendas_itens)}</strong> ${pdvDelta(v)} contra ${pdvMoeda(ant.vendas_itens)} no período anterior (${perAnt}).`;
    if(mA && mB) h += ` Por dia completo com venda: ${pdvMoeda(mA.media)} contra ${pdvMoeda(mB.media)} ${pdvDelta(pdvVar(mA.media, mB.media))}.`;
    add(v === null ? 'info' : (v >= 3 ? 'ok' : (v <= -3 ? 'atencao' : 'info')), h);
    const vc = pdvVar(t.cupons, ant.cupons), vt = pdvVar(t.ticket_medio, ant.ticket_medio);
    const leitura = (vc !== null && vt !== null) ? (vc < -3 && vt > 3 ? ' Menos clientes, cada um gastando mais.' : (vc > 3 && vt < -3 ? ' Mais clientes, com compra menor.' : '')) : '';
    add('info', `Cupons: ${pdvNum(t.cupons)} ${pdvDelta(vc)} · ticket médio ${pdvMoeda(t.ticket_medio)} ${pdvDelta(vt)}.${leitura}`);
  }else if(pdvCmpEstado === 'ok'){
    add('info', `Não há vendas recebidas no período anterior (${perAnt}): sem base de comparação.`, true);
  }else if(pdvCmpEstado === 'indisponivel'){
    add('info', 'Não foi possível carregar o período anterior; os comparativos ficam de fora.', true);
  }

  // Melhor e pior dia (só dias completos)
  const completos = r.por_dia.filter(d => d.data < hoje && (d.vendas || 0) > 0);
  if(completos.length >= 5){
    const ord = completos.slice().sort((x, y) => y.vendas - x.vendas), m = ord[0], p = ord[ord.length - 1];
    add('info', `Melhor dia: <strong>${pdvDataBR(m.data)}</strong> (${PDV_DIAS_CURTO[pdvData(m.data).getDay()]}) com ${pdvMoeda(m.vendas)}; pior dia com venda: ${pdvDataBR(p.data)} (${PDV_DIAS_CURTO[pdvData(p.data).getDay()]}) com ${pdvMoeda(p.vendas)}.`);
  }
  const sem = a.por_dia_semana.filter(d => d.dias > 0);
  if(sem.length >= 3){
    const ord = sem.slice().sort((x, y) => y.vendas / y.dias - x.vendas / x.dias), m = ord[0], p = ord[ord.length - 1];
    add('info', `Dia da semana mais forte: <strong>${PDV_DIAS[m.dia_semana]}</strong> (média de ${pdvMoeda(m.vendas / m.dias)} por dia); mais fraco: ${PDV_DIAS[p.dia_semana]} (${pdvMoeda(p.vendas / p.dias)}).`);
  }
  const cc = pdvConcentracao();
  if(cc.top3Horas.length === 3) add('info', `As três horas mais fortes (${cc.top3Horas.map(h => String(h.hora).padStart(2, '0') + 'h').join(', ')}) concentram ${pdvNum(cc.top3HorasPct, 1)}% das vendas de mercadoria.`);
  if(cc.top1) add('info', `Os 10 maiores produtos respondem por ${pdvNum(cc.top10Pct, 1)}% das vendas de mercadoria (o maior, ${pdvEsc(cc.top1.descricao)}, ${pdvNum(cc.top1Pct, 1)}%). ${pdvNum(cc.nA)} de ${pdvNum(cc.nProdutos)} produtos fazem 80% da venda.`, true);

  const mov = pdvMovimentos();
  if(mov){
    const lista = arr => arr.slice(0, 3).map(l => `${pdvEsc(l.p.descricao)} (${l.delta >= 0 ? '+' : '−'}${pdvMoeda(Math.abs(l.delta))})`).join('; ');
    if(mov.alta.length) add('ok', `Produtos em alta (mais de 10% e ao menos ${pdvMoeda(mov.limiar)} acima do período anterior): ${lista(mov.alta)}.`);
    if(mov.queda.length) add('atencao', `Produtos em queda (mais de 10% e ao menos ${pdvMoeda(mov.limiar)} abaixo do período anterior): ${lista(mov.queda)}.`);
    if(mov.novos.length) add('info', `Produtos que não vendiam no período anterior: ${mov.novos.slice(0, 3).map(l => `${pdvEsc(l.p.descricao)} (${pdvMoeda(l.p.vendas)})`).join('; ')}.`);
    if(mov.sumiram.length) add('info', `Produtos que vendiam e não venderam neste período: ${mov.sumiram.slice(0, 3).map(l => `${pdvEsc(l.o.descricao)} (era ${pdvMoeda(l.o.vendas)})`).join('; ')}.`, true);
    if(mov.preco.length) add('info', `Preço médio que mudou 5% ou mais: ${mov.preco.slice(0, 3).map(l => `${pdvEsc(l.p.descricao)} ${pdvMoeda(l.p.vendas / l.p.quantidade)}${l.p.unidade === 'KG' ? '/kg' : ''} ${pdvDelta(l.precoVar)}`).join('; ')}.`);
  }

  // Dados que o escritório precisa corrigir (não vão para a cliente)
  if(g.vendas && (g.vendas_generico || 0) / g.vendas >= 0.01)
    add('atencao', `${pdvNum((g.vendas_generico || 0) / g.vendas * 100, 1)}% das vendas (${pdvMoeda(g.vendas_generico)}) entraram como item genérico: sem produto identificado não há custo nem estoque para esse valor.`, true);
  const q = pdvQualidade().filter(x => x.nivel === 'atencao');
  if(q.length) add('atencao', `${q.length} ponto(s) de atenção na aba Qualidade dos dados.`, true);
  return out;
}

function pdvInsightsHtml(lista){
  const cor = { ok: 'var(--olive)', atencao: 'var(--red)', info: 'var(--gold)' };
  return lista.map(x => `<div style="border-left:3px solid ${cor[x.nivel] || cor.info}; padding:8px 12px; margin:6px 0; background:var(--paper-2); border-radius:6px; font-size:13px; color:var(--ink-soft); line-height:1.5;">${x.html}${x.interno ? ' <span class="tag-status tag-aberto" style="margin-left:6px;">interno</span>' : ''}</div>`).join('');
}

// Indicadores do período, com o período anterior ao lado (base do pacote do relatório mensal).
function pdvIndicadores(){
  const r = pdvResumo, t = r.totais, g = pdvAnalises.geral, e = pdvAnalises.entregas || { valor: 0 };
  const cmp = pdvTemCmp();
  const ra = cmp ? pdvResumoAnt.totais : null, ga = (cmp && pdvAnalisesAnt) ? pdvAnalisesAnt.geral : null, ea = (cmp && pdvAnalisesAnt) ? (pdvAnalisesAnt.entregas || { valor: 0 }) : null;
  const md = pdvMediaDia(r), mda = cmp ? pdvMediaDia(pdvResumoAnt) : null;
  const L = [
    ['Vendas por itens (R$)', t.vendas_itens, ra && ra.vendas_itens],
    ['Fechamento do caixa (R$)', t.fechamento, ra && ra.fechamento],
    ['Mercadorias, sem taxa de entrega (R$)', g.vendas, ga && ga.vendas],
    ['Taxa de entrega cobrada (R$)', e.valor, ea && ea.valor],
    ['Cupons', t.cupons, ra && ra.cupons],
    ['Ticket médio (R$)', t.ticket_medio, ra && ra.ticket_medio],
    ['Itens por cupom', g.itens_por_cupom, ga && ga.itens_por_cupom],
    ['Quilos vendidos', t.kg, ra && ra.kg],
    ['Preço médio por kg (R$)', g.preco_medio_kg, ga && ga.preco_medio_kg],
    ['Média por dia completo com venda (R$)', md && md.media, mda && mda.media],
    ['Dias com venda', t.dias_com_venda, ra && ra.dias_com_venda],
    ['Dinheiro (R$)', t.dinheiro, ra && ra.dinheiro],
    ['Cartão de crédito (R$)', t.cartao_credito, ra && ra.cartao_credito],
    ['Cartão de débito (R$)', t.cartao_debito, ra && ra.cartao_debito],
    ['PIX (R$)', t.pix, ra && ra.pix],
    ['Vendido como item genérico (R$)', g.vendas_generico, ga && ga.vendas_generico],
  ];
  return L.map(x => ({ nome: x[0], atual: x[1] === undefined ? null : x[1], ant: (x[2] === undefined) ? null : x[2], variacao: pdvVar(x[1], x[2]) }));
}

/* ==========================================================================================
   ABA RESUMO
   ========================================================================================== */
function pdvAbaResumo(alvo){
  const r = pdvResumo, a = pdvAnalises, t = r.totais, g = a.geral, adm = pdvInteligencia();
  const cmp = pdvTemCmp(), ant = cmp ? pdvResumoAnt.totais : null;
  const md = pdvMediaDia(r), mdAnt = cmp ? pdvMediaDia(pdvResumoAnt) : null;
  const abc = pdvCurvaABC(a.produtos, g.vendas), nA = abc.filter(p => p.classe === 'A').length;
  const melhorDia = a.por_dia_semana.filter(d => d.dias > 0).sort((x, y) => (y.vendas / y.dias) - (x.vendas / x.dias))[0];
  const melhorHora = a.por_hora.slice().sort((x, y) => y.vendas - x.vendas)[0];
  const e = a.entregas || { taxas: 0, valor: 0, dias: 0, por_valor: [] };

  let aviso = '';
  if(adm){
    if(pdvCmpEstado === 'carregando') aviso = pdvNota('Comparando com o período anterior…', '-6px 0 14px');
    else if(cmp && Math.abs(t.dias_com_venda - ant.dias_com_venda) > Math.max(2, ant.dias_com_venda * 0.25))
      aviso = pdvNota(`O período anterior (${pdvDataBR(pdvCmp.inicio)} a ${pdvDataBR(pdvCmp.fim)}) teve ${pdvNum(ant.dias_com_venda)} dia(s) com venda contra ${pdvNum(t.dias_com_venda)} neste. Compare pela média por dia, não pelo total.`, '-6px 0 14px');
  }

  const proj = adm ? pdvProjecao() : null;
  const projHtml = proj ? `<div style="border:1px dashed var(--border); border-radius:12px; padding:14px 16px; margin-bottom:18px;">
      <div style="font-size:10.5px; letter-spacing:1px; text-transform:uppercase; color:var(--ink-faint);">Projeção até ${pdvDataBR(pdvPeriodo.fim)} (estimativa)</div>
      <div style="font-size:22px; font-weight:600; color:var(--ink); margin-top:6px;">${pdvMoeda(proj.valor)}</div>
      <div style="font-size:12px; color:var(--ink-soft); margin-top:6px; line-height:1.5;">Já vendido até ontem: ${pdvMoeda(proj.realizado)} · hoje (esperado): ${pdvMoeda(proj.hojeEst)} · próximos ${pdvNum(proj.diasResto)} dia(s) (esperado): ${pdvMoeda(proj.resto)}.</div>
      ${pdvNota(`Estimativa pela média de cada dia da semana desde ${pdvDataBR(proj.desde)} (cerca de ${pdvNum(proj.semanas)} semanas), sem considerar feriado, promoção ou sazonalidade. Não é meta nem previsão garantida.`, '8px 0 0')}
    </div>` : '';

  const ins = adm ? pdvInsights() : [];
  alvo.innerHTML = `
    ${pdvGrade([
      pdvTileCmp('Vendas por itens', pdvMoeda(t.vendas_itens), t.vendas_itens, ant && ant.vendas_itens, pdvNum(t.dias_com_venda) + ' dia(s) com venda'),
      pdvTile('Fechamento do caixa', pdvMoeda(t.fechamento), pdvNum(t.dias_com_fechamento) + ' dia(s) fechado(s)'),
      pdvTileCmp('Cupons', pdvNum(t.cupons), t.cupons, ant && ant.cupons, pdvNum(g.itens_por_cupom, 1) + ' itens por cupom'),
      pdvTileCmp('Ticket médio', pdvMoeda(t.ticket_medio), t.ticket_medio, ant && ant.ticket_medio),
      pdvTileCmp('Média por dia', md ? pdvMoeda(md.media) : '—', md && md.media, mdAnt && mdAnt.media, 'dias completos com venda'),
      pdvTileCmp('Quilos vendidos', pdvNum(t.kg, 1) + ' kg', t.kg, ant && ant.kg, pdvPct(g.vendas_kg, g.vendas) + ' das vendas é por peso'),
    ])}
    ${aviso}
    ${projHtml}
    ${ins.length ? pdvTitulo('O que chama atenção') + pdvInsightsHtml(ins) + '<div style="height:14px;"></div>' : ''}
    ${pdvTitulo('Vendas por dia')}
    <div style="height:240px; margin-bottom:8px;"><canvas id="pdvChartDias"></canvas></div>
    ${pdvNota('Barras: vendas por itens de cada dia. Linha: média móvel de 7 dias.', '0 0 18px')}
    ${pdvGrade([
      pdvTile('Produtos que fazem 80% da venda', pdvNum(nA), 'de ' + pdvNum(abc.length) + ' vendidos (classe A)'),
      pdvTile('Dia mais forte', melhorDia ? PDV_DIAS[melhorDia.dia_semana] : '—', melhorDia ? pdvMoeda(melhorDia.vendas / melhorDia.dias) + ' em média' : ''),
      pdvTile('Hora mais forte', melhorHora ? String(melhorHora.hora).padStart(2, '0') + 'h' : '—', melhorHora ? pdvPct(melhorHora.vendas, g.vendas) + ' das vendas' : ''),
      pdvTile('Preço médio por kg', pdvMoeda(g.preco_medio_kg), 'todos os produtos por peso'),
    ])}
    ${e.taxas ? `${pdvTitulo('Entregas')}
      ${pdvGrade([
        pdvTile('Taxas de entrega cobradas', pdvNum(e.taxas), pdvNum(e.dias) + ' dia(s) com entrega'),
        pdvTile('Valor cobrado de taxa', pdvMoeda(e.valor), 'média de ' + pdvMoeda(e.valor / e.taxas) + ' por entrega'),
        pdvTile('Entregas por dia', pdvNum(g.dias ? e.taxas / g.dias : 0, 1), 'sobre os dias com venda'),
      ])}
      ${pdvNota('Por valor de taxa: ' + e.por_valor.map(x => pdvNum(x.taxas) + ' × ' + pdvMoeda(x.valor_taxa)).join(' · ') + '. A taxa de entrega é cobrada no cupom, mas não é mercadoria: fica fora de produtos, grupos e horários, e entra em "Vendas por itens".', '-8px 0 16px')}` : ''}
    ${g.vendas_generico ? `<p style="font-size:12px; color:var(--ink-soft); margin:0 0 16px; padding:10px 12px; border:1px dashed var(--border); border-radius:10px;">
      <strong>${pdvMoeda(g.vendas_generico)}</strong> (${pdvPct(g.vendas_generico, g.vendas)} das vendas, ${pdvNum(g.itens_generico)} itens) foram registrados no caixa como item genérico, com o valor digitado e sem dizer qual é o produto. Esse valor entra no faturamento, mas não pode ser atribuído a nenhum corte.</p>` : ''}
    ${pdvNota('Margem e rendimento de carcaça ainda não aparecem aqui: o custo e o estoque cadastrados no AutoPlus não são confiáveis (há custo zerado e estoque negativo). Essas leituras dependem do custo das compras lançadas no portal.', '12px 0 0')}`;
  pdvGraficoDias('pdvChartDias', r.por_dia);
}

/* ==========================================================================================
   ABA DIAS E FECHAMENTO (antiga "Vendas do PDV")
   ========================================================================================== */
function pdvAbaDias(alvo){
  const r = pdvResumo, t = r.totais, hoje = pdvISO(new Date()), adm = pdvInteligencia();
  const comparaveis = r.por_dia.filter(d => d.fechamento && d.vendas !== null && d.vendas !== undefined);
  const dif = comparaveis.length ? comparaveis.reduce((s, d) => s + (d.vendas - d.fechamento.total), 0) : null;
  const be = adm ? pdvEsperadoSemana() : null;
  const formas = [
    pdvTile('Dinheiro', pdvMoeda(t.dinheiro), pdvPct(t.dinheiro, t.fechamento) + ' do fechamento'),
    pdvTile('Cartão de crédito', pdvMoeda(t.cartao_credito), pdvPct(t.cartao_credito, t.fechamento) + ' do fechamento'),
    pdvTile('Cartão de débito', pdvMoeda(t.cartao_debito), pdvPct(t.cartao_debito, t.fechamento) + ' do fechamento'),
    pdvTile('PIX', pdvMoeda(t.pix), pdvPct(t.pix, t.fechamento) + ' do fechamento'),
  ];
  if(t.outros) formas.push(pdvTile('Outras formas', pdvMoeda(t.outros), pdvPct(t.outros, t.fechamento) + ' do fechamento'));

  const linhas = r.por_dia.map(d => {
    const f = d.fechamento, diff = (f && d.vendas !== null && d.vendas !== undefined) ? d.vendas - f.total : null, dow = pdvData(d.data).getDay();
    const vsEsp = (be && d.data < hoje && d.vendas > 0 && be.esp[dow] > 0) ? pdvDelta(pdvVar(d.vendas, be.esp[dow])) : '—';
    return `<tr class="pdv-dia" data-dia="${d.data}" style="cursor:pointer;" title="Ver os cupons deste dia">
      <td>${pdvDataBR(d.data)}</td><td>${PDV_DIAS_CURTO[dow]}</td>
      <td style="text-align:right; font-weight:600; color:var(--ink); white-space:nowrap;">${f ? pdvMoeda(f.total) + (pdvIncompleto(d) ? ' <span class="tag-status tag-atraso" title="O fechamento foi gravado antes do fim do dia: está menor que as vendas. Este dia não é lançado no financeiro até o fechamento ser atualizado.">incompleto</span>' : '') : '<span style="color:var(--ink-faint);">sem fechamento</span>'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.dinheiro) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.cartao_credito) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.cartao_debito) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.pix) : '—'}</td>
      <td style="text-align:right;">${d.vendas !== null && d.vendas !== undefined ? pdvMoeda(d.vendas) : '—'}</td>
      <td style="text-align:right; ${diff !== null && Math.abs(diff) >= 1 ? 'color:var(--red);' : ''}">${diff !== null ? pdvMoeda(diff) : '—'}</td>
      <td style="text-align:right;">${pdvNum(d.cupons)}</td>
      <td style="text-align:right;">${d.cupons ? pdvMoeda(d.vendas / d.cupons) : '—'}</td>
      ${adm ? `<td style="text-align:right;">${vsEsp}</td>` : ''}
    </tr>`;
  }).join('');

  alvo.innerHTML = `
    ${pdvGrade(formas)}
    <div style="height:240px; margin-bottom:8px;"><canvas id="pdvChartFech"></canvas></div>
    ${pdvNota('"Fechamento" é o total fechado no caixa, por forma de pagamento. "Vendas por itens" é a soma dos cupons. Diferença = itens − fechamento; diferenças de R$ 1,00 ou mais aparecem em vermelho para conferência. Dia marcado como "incompleto" teve o fechamento gravado antes do fim do expediente e não é lançado no financeiro enquanto não for atualizado.' +
      (dif !== null ? ' No período, nos dias já fechados: <strong>' + pdvMoeda(dif) + '</strong>.' : ''), '0 0 18px')}
    <div style="overflow-x:auto;">
    <table class="report" id="pdvTabelaDias">
      <thead><tr><th>Data</th><th>Dia</th><th style="text-align:right;">Fechamento</th><th style="text-align:right;">Dinheiro</th>
        <th style="text-align:right;">Crédito</th><th style="text-align:right;">Débito</th><th style="text-align:right;">PIX</th>
        <th style="text-align:right;">Vendas por itens</th><th style="text-align:right;">Diferença</th>
        <th style="text-align:right;">Cupons</th><th style="text-align:right;">Ticket</th>${adm ? '<th style="text-align:right;" title="Vendas por itens do dia contra a média daquele dia da semana nas últimas semanas">vs. média do dia</th>' : ''}</tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr style="font-weight:600;"><td colspan="2">Total</td>
        <td style="text-align:right;">${pdvMoeda(t.fechamento)}</td><td style="text-align:right;">${pdvMoeda(t.dinheiro)}</td>
        <td style="text-align:right;">${pdvMoeda(t.cartao_credito)}</td><td style="text-align:right;">${pdvMoeda(t.cartao_debito)}</td>
        <td style="text-align:right;">${pdvMoeda(t.pix)}</td><td style="text-align:right;">${pdvMoeda(t.vendas_itens)}</td>
        <td style="text-align:right;">${dif !== null ? pdvMoeda(dif) : '—'}</td>
        <td style="text-align:right;">${pdvNum(t.cupons)}</td><td style="text-align:right;">${pdvMoeda(t.ticket_medio)}</td>${adm ? '<td></td>' : ''}</tr></tfoot>
    </table></div>
    ${pdvNota('Clique em um dia para ver os cupons.' + (adm ? ' "vs. média do dia" compara o dia com a média do mesmo dia da semana nas últimas ~12 semanas' + (be ? '' : ' (ainda carregando ou sem histórico suficiente)') + '.' : ''))}`;
  alvo.querySelectorAll('.pdv-dia').forEach(tr => tr.addEventListener('click', () => openCuponsDoDia(tr.dataset.dia)));
  const curto = r.por_dia.length > 45;
  pdvBarras('pdvChartFech',
    r.por_dia.map(d => curto ? pdvDiaMes(d.data) : pdvDiaMes(d.data) + ' ' + PDV_DIAS_CURTO[pdvData(d.data).getDay()]),
    [{ rotulo: 'Fechamento', valores: r.por_dia.map(d => d.fechamento ? d.fechamento.total : null), cor: pdvCor() },
     { rotulo: 'Vendas por itens', valores: r.por_dia.map(d => d.vendas), cor: pdvCorClara() }],
    v => pdvMoeda(v));
}
/* ==========================================================================================
   ABA PRODUTOS (antiga "Cortes e produtos")
   ========================================================================================== */
function pdvCartaoMov(titulo, arr, tipo){
  const linhas = arr.slice(0, 5).map(l => {
    const pr = l.p || l.o;
    const dir = tipo === 'novos' ? pdvMoeda(l.p.vendas) : (tipo === 'sumiram' ? 'era ' + pdvMoeda(l.o.vendas) : (l.delta >= 0 ? '+' : '−') + pdvMoeda(Math.abs(l.delta)) + ' ' + pdvDelta(l.varPct));
    return `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12.5px; padding:4px 0; border-bottom:1px solid var(--border);"><span style="color:var(--ink); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pdvEsc(pr.descricao)}</span><span style="white-space:nowrap;">${dir}</span></div>`;
  }).join('') || '<div style="font-size:12px; color:var(--ink-faint);">Nenhum.</div>';
  return `<div style="border:1px solid var(--border); border-radius:12px; padding:12px 14px; background:var(--paper-2); min-width:0;"><div style="font-size:10.5px; letter-spacing:1px; text-transform:uppercase; color:var(--ink-faint); margin-bottom:6px;">${titulo} (${arr.length})</div>${linhas}</div>`;
}

function pdvAbaProdutos(alvo){
  const a = pdvAnalises, g = a.geral, adm = pdvInteligencia();
  const { linhas, cmp } = pdvLinhasProdutos();
  const mov = adm ? pdvMovimentos() : null;
  if(!cmp && ['alta', 'queda', 'novos', 'sumiram'].includes(pdvFiltroClasse)) pdvFiltroClasse = 'todos';
  const filtro = pdvFiltroProduto.trim().toLowerCase();
  let lista = linhas;
  if(['A', 'B', 'C'].includes(pdvFiltroClasse)) lista = lista.filter(l => l.p && l.p.classe === pdvFiltroClasse);
  else if(pdvFiltroClasse === 'alta') lista = lista.filter(l => l.alta).sort((x, y) => y.delta - x.delta);
  else if(pdvFiltroClasse === 'queda') lista = lista.filter(l => l.queda).sort((x, y) => x.delta - y.delta);
  else if(pdvFiltroClasse === 'novos') lista = lista.filter(l => l.novo).sort((x, y) => y.delta - x.delta);
  else if(pdvFiltroClasse === 'sumiram') lista = lista.filter(l => l.sumiu).sort((x, y) => x.delta - y.delta);
  if(filtro) lista = lista.filter(l => { const p = l.p || l.o; return (p.descricao + ' ' + (p.grupo || '') + ' ' + (p.subgrupo || '') + ' ' + p.codigo_barras).toLowerCase().includes(filtro); });
  const corClasse = { A: 'tag-pago', B: 'tag-aberto', C: 'tag-atraso' };
  const est = 'padding:9px 12px; border-radius:8px; border:1px solid var(--border); background:var(--paper-2); font-family:inherit; font-size:12.5px; color:var(--ink);';
  const opcoes = [['todos', 'Todos'], ['A', 'Classe A'], ['B', 'Classe B'], ['C', 'Classe C']].concat(cmp ? [['alta', 'Em alta'], ['queda', 'Em queda'], ['novos', 'Novos'], ['sumiram', 'Sumiram']] : []);
  const nCol = cmp ? 13 : 10;
  alvo.innerHTML = `
    ${mov ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:16px;">
      ${pdvCartaoMov('Em alta', mov.alta, 'alta')}${pdvCartaoMov('Em queda', mov.queda, 'queda')}${pdvCartaoMov('Novos', mov.novos, 'novos')}${pdvCartaoMov('Sumiram', mov.sumiram, 'sumiram')}</div>
      ${pdvNota('Em alta/queda: variação de mais de 10% e de pelo menos ' + pdvMoeda(mov.limiar) + ' contra o período anterior (' + pdvDataBR(pdvCmp.inicio) + ' a ' + pdvDataBR(pdvCmp.fim) + '). Itens genéricos e sem cadastro ficam de fora. Compare com cuidado se os períodos têm quantidade de dias diferente.', '-6px 0 16px')}` : (adm && pdvCmpEstado === 'carregando' ? pdvNota('Comparando com o período anterior…', '0 0 12px') : '')}
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px;">
      <input type="search" id="pdvBuscaProduto" placeholder="Buscar corte, produto, grupo ou código" value="${pdvEsc(pdvFiltroProduto)}"
        style="flex:1; min-width:220px; max-width:380px; ${est}">
      <select id="pdvClasse" style="${est}">${opcoes.map(o => `<option value="${o[0]}" ${pdvFiltroClasse === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <span style="font-size:11.5px; color:var(--ink-faint);">${pdvNum(lista.length)} de ${pdvNum(linhas.length)} linha(s) · curva ABC por faturamento (A até 80%, B até 95%, C o restante)</span>
    </div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>#</th><th>Produto</th><th>Grupo</th><th style="text-align:right;">Quantidade</th><th style="text-align:right;">Preço médio</th>${cmp ? '<th style="text-align:right;">Preço vs. anterior</th>' : ''}
        <th style="text-align:right;">Vendas</th>${cmp ? '<th style="text-align:right;">Período anterior</th><th style="text-align:right;">Variação</th>' : ''}<th style="text-align:right;">% das vendas</th><th style="text-align:right;">% acumulado</th>
        <th style="text-align:right;">Cupons</th><th>ABC</th></tr></thead>
      <tbody>${lista.slice(0, 400).map(l => {
        const p = l.p, pr = l.p || l.o, kg = pr.unidade === 'KG';
        return `<tr${l.sumiu ? ' style="opacity:.7;"' : ''}>
        <td>${p ? p.posicao : '—'}</td><td style="color:var(--ink);">${pdvEsc(pr.descricao)}${l.novo ? ' <span class="tag-status tag-aberto">novo</span>' : ''}${l.sumiu ? ' <span class="tag-status tag-atraso">sumiu</span>' : ''}</td>
        <td>${pdvEsc([pr.grupo, pr.subgrupo].filter(Boolean).join(' · ') || '—')}</td>
        <td style="text-align:right; white-space:nowrap;">${p ? pdvNum(p.quantidade, kg ? 1 : 0) + ' ' + (kg ? 'kg' : 'un') : '—'}</td>
        <td style="text-align:right; white-space:nowrap;">${p && p.quantidade ? pdvMoeda(p.vendas / p.quantidade) + (kg ? '/kg' : '') : '—'}</td>
        ${cmp ? `<td style="text-align:right;">${l.precoVar !== null ? pdvDelta(l.precoVar) : '—'}</td>` : ''}
        <td style="text-align:right; font-weight:600; color:var(--ink);">${p ? pdvMoeda(p.vendas) : pdvMoeda(0)}</td>
        ${cmp ? `<td style="text-align:right;">${l.o ? pdvMoeda(l.o.vendas) : '—'}</td><td style="text-align:right; white-space:nowrap;">${l.o || l.sumiu ? (l.delta >= 0 ? '+' : '−') + pdvMoeda(Math.abs(l.delta)) + ' ' + pdvDelta(l.varPct) : '—'}</td>` : ''}
        <td style="text-align:right;">${p ? pdvNum(p.pct, 1) + '%' : '—'}</td><td style="text-align:right;">${p ? pdvNum(p.pct_acum, 1) + '%' : '—'}</td>
        <td style="text-align:right;">${p ? pdvNum(p.cupons) : '—'}</td>
        <td>${p ? `<span class="tag-status ${corClasse[p.classe]}">${p.classe}</span>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="${nCol}">Nenhum produto encontrado.</td></tr>`}</tbody>
    </table></div>
    ${lista.length > 400 ? pdvNota('Mostrando os 400 primeiros. Use a busca ou exporte para Excel para ver todos.') : ''}`;
  const busca = document.getElementById('pdvBuscaProduto');
  busca.addEventListener('input', () => {
    pdvFiltroProduto = busca.value; const pos = busca.selectionStart;
    pdvAbaProdutos(alvo);
    const n = document.getElementById('pdvBuscaProduto'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){}
  });
  document.getElementById('pdvClasse').addEventListener('change', ev => { pdvFiltroClasse = ev.target.value; pdvAbaProdutos(alvo); });
}

function exportarProdutosPdvExcel(){
  if(typeof XLSX === 'undefined' || !pdvAnalises) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pdvPlanilhaProdutos()), 'Produtos PDV');
  XLSX.writeFile(wb, `Produtos PDV ${pdvPeriodo.inicio} a ${pdvPeriodo.fim}.xlsx`);
}
function pdvPlanilhaProdutos(){
  return pdvLinhasProdutos().linhas.map(l => {
    const p = l.p, pr = l.p || l.o;
    const linha = {
      'Posição': p ? p.posicao : null, 'Código': pr.codigo_barras, 'Produto': pr.descricao, 'Grupo': pr.grupo || '', 'Subgrupo': pr.subgrupo || '',
      'Unidade': pr.unidade || '', 'Quantidade': p ? p.quantidade : 0, 'Preço médio': (p && p.quantidade) ? p.vendas / p.quantidade : null,
      'Vendas': p ? p.vendas : 0, '% das vendas': p ? p.pct : null, '% acumulado': p ? p.pct_acum : null, 'Cupons': p ? p.cupons : 0, 'Classe ABC': p ? p.classe : '',
    };
    if(pdvInteligencia() && pdvTemCmp()){
      linha['Vendas no período anterior'] = l.o ? l.o.vendas : null;
      linha['Variação R$'] = (l.o || l.sumiu) ? l.delta : null;
      linha['Variação %'] = l.varPct;
      linha['Variação do preço médio %'] = l.precoVar;
      linha['Situação'] = l.sumiu ? 'sumiu' : (l.novo ? 'novo' : (l.alta ? 'em alta' : (l.queda ? 'em queda' : '')));
    }
    return linha;
  });
}

/* ==========================================================================================
   ABA GRUPOS
   ========================================================================================== */
function pdvAbaGrupos(alvo){
  const a = pdvAnalises, g = a.geral, cmp = pdvInteligencia() && pdvTemCmp() && !!pdvAnalisesAnt;
  const antMap = new Map(); if(cmp) pdvAnalisesAnt.grupos.forEach(x => antMap.set((x.grupo || '') + '|' + (x.subgrupo || ''), x));
  const ag = pdvGruposAgrupados().slice(0, 10);
  alvo.innerHTML = `
    <div style="height:240px; margin-bottom:14px;"><canvas id="pdvChartGrupos"></canvas></div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Grupo</th><th>Subgrupo</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th>${cmp ? '<th style="text-align:right;">Período anterior</th><th style="text-align:right;">Variação</th>' : ''}
        <th style="text-align:right;">Quilos</th><th style="text-align:right;">Preço médio/kg</th><th style="text-align:right;">Itens</th><th style="text-align:right;">Cupons</th></tr></thead>
      <tbody>${a.grupos.map(x => { const o = cmp ? antMap.get((x.grupo || '') + '|' + (x.subgrupo || '')) : null; return `<tr><td style="color:var(--ink);">${pdvEsc(x.grupo)}</td><td>${pdvEsc(x.subgrupo || '—')}</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(x.vendas)}</td><td style="text-align:right;">${pdvPct(x.vendas, g.vendas)}</td>
        ${cmp ? `<td style="text-align:right;">${o ? pdvMoeda(o.vendas) : '—'}</td><td style="text-align:right;">${o ? pdvDelta(pdvVar(x.vendas, o.vendas)) : '<span style="color:var(--ink-faint);">novo</span>'}</td>` : ''}
        <td style="text-align:right;">${x.kg ? pdvNum(x.kg, 1) + ' kg' : '—'}</td>
        <td style="text-align:right;">${x.kg ? '≈ ' + pdvMoeda(x.vendas / x.kg) : '—'}</td>
        <td style="text-align:right;">${pdvNum(x.itens)}</td><td style="text-align:right;">${pdvNum(x.cupons)}</td></tr>`; }).join('')}</tbody>
    </table></div>
    ${pdvNota('Grupo e subgrupo vêm do cadastro de produtos do AutoPlus. "(sem cadastro)" reúne itens sem código ou com código que não está mais no cadastro. O preço médio por kg é aproximado quando o grupo mistura produtos por peso e por unidade. O gráfico soma os subgrupos de cada grupo.')}`;
  pdvBarras('pdvChartGrupos', ag.map(x => x.grupo), [{ rotulo: 'Vendas', valores: ag.map(x => x.vendas), cor: pdvCor() }], v => pdvMoeda(v));
}

/* ==========================================================================================
   ABA QUANDO VENDE (horários, dias da semana, faixas de valor do cupom)
   ========================================================================================== */
function pdvAbaQuando(alvo){
  const a = pdvAnalises, g = a.geral;
  const ordem = [1, 2, 3, 4, 5, 6, 0].map(d => a.por_dia_semana.find(x => x.dia_semana === d)).filter(Boolean);
  const totalCupons = a.faixas_cupom.reduce((s, f) => s + f.cupons, 0);
  alvo.innerHTML = `
    ${pdvTitulo('Por hora do dia')}
    <div style="height:240px; margin-bottom:14px;"><canvas id="pdvChartHoras"></canvas></div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Hora</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th><th style="text-align:right;">Cupons</th>
        <th style="text-align:right;">Ticket médio</th><th style="text-align:right;">Média por dia</th></tr></thead>
      <tbody>${a.por_hora.map(h => `<tr><td style="color:var(--ink);">${String(h.hora).padStart(2, '0')}h às ${String(h.hora).padStart(2, '0')}h59</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(h.vendas)}</td><td style="text-align:right;">${pdvPct(h.vendas, g.vendas)}</td>
        <td style="text-align:right;">${pdvNum(h.cupons)}</td><td style="text-align:right;">${pdvMoeda(h.cupons ? h.vendas / h.cupons : null)}</td>
        <td style="text-align:right;">${pdvMoeda(g.dias ? h.vendas / g.dias : null)}</td></tr>`).join('')}</tbody>
    </table></div>
    ${pdvNota('Hora do fechamento do cupom. Nos cupons já importados pela retaguarda do AutoPlus a hora vem arredondada, por isso a leitura é por hora cheia. "Média por dia" divide pelas datas com venda no período.')}
    ${pdvTitulo('Por dia da semana', 22)}
    <div style="height:240px; margin-bottom:14px;"><canvas id="pdvChartSemana"></canvas></div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Dia da semana</th><th style="text-align:right;">Dias no período</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th>
        <th style="text-align:right;">Média por dia</th><th style="text-align:right;">Cupons por dia</th><th style="text-align:right;">Ticket médio</th></tr></thead>
      <tbody>${ordem.map(d => `<tr><td style="color:var(--ink);">${PDV_DIAS[d.dia_semana]}</td><td style="text-align:right;">${pdvNum(d.dias)}</td>
        <td style="text-align:right;">${pdvMoeda(d.vendas)}</td><td style="text-align:right;">${pdvPct(d.vendas, g.vendas)}</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(d.vendas / d.dias)}</td>
        <td style="text-align:right;">${pdvNum(d.cupons / d.dias, 0)}</td><td style="text-align:right;">${pdvMoeda(d.cupons ? d.vendas / d.cupons : null)}</td></tr>`).join('')}</tbody>
    </table></div>
    ${pdvTitulo('Cupons por faixa de valor', 22)}
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Faixa</th><th style="text-align:right;">Cupons</th><th style="text-align:right;">% dos cupons</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th></tr></thead>
      <tbody>${a.faixas_cupom.map(f => `<tr><td style="color:var(--ink);">${PDV_FAIXAS[f.faixa]}</td>
        <td style="text-align:right;">${pdvNum(f.cupons)}</td><td style="text-align:right;">${pdvPct(f.cupons, totalCupons)}</td>
        <td style="text-align:right;">${pdvMoeda(f.vendas)}</td><td style="text-align:right;">${pdvPct(f.vendas, g.vendas)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  pdvBarras('pdvChartHoras', a.por_hora.map(h => String(h.hora).padStart(2, '0') + 'h'),
    [{ rotulo: 'Média de vendas por dia', valores: a.por_hora.map(h => g.dias ? h.vendas / g.dias : 0), cor: pdvCor() }], v => pdvMoeda(v));
  pdvBarras('pdvChartSemana', ordem.map(d => PDV_DIAS[d.dia_semana]),
    [{ rotulo: 'Média de vendas por dia', valores: ordem.map(d => d.vendas / d.dias), cor: pdvCor() }], v => pdvMoeda(v));
}

/* ==========================================================================================
   ABA GESTÃO (só administrador): leituras para decisão e material do relatório mensal
   ========================================================================================== */
function pdvTextoRelatorio(){
  const L = [], fmt = (nome, v) => v === null || v === undefined ? '—' : (/R\$/.test(nome) ? pdvMoeda(v) : pdvNum(v, Number.isInteger(v) ? 0 : 1));
  L.push('RASCUNHO PARA O RELATÓRIO MENSAL — PDV (revisar antes de enviar à cliente)');
  L.push('Período: ' + pdvDataBR(pdvPeriodo.inicio) + ' a ' + pdvDataBR(pdvPeriodo.fim));
  if(pdvTemCmp()) L.push('Comparado com: ' + pdvDataBR(pdvCmp.inicio) + ' a ' + pdvDataBR(pdvCmp.fim));
  L.push('', 'INDICADORES');
  pdvIndicadores().forEach(i => {
    let s = '- ' + i.nome + ': ' + fmt(i.nome, i.atual);
    if(i.ant !== null) s += ' (período anterior: ' + fmt(i.nome, i.ant) + (i.variacao !== null ? ', ' + (i.variacao >= 0 ? '+' : '−') + pdvNum(Math.abs(i.variacao), 1) + '%' : '') + ')';
    L.push(s);
  });
  const ins = pdvInsights(), proj = pdvProjecao();
  const externos = ins.filter(x => !x.interno), internos = ins.filter(x => x.interno);
  if(externos.length){ L.push('', 'DESTAQUES'); externos.forEach(x => L.push('- ' + pdvTexto(x.html))); }
  if(proj) L.push('', 'PROJEÇÃO (estimativa, não é meta)', '- Fechamento do período em torno de ' + pdvMoeda(proj.valor) + ', pela média de cada dia da semana desde ' + pdvDataBR(proj.desde) + '.');
  L.push('', 'NOTAS INTERNAS (NÃO ENVIAR)');
  internos.forEach(x => L.push('- ' + pdvTexto(x.html)));
  pdvQualidade().filter(x => x.nivel === 'atencao').forEach(x => L.push('- ' + x.rotulo + ': ' + x.valor + (x.obs ? '. ' + x.obs : '')));
  return L.join('\n');
}

async function pdvCopiarTexto(botao){
  const ta = document.getElementById('pdvTextoRel'); if(!ta) return;
  let ok = false;
  try{ await navigator.clipboard.writeText(ta.value); ok = true; }
  catch(e){ try{ ta.select(); ok = document.execCommand('copy'); }catch(e2){} }
  if(botao){ const o = botao.textContent; botao.textContent = ok ? 'Copiado' : 'Selecione o texto e copie (Ctrl+C)'; setTimeout(() => { botao.textContent = o; }, 2200); }
}

function pdvPacoteExcel(){
  if(typeof XLSX === 'undefined' || !pdvResumo) return;
  const wb = XLSX.utils.book_new(), add = (nome, linhas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ Aviso: 'Sem dados' }]), nome);
  const r = pdvResumo, a = pdvAnalises, per = pdvDataBR(pdvPeriodo.inicio) + ' a ' + pdvDataBR(pdvPeriodo.fim), perAnt = pdvTemCmp() ? pdvDataBR(pdvCmp.inicio) + ' a ' + pdvDataBR(pdvCmp.fim) : '(sem comparação)';
  add('Indicadores', pdvIndicadores().map(i => ({ 'Indicador': i.nome, ['Período: ' + per]: i.atual, ['Anterior: ' + perAnt]: i.ant, 'Variação %': i.variacao })));
  const proj = pdvProjecao();
  add('Destaques', pdvInsights().map(x => ({ 'Tipo': x.interno ? 'interno' : 'para a cliente', 'Nível': x.nivel, 'Texto': pdvTexto(x.html) }))
    .concat(proj ? [{ 'Tipo': 'interno', 'Nível': 'info', 'Texto': 'Projeção (estimativa): ' + pdvMoeda(proj.valor) + ' até ' + pdvDataBR(pdvPeriodo.fim) }] : []));
  add('Dias', r.por_dia.map(d => { const f = d.fechamento || {}; return {
    'Data': pdvDataBR(d.data), 'Dia': PDV_DIAS[pdvData(d.data).getDay()], 'Fechamento': f.total ?? null, 'Dinheiro': f.dinheiro ?? null,
    'Cartão de crédito': f.cartao_credito ?? null, 'Cartão de débito': f.cartao_debito ?? null, 'PIX': f.pix ?? null, 'Outras formas': f.outros ?? null,
    'Descontos': f.descontos ?? null, 'Vendas por itens': d.vendas, 'Cupons': d.cupons, 'Itens': d.itens, 'Quilos': d.kg }; }));
  add('Produtos', pdvPlanilhaProdutos());
  add('Grupos', a.grupos.map(x => ({ 'Grupo': x.grupo, 'Subgrupo': x.subgrupo || '', 'Vendas': x.vendas, '% das vendas': a.geral.vendas ? x.vendas / a.geral.vendas * 100 : null, 'Quilos': x.kg, 'Itens': x.itens, 'Cupons': x.cupons })));
  add('Horas', a.por_hora.map(h => ({ 'Hora': h.hora, 'Vendas': h.vendas, 'Cupons': h.cupons, 'Dias': h.dias })));
  add('Dia da semana', a.por_dia_semana.map(d => ({ 'Dia': PDV_DIAS[d.dia_semana], 'Dias no período': d.dias, 'Vendas': d.vendas, 'Cupons': d.cupons, 'Média por dia': d.dias ? d.vendas / d.dias : null })));
  add('Faixas de cupom', a.faixas_cupom.map(f => ({ 'Faixa': PDV_FAIXAS[f.faixa], 'Cupons': f.cupons, 'Vendas': f.vendas })));
  add('Qualidade dos dados', pdvQualidade().map(x => ({ 'Verificação': x.rotulo, 'Resultado': x.valor, 'Situação': x.nivel === 'ok' ? 'ok' : (x.nivel === 'atencao' ? 'atenção' : 'informação'), 'Observação': x.obs })));
  XLSX.writeFile(wb, `PDV pacote do relatório mensal ${pdvPeriodo.inicio} a ${pdvPeriodo.fim}.xlsx`);
}

function pdvAbaGestao(alvo){
  const g = pdvAnalises.geral, cc = pdvConcentracao(), mov = pdvMovimentos(), cmp = pdvTemCmp();
  const gt = cc.grupoTop;
  const tiles = [
    pdvTile('Maior produto', cc.top1 ? pdvEsc(cc.top1.descricao) : '—', cc.top1 ? pdvNum(cc.top1Pct, 1) + '% das vendas de mercadoria' : ''),
    pdvTile('10 maiores produtos', pdvNum(cc.top10Pct, 1) + '%', 'das vendas de mercadoria (os 5 maiores: ' + pdvNum(cc.top5Pct, 1) + '%)'),
    pdvTile('Produtos classe A', pdvNum(cc.nA) + ' de ' + pdvNum(cc.nProdutos), 'fazem 80% da venda'),
    pdvTile('Cauda longa', pdvNum(cc.cauda) + ' produtos', 'com até 3 cupons no período: ' + pdvMoeda(cc.caudaVendas) + ' (' + pdvPct(cc.caudaVendas, g.vendas) + ')'),
    pdvTile('Grupo dominante', gt ? pdvEsc(gt.grupo) : '—', gt ? pdvPct(gt.vendas, g.vendas) + ' das vendas' : ''),
    pdvTile('Dia mais forte', cc.melhorDia ? PDV_DIAS[cc.melhorDia.dia_semana] : '—', cc.melhorDia ? pdvNum(cc.melhorDiaPct, 1) + '% das vendas · mais fraco: ' + (cc.piorDia ? PDV_DIAS[cc.piorDia.dia_semana] : '—') : ''),
    pdvTile('3 horas mais fortes', cc.top3Horas.map(h => String(h.hora).padStart(2, '0') + 'h').join(' · ') || '—', pdvNum(cc.top3HorasPct, 1) + '% das vendas'),
    pdvTile('Cupons até R$ 20', pdvNum(cc.cuponsPequenosPct, 1) + '%', 'dos cupons, somando ' + pdvNum(cc.cuponsPequenosVendasPct, 1) + '% das vendas'),
    pdvTile('Cupons acima de R$ 100', pdvNum(cc.cuponsGrandesPct, 1) + '%', 'dos cupons, somando ' + pdvNum(cc.cuponsGrandesVendasPct, 1) + '% das vendas'),
    pdvTile('Item genérico', pdvPct(g.vendas_generico || 0, g.vendas), pdvMoeda(g.vendas_generico || 0) + ' sem produto identificado'),
  ];
  const grupos = cc.grupos.slice(0, 12);
  const texto = pdvTextoRelatorio();
  alvo.innerHTML = `
    ${pdvNota('Área do escritório: não aparece para a cliente. Dados de mercadoria (sem a taxa de entrega).', '0 0 14px')}
    ${pdvTitulo('Concentração e dependências')}
    ${pdvGrade(tiles)}
    ${pdvTitulo('Grupos: participação' + (cmp ? ' e variação' : ''))}
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Grupo</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th>${cmp ? '<th style="text-align:right;">Período anterior</th><th style="text-align:right;">Variação</th>' : ''}</tr></thead>
      <tbody>${grupos.map(x => `<tr><td style="color:var(--ink);">${pdvEsc(x.grupo)}</td><td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(x.vendas)}</td><td style="text-align:right;">${pdvPct(x.vendas, g.vendas)}</td>
        ${cmp ? `<td style="text-align:right;">${x.ant ? pdvMoeda(x.ant.vendas) : '—'}</td><td style="text-align:right;">${x.ant ? pdvDelta(pdvVar(x.vendas, x.ant.vendas)) : '—'}</td>` : ''}</tr>`).join('')}</tbody>
    </table></div>
    ${mov ? `${pdvTitulo('Produtos que mexeram o resultado', 22)}
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">${pdvCartaoMov('Em alta', mov.alta, 'alta')}${pdvCartaoMov('Em queda', mov.queda, 'queda')}${pdvCartaoMov('Sumiram', mov.sumiram, 'sumiram')}</div>
      ${mov.preco.length ? pdvTitulo('Preço médio que mudou 5% ou mais', 18) + `<div style="overflow-x:auto;"><table class="report"><thead><tr><th>Produto</th><th style="text-align:right;">Agora</th><th style="text-align:right;">Antes</th><th style="text-align:right;">Variação</th></tr></thead>
        <tbody>${mov.preco.slice(0, 10).map(l => { const u = l.p.unidade === 'KG' ? '/kg' : ''; return `<tr><td style="color:var(--ink);">${pdvEsc(l.p.descricao)}</td><td style="text-align:right;">${pdvMoeda(l.p.vendas / l.p.quantidade)}${u}</td><td style="text-align:right;">${pdvMoeda(l.o.vendas / l.o.quantidade)}${u}</td><td style="text-align:right;">${pdvDelta(l.precoVar)}</td></tr>`; }).join('')}</tbody></table></div>
        ${pdvNota('Preço médio = vendas ÷ quantidade, só produtos com ao menos 10 cupons nos dois períodos. Mistura de promoção, desconto e mudança de tabela: confirmar a causa antes de concluir.')}` : ''}` : (pdvCmpEstado === 'carregando' ? pdvNota('Carregando o período anterior para as comparações…', '14px 0 0') : '')}
    ${pdvTitulo('Relatório mensal', 22)}
    ${pdvNota('Rascunho em texto com os números deste período, separando o que pode ir para a cliente do que é nota interna. Revise antes de enviar. O pacote em Excel leva as mesmas leituras em abas (indicadores, destaques, dias, produtos, grupos, horários, dia da semana, faixas e qualidade dos dados).', '0 0 10px')}
    <textarea id="pdvTextoRel" readonly rows="14" style="width:100%; box-sizing:border-box; padding:12px; border-radius:10px; border:1px solid var(--border); background:var(--paper-2); font-family:inherit; font-size:12.5px; line-height:1.5; color:var(--ink);">${pdvEsc(texto)}</textarea>
    <div class="panel-actions" style="margin-top:10px; justify-content:flex-start;">
      <button type="button" class="btn gold" id="pdvCopiarTexto">Copiar texto</button>
      <button type="button" class="btn ghost" id="pdvPacote">Baixar pacote em Excel</button>
    </div>
    ${pdvNota('Ainda não entram aqui: margem, CMV e rendimento de carcaça (dependem do custo cadastrado e do vínculo produto ↔ estoque), perdas e quebra, e metas por cliente.', '14px 0 0')}`;
  document.getElementById('pdvCopiarTexto').addEventListener('click', ev => pdvCopiarTexto(ev.currentTarget));
  document.getElementById('pdvPacote').addEventListener('click', pdvPacoteExcel);
}

/* ==========================================================================================
   ABA QUALIDADE DOS DADOS (só administrador)
   ========================================================================================== */
function pdvAbaQualidade(alvo){
  const L = pdvQualidade();
  const chip = { ok: '<span class="tag-status tag-pago">ok</span>', atencao: '<span class="tag-status tag-atraso">atenção</span>', info: '<span class="tag-status tag-aberto">informação</span>' };
  alvo.innerHTML = `
    ${pdvNota('Área do escritório: o que ainda não chegou, não fecha ou não pode ser atribuído a um produto. Só lê os dados; nada é corrigido por aqui.', '0 0 14px')}
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Verificação</th><th>Resultado</th><th>Situação</th><th>Observação</th></tr></thead>
      <tbody>${L.map(x => `<tr><td style="color:var(--ink);">${pdvEsc(x.rotulo)}</td><td style="white-space:nowrap;">${pdvEsc(x.valor)}</td><td>${chip[x.nivel] || ''}</td><td style="font-size:12px; color:var(--ink-soft);">${pdvEsc(x.obs)}</td></tr>`).join('')}</tbody>
    </table></div>
    ${pdvNota('Período analisado: ' + pdvDataBR(pdvPeriodo.inicio) + ' a ' + pdvDataBR(pdvPeriodo.fim) + '. Hoje não entra nas contagens de dia sem fechamento nem sem venda, porque o dia ainda está em andamento.')}`;
}

function exportarVendasPdvExcel(){
  if(typeof XLSX === 'undefined' || !pdvResumo) return;
  const linhas = pdvResumo.por_dia.map(d => { const f = d.fechamento || {}; return {
    'Data': pdvDataBR(d.data), 'Dia': PDV_DIAS[pdvData(d.data).getDay()],
    'Fechamento': f.total ?? null, 'Dinheiro': f.dinheiro ?? null, 'Cartão de crédito': f.cartao_credito ?? null,
    'Cartão de débito': f.cartao_debito ?? null, 'PIX': f.pix ?? null, 'Outras formas': f.outros ?? null, 'Descontos': f.descontos ?? null,
    'Vendas por itens': d.vendas, 'Cupons': d.cupons, 'Itens': d.itens, 'Quilos': d.kg,
  }; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Vendas PDV');
  XLSX.writeFile(wb, `Vendas PDV ${pdvPeriodo.inicio} a ${pdvPeriodo.fim}.xlsx`);
}


async function openCuponsDoDia(dia){
  pdvLimparGraficos();
  const titulo = 'Cupons de ' + pdvDataBR(dia) + ' (' + PDV_DIAS[pdvData(dia).getDay()].toLowerCase() + ')';
  pdvOverlayFilho(pdvCabecalho(titulo, 'Carregando…'));
  try{
    const cupons = await apiFetch('/api/pdv-relatorios/cupons?data=' + dia);
    const total = cupons.reduce((s, c) => s + (c.valor || 0), 0);
    pdvOverlayFilho(`
      ${pdvCabecalho(titulo, pdvNum(cupons.length) + ' cupom(ns) · ' + pdvMoeda(total) + ' · ticket médio ' + pdvMoeda(cupons.length ? total / cupons.length : null))}
      <div style="overflow-x:auto;"><table class="report">
        <thead><tr><th>Hora</th><th>Cupom</th><th>Caixa</th><th style="text-align:right;">Itens</th><th style="text-align:right;">Valor</th></tr></thead>
        <tbody>${cupons.map(c => `<tr class="pdv-cupom" data-cupom="${pdvEsc(c.cupom)}" style="cursor:pointer;" title="Ver os itens deste cupom">
          <td>${pdvEsc(c.hora || '—')}</td><td>${pdvEsc(c.cupom)}</td><td>${pdvEsc(c.caixa ?? '—')}</td>
          <td style="text-align:right;">${pdvNum(c.itens)}</td><td style="text-align:right; color:var(--ink); font-weight:600;">${pdvMoeda(c.valor)}</td></tr>`).join('') ||
          '<tr><td colspan="5">Nenhum cupom recebido neste dia.</td></tr>'}</tbody>
      </table></div>
      <p style="font-size:11.5px; color:var(--ink-faint); margin-top:10px;">Clique em um cupom para ver os itens. A hora dos cupons já importados pela retaguarda do AutoPlus vem arredondada.</p>
      <div class="panel-actions" style="margin-top:20px;">
        <button type="button" class="btn ghost" id="pdvVoltarDias">← Voltar para os dias</button>
        <button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button>
      </div>`);
    document.getElementById('pdvVoltarDias').addEventListener('click', renderPdv);
    document.querySelectorAll('.pdv-cupom').forEach(tr => tr.addEventListener('click', () => openItensDoCupom(dia, tr.dataset.cupom)));
  }catch(err){ pdvErro(titulo, err, () => openCuponsDoDia(dia)); }
}

/* ---------- TICKET DO CUPOM (cartão sobre a mesma tela) ----------
   Ao clicar na linha de um cupom, abre um cartão em formato de ticket por cima da lista, sem trocar
   de tela. A lista de cupons continua por trás, com filtro e rolagem preservados. Fecha com ✕, Esc,
   clicando fora ou no botão Fechar. É só uma apresentação visual de conferência: não é documento fiscal. */
let pdvTicketSeq = 0; // cancela resposta que chega depois de o ticket ter sido fechado
function pdvTicketFechar(){
pdvTicketSeq++;
const box = document.getElementById('pdvTicketBox');
if(box) box.remove();
document.removeEventListener('keydown', pdvTicketTecla, true);
}
function pdvTicketTecla(e){
if(e.key === 'Escape'){ e.stopImmediatePropagation(); e.preventDefault(); pdvTicketFechar(); }
}
function pdvTicketEstilo(){
if(document.getElementById('pdvTicketCss')) return;
const st = document.createElement('style');
st.id = 'pdvTicketCss';
st.textContent = `
#pdvTicketBox{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px 4vh;background:rgba(27,20,24,.45);overflow:auto;}
#pdvTicketBox .pdv-tk{position:relative;width:min(560px,100%);margin:0 auto;filter:drop-shadow(0 12px 28px rgba(0,0,0,.35));}
#pdvTicketBox .pdv-tk::before,#pdvTicketBox .pdv-tk::after{content:"";display:block;height:9px;
background:linear-gradient(135deg,#fffdf6 50%,transparent 50%) 0 0/14px 14px repeat-x,linear-gradient(225deg,#fffdf6 50%,transparent 50%) 0 0/14px 14px repeat-x;}
#pdvTicketBox .pdv-tk::before{transform:scaleY(-1);}
#pdvTicketBox .pdv-tk-corpo{background:#fffdf6;color:#26211e;padding:10px 30px 20px;font-family:"Courier New",ui-monospace,Menlo,monospace;font-size:18px;line-height:1.5;}
#pdvTicketBox .pdv-tk-centro{text-align:center;}
#pdvTicketBox .pdv-tk-tit{font-weight:700;letter-spacing:.14em;font-size:20px;}
#pdvTicketBox .pdv-tk-sub{font-size:16px;color:#6b625b;}
#pdvTicketBox .pdv-tk-linha{border:0;border-top:1px dashed #9b918a;margin:14px 0;}
#pdvTicketBox .pdv-tk-meta{display:flex;justify-content:space-between;gap:12px;font-size:17px;}
#pdvTicketBox .pdv-tk-item{margin:10px 0;}
#pdvTicketBox .pdv-tk-item .nome{font-weight:700;text-transform:uppercase;word-break:break-word;}
#pdvTicketBox .pdv-tk-item .conta{display:flex;justify-content:space-between;gap:10px;color:#4b433d;}
#pdvTicketBox .pdv-tk-total{display:flex;justify-content:space-between;font-weight:700;font-size:23px;margin-top:6px;}
#pdvTicketBox .pdv-tk-aviso{font-size:15px;color:#6b625b;text-align:center;margin-top:10px;text-transform:uppercase;letter-spacing:.04em;}
#pdvTicketBox .pdv-tk-botoes{display:flex;justify-content:center;margin-top:16px;}
#pdvTicketBox .pdv-tk-x{position:absolute;top:18px;right:14px;border:0;background:transparent;font-size:22px;cursor:pointer;color:#6b625b;z-index:1;}
`;
document.head.appendChild(st);
}
function pdvTicketHtml(corpo){
return `<div class="pdv-tk" role="dialog" aria-modal="true" aria-label="Ticket do cupom">
<button type="button" class="pdv-tk-x" id="pdvTicketX" aria-label="Fechar">✕</button>
<div class="pdv-tk-corpo">${corpo}</div></div>`;
}
function pdvTicketMostrar(corpo, aoTentar){
pdvTicketEstilo();
let box = document.getElementById('pdvTicketBox');
if(!box){
box = document.createElement('div');
box.id = 'pdvTicketBox';
box.addEventListener('click', e => { if(e.target === box) pdvTicketFechar(); });
document.body.appendChild(box);
document.addEventListener('keydown', pdvTicketTecla, true);
}
box.innerHTML = pdvTicketHtml(corpo);
const x = document.getElementById('pdvTicketX'); if(x) x.addEventListener('click', pdvTicketFechar);
const f = document.getElementById('pdvTicketFechar'); if(f) f.addEventListener('click', pdvTicketFechar);
const t = document.getElementById('pdvTicketTentar'); if(t && aoTentar) t.addEventListener('click', aoTentar);
}

async function openItensDoCupom(dia, cupom){
const meu = ++pdvTicketSeq;
// Hora e caixa vêm da linha clicada na lista de cupons (a rota de itens não os devolve).
let hora = '', caixa = '';
const linha = Array.from(document.querySelectorAll('.pdv-cupom')).find(tr => tr.dataset.cupom === String(cupom));
if(linha && linha.cells){ hora = (linha.cells[0] && linha.cells[0].textContent || '').trim(); caixa = (linha.cells[2] && linha.cells[2].textContent || '').trim(); }
const cab = `<div class="pdv-tk-centro"><div class="pdv-tk-tit">CUPOM ${pdvEsc(cupom)}</div>
<div class="pdv-tk-sub">conferência interna</div></div><hr class="pdv-tk-linha">
<div class="pdv-tk-meta"><span>${pdvDataBR(dia)}${hora && hora !== '—' ? ' · ' + pdvEsc(hora) : ''}</span><span>${caixa && caixa !== '—' ? 'Caixa ' + pdvEsc(caixa) : ''}</span></div>`;
pdvTicketMostrar(`${cab}<hr class="pdv-tk-linha"><div class="pdv-tk-centro">Carregando…</div>`);
try{
const itens = await apiFetch('/api/pdv-relatorios/cupom-itens?data=' + dia + '&cupom=' + encodeURIComponent(cupom));
if(meu !== pdvTicketSeq || !document.getElementById('pdvTicketBox')) return;
const total = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
const linhas = itens.map((i, n) => {
const kg = i.unidade === 'KG';
const qtd = pdvNum(i.quantidade, kg ? 3 : 0) + (kg ? ' kg' : ' ' + pdvEsc((i.unidade || 'un').toLowerCase()));
return `<div class="pdv-tk-item"><div class="nome">${String(n + 1).padStart(2, '0')} ${pdvEsc(i.descricao)}</div>
<div class="conta"><span>${qtd} × ${pdvMoeda(i.valor_unitario)}</span><span><strong>${pdvMoeda(i.valor_total)}</strong></span></div></div>`;
}).join('') || '<div class="pdv-tk-centro">Nenhum item registrado neste cupom.</div>';
pdvTicketMostrar(`${cab}<hr class="pdv-tk-linha">${linhas}<hr class="pdv-tk-linha">
<div class="pdv-tk-meta"><span>${pdvNum(itens.length)} item(ns)</span><span></span></div>
<div class="pdv-tk-total"><span>TOTAL</span><span>${pdvMoeda(total)}</span></div>
<hr class="pdv-tk-linha">
<div class="pdv-tk-aviso">Conferência interna — não é documento fiscal</div>
<div class="pdv-tk-botoes"><button type="button" class="btn ghost" id="pdvTicketFechar">Fechar</button></div>`);
}catch(err){
if(meu !== pdvTicketSeq || !document.getElementById('pdvTicketBox')) return;
pdvTicketMostrar(`${cab}<hr class="pdv-tk-linha"><div class="pdv-tk-centro" style="color:#a3281f;">Não foi possível carregar: ${pdvEsc(err && err.message)}</div>
<div class="pdv-tk-botoes" style="gap:8px;"><button type="button" class="btn ghost" id="pdvTicketTentar">Tentar de novo</button><button type="button" class="btn ghost" id="pdvTicketFechar">Fechar</button></div>`, () => openItensDoCupom(dia, cupom));
}
}
