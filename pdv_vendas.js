/* ==========================================================================================
   VENDAS DO PDV E ANÁLISE DE VENDAS (pedido da Danielle, 06/10/2026) -- dois relatórios, só de
   leitura, sobre os dados que o bot da loja envia do AutoPlus (ver backend:
   src/routes/pdvIntegracao.js = entrada; src/routes/pdvRelatorios.js = estas leituras).

   (1) Vendas do PDV: fechamento do caixa por forma de pagamento e vendas por itens, dia a dia,
       com abertura do dia em cupons e do cupom em itens.
   (2) Análise de vendas: cortes/produtos (com curva ABC), grupos, horários, dias da semana e
       faixas de valor de cupom.

   Dois números de faturamento aparecem lado a lado e NÃO são a mesma coisa:
     - "Fechamento" = total que o operador fechou no caixa do AutoPlus, por forma de pagamento.
       Só existe depois do fechamento do dia.
     - "Vendas por itens" = soma dos itens dos cupons. Chega em minutos, mas não tem forma de
       pagamento.
   Nada aqui cria ou altera lançamento financeiro.
   ========================================================================================== */
let pdvPeriodo = { preset: 'mes', inicio: '', fim: '' };
let pdvResumo = null;
let pdvAnalises = null;
let pdvAbaAnalise = 'geral';
let pdvFiltroProduto = '';
let pdvGraficos = [];

const PDV_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PDV_DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const PDV_FAIXAS = { 1: 'Até R$ 20', 2: 'R$ 20 a 50', 3: 'R$ 50 a 100', 4: 'R$ 100 a 200', 5: 'Acima de R$ 200' };
const PDV_PRESETS = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['semana', 'Esta semana'], ['mes', 'Este mês'],
  ['mes_passado', 'Mês passado'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['livre', 'Personalizado'],
];

/* ---------- utilitários ---------- */
function pdvISO(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function pdvData(iso){ const p = String(iso).slice(0,10).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function pdvMoeda(v){ return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
function pdvNum(v, casas){ return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('pt-BR', {minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0}); }
function pdvPct(parte, total){ return total ? pdvNum(parte / total * 100, 1) + '%' : '—'; }
function pdvEsc(s){ return (typeof escapeHtml === 'function') ? escapeHtml(String(s === null || s === undefined ? '' : s)) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pdvDataBR(iso){ const p = String(iso).slice(0,10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function pdvDataHoraBR(ts){ if(!ts) return '—'; const d = new Date(ts); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }

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
function pdvGrade(tiles){ return `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin-bottom:18px;">${tiles.join('')}</div>`; }

function pdvCabecalho(titulo, sub){
  return `<div class="panel-head"><div><h2>${titulo}</h2><p>${sub}</p></div><button class="close-x" onclick="closeOverlay()">✕</button></div>`;
}

function pdvLimparGraficos(){ pdvGraficos.forEach(g => { try{ g.destroy(); }catch(e){} }); pdvGraficos = []; }

function pdvBarras(canvasId, rotulos, series, formatarValor){
  const el = document.getElementById(canvasId);
  if(!el || typeof Chart === 'undefined') return;
  const eixo = (typeof corEixoGrafico === 'function') ? corEixoGrafico() : 'rgba(27,43,58,.5)';
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
function pdvCor(){ return (typeof corAccentGrafico === 'function') ? corAccentGrafico() : '#1F6B47'; }
function pdvCorClara(){ return 'rgba(127,127,127,.38)'; }

function pdvErro(titulo, err, tentar){
  openOverlay(`${pdvCabecalho(titulo, '')}
    <p style="color:var(--red); font-size:13px;">Não foi possível carregar: ${pdvEsc(err && err.message)}</p>
    <div class="panel-actions" style="margin-top:16px;"><button type="button" class="btn ghost" id="pdvTentar">Tentar de novo</button></div>`);
  const b = document.getElementById('pdvTentar'); if(b) b.addEventListener('click', tentar);
}

/* ==========================================================================================
   (1) VENDAS DO PDV
   ========================================================================================== */
async function openVendasPdvPanel(){
  if(!pdvPeriodo.inicio) pdvAplicarPreset('mes');
  pdvLimparGraficos();
  openOverlay(pdvCabecalho('Vendas do PDV', 'Carregando…'));
  try{
    pdvResumo = await apiFetch('/api/pdv-relatorios/resumo?' + pdvQS());
    renderVendasPdv();
  }catch(err){ pdvErro('Vendas do PDV', err, openVendasPdvPanel); }
}

function renderVendasPdv(){
  const r = pdvResumo, t = r.totais, c = r.cobertura || {};
  pdvLimparGraficos();
  const semDados = r.por_dia.length === 0;
  // Diferença do período: só nos dias que têm os dois números (dia ainda não fechado fica de fora).
  const diasComparaveis = r.por_dia.filter(d => d.fechamento && d.vendas !== null);
  const dif = diasComparaveis.length ? diasComparaveis.reduce((s, d) => s + (d.vendas - d.fechamento.total), 0) : null;

  const tiles = [
    pdvTile('Fechamento do caixa', pdvMoeda(t.fechamento), t.dias_com_fechamento + ' dia(s) fechado(s)'),
    pdvTile('Vendas por itens', pdvMoeda(t.vendas_itens), t.dias_com_venda + ' dia(s) com venda'),
    pdvTile('Cupons', pdvNum(t.cupons), pdvNum(t.itens) + ' itens'),
    pdvTile('Ticket médio', pdvMoeda(t.ticket_medio), 'vendas por itens ÷ cupons'),
    pdvTile('Quilos vendidos', pdvNum(t.kg, 1) + ' kg', 'produtos vendidos por peso'),
  ];
  const formas = [
    pdvTile('Dinheiro', pdvMoeda(t.dinheiro), pdvPct(t.dinheiro, t.fechamento) + ' do fechamento'),
    pdvTile('Cartão de crédito', pdvMoeda(t.cartao_credito), pdvPct(t.cartao_credito, t.fechamento) + ' do fechamento'),
    pdvTile('Cartão de débito', pdvMoeda(t.cartao_debito), pdvPct(t.cartao_debito, t.fechamento) + ' do fechamento'),
    pdvTile('PIX', pdvMoeda(t.pix), pdvPct(t.pix, t.fechamento) + ' do fechamento'),
  ];
  if(t.outros) formas.push(pdvTile('Outras formas', pdvMoeda(t.outros), pdvPct(t.outros, t.fechamento) + ' do fechamento'));

  const linhas = r.por_dia.map(d => {
    const f = d.fechamento;
    const diff = (f && d.vendas !== null) ? d.vendas - f.total : null;
    // Fechamento gravado no meio do dia (foto parcial): vendas por itens acima do fechamento + descontos.
    const incompleto = f && d.vendas !== null && (d.vendas - (f.total + (f.descontos || 0))) > Math.max(1, d.vendas * 0.002);
    return `<tr class="pdv-dia" data-dia="${d.data}" style="cursor:pointer;" title="Ver os cupons deste dia">
      <td>${pdvDataBR(d.data)}</td><td>${PDV_DIAS_CURTO[pdvData(d.data).getDay()]}</td>
      <td style="text-align:right; font-weight:600; color:var(--ink); white-space:nowrap;">${f ? pdvMoeda(f.total) + (incompleto ? ' <span class="tag-status tag-atraso" title="O fechamento foi gravado antes do fim do dia: está menor que as vendas. Este dia não é lançado no financeiro até o fechamento ser atualizado.">incompleto</span>' : '') : '<span style="color:var(--ink-faint);">sem fechamento</span>'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.dinheiro) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.cartao_credito) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.cartao_debito) : '—'}</td>
      <td style="text-align:right;">${f ? pdvMoeda(f.pix) : '—'}</td>
      <td style="text-align:right;">${d.vendas !== null ? pdvMoeda(d.vendas) : '—'}</td>
      <td style="text-align:right; ${diff !== null && Math.abs(diff) >= 1 ? 'color:var(--red);' : ''}">${diff !== null ? pdvMoeda(diff) : '—'}</td>
      <td style="text-align:right;">${pdvNum(d.cupons)}</td>
      <td style="text-align:right;">${d.cupons ? pdvMoeda(d.vendas / d.cupons) : '—'}</td>
    </tr>`;
  }).join('');

  openOverlay(`
    ${pdvCabecalho('Vendas do PDV', 'Fechamento do caixa por forma de pagamento e vendas por itens, recebidos automaticamente do AutoPlus. Somente leitura: não gera lançamento financeiro.')}
    ${pdvFiltroHtml()}
    <p style="font-size:11.5px; color:var(--ink-faint); margin:-6px 0 16px;">
      Último fechamento recebido: <strong>${c.ultimo_fechamento ? pdvDataBR(c.ultimo_fechamento) : '—'}</strong> ·
      Última venda recebida: <strong>${c.ultima_venda ? pdvDataBR(c.ultima_venda) : '—'}</strong> ·
      Último envio da loja: <strong>${pdvDataHoraBR(c.ultimo_envio)}</strong>
    </p>
    ${semDados ? '<p style="font-size:13px; color:var(--ink-soft);">Nenhuma venda ou fechamento recebido neste período.</p>' : `
      ${pdvGrade(tiles)}
      ${pdvGrade(formas)}
      <div style="height:240px; margin-bottom:8px;"><canvas id="pdvChartDias"></canvas></div>
      <p style="font-size:11.5px; color:var(--ink-faint); margin:0 0 18px;">
        "Fechamento" é o total fechado no caixa, por forma de pagamento. "Vendas por itens" é a soma dos cupons.
        Diferença = itens − fechamento; diferenças de R$ 1,00 ou mais aparecem em vermelho para conferência.
        Dia marcado como "incompleto" teve o fechamento gravado antes do fim do expediente e não é lançado no financeiro enquanto não for atualizado.
        ${dif !== null ? 'No período, nos dias já fechados: <strong>' + pdvMoeda(dif) + '</strong>.' : ''}
      </p>
      <div style="overflow-x:auto;">
      <table class="report" id="pdvTabelaDias">
        <thead><tr><th>Data</th><th>Dia</th><th style="text-align:right;">Fechamento</th><th style="text-align:right;">Dinheiro</th>
          <th style="text-align:right;">Crédito</th><th style="text-align:right;">Débito</th><th style="text-align:right;">PIX</th>
          <th style="text-align:right;">Vendas por itens</th><th style="text-align:right;">Diferença</th>
          <th style="text-align:right;">Cupons</th><th style="text-align:right;">Ticket</th></tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr style="font-weight:600;"><td colspan="2">Total</td>
          <td style="text-align:right;">${pdvMoeda(t.fechamento)}</td><td style="text-align:right;">${pdvMoeda(t.dinheiro)}</td>
          <td style="text-align:right;">${pdvMoeda(t.cartao_credito)}</td><td style="text-align:right;">${pdvMoeda(t.cartao_debito)}</td>
          <td style="text-align:right;">${pdvMoeda(t.pix)}</td><td style="text-align:right;">${pdvMoeda(t.vendas_itens)}</td>
          <td style="text-align:right;">${dif !== null ? pdvMoeda(dif) : '—'}</td>
          <td style="text-align:right;">${pdvNum(t.cupons)}</td><td style="text-align:right;">${pdvMoeda(t.ticket_medio)}</td></tr></tfoot>
      </table></div>
      <p style="font-size:11.5px; color:var(--ink-faint); margin-top:10px;">Clique em um dia para ver os cupons.</p>`}
    <div class="panel-actions" style="margin-top:20px;">
      ${semDados ? '' : '<button type="button" class="btn ghost" id="pdvExcelDias">Exportar para Excel</button>'}
      <button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button>
    </div>
  `);

  pdvLigarFiltro(openVendasPdvPanel);
  if(semDados) return;
  document.querySelectorAll('.pdv-dia').forEach(tr => tr.addEventListener('click', () => openCuponsDoDia(tr.dataset.dia)));
  document.getElementById('pdvExcelDias').addEventListener('click', exportarVendasPdvExcel);
  const curto = r.por_dia.length > 45;
  pdvBarras('pdvChartDias',
    r.por_dia.map(d => curto ? d.data.slice(8,10) + '/' + d.data.slice(5,7) : d.data.slice(8,10) + '/' + d.data.slice(5,7) + ' ' + PDV_DIAS_CURTO[pdvData(d.data).getDay()]),
    [ { rotulo: 'Fechamento', valores: r.por_dia.map(d => d.fechamento ? d.fechamento.total : null), cor: pdvCor() },
      { rotulo: 'Vendas por itens', valores: r.por_dia.map(d => d.vendas), cor: pdvCorClara() } ],
    v => pdvMoeda(v));
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

// Abre um cartão interno de Vendas do PDV: ao fechar, volta para a lista de dias (precisa do index.html v3.4;
// sem ele, cai no comportamento antigo).
function pdvOverlayFilho(html){ if(typeof openOverlayFilho === 'function') openOverlayFilho(renderVendasPdv, html); else openOverlay(html); }

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
    document.getElementById('pdvVoltarDias').addEventListener('click', renderVendasPdv);
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

/* ==========================================================================================
   (2) ANÁLISE DE VENDAS DO PDV
   ========================================================================================== */
async function openAnalisesPdvPanel(aba){
  if(aba) pdvAbaAnalise = aba;
  if(!pdvPeriodo.inicio) pdvAplicarPreset('mes');
  pdvLimparGraficos();
  openOverlay(pdvCabecalho('Análise de vendas (PDV)', 'Carregando…'));
  try{
    pdvAnalises = await apiFetch('/api/pdv-relatorios/analises?' + pdvQS());
    renderAnalisesPdv();
  }catch(err){ pdvErro('Análise de vendas (PDV)', err, () => openAnalisesPdvPanel()); }
}

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

function renderAnalisesPdv(){
  const a = pdvAnalises, g = a.geral;
  pdvLimparGraficos();
  const abas = [['geral', 'Visão geral'], ['produtos', 'Cortes e produtos'], ['grupos', 'Grupos'], ['horas', 'Horários'], ['semana', 'Dias da semana']];
  const tabs = abas.map(x => `<button type="button" class="btn ${pdvAbaAnalise===x[0]?'gold':'ghost'} pdv-tab" data-aba="${x[0]}" style="margin-right:8px; margin-bottom:8px;">${x[1]}</button>`).join('');
  const vazio = !g.cupons;

  openOverlay(`
    ${pdvCabecalho('Análise de vendas (PDV)', 'Leituras gerenciais sobre as mercadorias vendidas no balcão. Base: itens dos cupons, sem a taxa de entrega e sem duplicar o que já foi importado pela retaguarda.')}
    ${pdvFiltroHtml()}
    <div style="margin-bottom:12px;">${tabs}</div>
    <div id="pdvAbaConteudo">${vazio ? '<p style="font-size:13px; color:var(--ink-soft);">Nenhuma venda recebida neste período.</p>' : ''}</div>
    <div class="panel-actions" style="margin-top:20px;">
      ${!vazio && pdvAbaAnalise === 'produtos' ? '<button type="button" class="btn ghost" id="pdvExcelProdutos">Exportar para Excel</button>' : ''}
      <button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button>
    </div>
  `);

  pdvLigarFiltro(() => openAnalisesPdvPanel());
  document.querySelectorAll('.pdv-tab').forEach(b => b.addEventListener('click', () => { pdvAbaAnalise = b.dataset.aba; renderAnalisesPdv(); }));
  if(vazio) return;
  const alvo = document.getElementById('pdvAbaConteudo');
  if(pdvAbaAnalise === 'geral') renderAbaPdvGeral(alvo);
  else if(pdvAbaAnalise === 'produtos') renderAbaPdvProdutos(alvo);
  else if(pdvAbaAnalise === 'grupos') renderAbaPdvGrupos(alvo);
  else if(pdvAbaAnalise === 'horas') renderAbaPdvHoras(alvo);
  else renderAbaPdvSemana(alvo);
}

function renderAbaPdvGeral(alvo){
  const a = pdvAnalises, g = a.geral;
  const abc = pdvCurvaABC(a.produtos, g.vendas);
  const nA = abc.filter(p => p.classe === 'A').length;
  const melhorDia = a.por_dia_semana.slice().sort((x, y) => (y.vendas / y.dias) - (x.vendas / x.dias))[0];
  const melhorHora = a.por_hora.slice().sort((x, y) => y.vendas - x.vendas)[0];
  const totalCupons = a.faixas_cupom.reduce((s, f) => s + f.cupons, 0);
  alvo.innerHTML = `
    ${pdvGrade([
      pdvTile('Vendas no período', pdvMoeda(g.vendas), pdvNum(g.dias) + ' dia(s) com venda'),
      pdvTile('Venda média por dia', pdvMoeda(g.venda_media_dia), 'dias com venda'),
      pdvTile('Cupons', pdvNum(g.cupons), pdvNum(g.itens_por_cupom, 1) + ' itens por cupom'),
      pdvTile('Ticket médio', pdvMoeda(g.ticket_medio), 'vendas ÷ cupons'),
      pdvTile('Quilos vendidos', pdvNum(g.kg, 1) + ' kg', pdvPct(g.vendas_kg, g.vendas) + ' das vendas é por peso'),
      pdvTile('Preço médio por kg', pdvMoeda(g.preco_medio_kg), 'todos os produtos por peso'),
    ])}
    ${pdvGrade([
      pdvTile('Produtos que fazem 80% da venda', pdvNum(nA), 'de ' + pdvNum(abc.length) + ' vendidos (classe A)'),
      pdvTile('Dia mais forte', melhorDia ? PDV_DIAS[melhorDia.dia_semana] : '—', melhorDia ? pdvMoeda(melhorDia.vendas / melhorDia.dias) + ' em média' : ''),
      pdvTile('Hora mais forte', melhorHora ? String(melhorHora.hora).padStart(2,'0') + 'h' : '—', melhorHora ? pdvPct(melhorHora.vendas, g.vendas) + ' das vendas' : ''),
    ])}
    ${(function(){
      const e = a.entregas || {taxas:0, valor:0, por_valor:[]};
      if(!e.taxas) return '';
      return `<div class="section-title" style="margin-top:6px;">Entregas</div>
        ${pdvGrade([
          pdvTile('Taxas de entrega cobradas', pdvNum(e.taxas), pdvNum(e.dias) + ' dia(s) com entrega'),
          pdvTile('Valor cobrado de taxa', pdvMoeda(e.valor), 'média de ' + pdvMoeda(e.valor / e.taxas) + ' por entrega'),
          pdvTile('Entregas por dia', pdvNum(g.dias ? e.taxas / g.dias : 0, 1), 'sobre os dias com venda'),
        ])}
        <p style="font-size:11.5px; color:var(--ink-faint); margin:-8px 0 16px;">
          Por valor de taxa: ${e.por_valor.map(x => pdvNum(x.taxas) + ' × ' + pdvMoeda(x.valor_taxa)).join(' · ')}.
          A taxa de entrega é cobrada no cupom, mas não é mercadoria: fica fora das vendas, do ticket, dos produtos e dos grupos desta análise.
        </p>`;
    })()}
    ${g.vendas_generico ? `<p style="font-size:12px; color:var(--ink-soft); margin:0 0 16px; padding:10px 12px; border:1px dashed var(--border); border-radius:10px;">
      <strong>${pdvMoeda(g.vendas_generico)}</strong> (${pdvPct(g.vendas_generico, g.vendas)} das vendas, ${pdvNum(g.itens_generico)} itens) foram registrados no caixa como item genérico, com o valor digitado e sem dizer qual é o produto. Esse valor entra no faturamento, mas não pode ser atribuído a nenhum corte.</p>` : ''}
    <div class="section-title" style="margin-top:6px;">Cupons por faixa de valor</div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Faixa</th><th style="text-align:right;">Cupons</th><th style="text-align:right;">% dos cupons</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th></tr></thead>
      <tbody>${a.faixas_cupom.map(f => `<tr><td style="color:var(--ink);">${PDV_FAIXAS[f.faixa]}</td>
        <td style="text-align:right;">${pdvNum(f.cupons)}</td><td style="text-align:right;">${pdvPct(f.cupons, totalCupons)}</td>
        <td style="text-align:right;">${pdvMoeda(f.vendas)}</td><td style="text-align:right;">${pdvPct(f.vendas, g.vendas)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p style="font-size:11.5px; color:var(--ink-faint); margin-top:12px;">
      Margem e rendimento de carcaça ainda não aparecem aqui: o custo e o estoque cadastrados no AutoPlus não são confiáveis
      (há custo zerado e estoque negativo). Essas leituras dependem do custo das compras lançadas no portal.
    </p>`;
}

function renderAbaPdvProdutos(alvo){
  const a = pdvAnalises, g = a.geral;
  const abc = pdvCurvaABC(a.produtos, g.vendas);
  const filtro = pdvFiltroProduto.trim().toLowerCase();
  const lista = filtro ? abc.filter(p => (p.descricao + ' ' + (p.grupo || '') + ' ' + (p.subgrupo || '') + ' ' + p.codigo_barras).toLowerCase().includes(filtro)) : abc;
  const corClasse = { A: 'tag-pago', B: 'tag-aberto', C: 'tag-atraso' };
  alvo.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px;">
      <input type="search" id="pdvBuscaProduto" placeholder="Buscar corte, produto, grupo ou código" value="${pdvEsc(pdvFiltroProduto)}"
        style="flex:1; min-width:220px; max-width:380px; padding:9px 12px; border-radius:8px; border:1px solid var(--border); background:var(--paper-2); font-family:inherit; font-size:12.5px; color:var(--ink);">
      <span style="font-size:11.5px; color:var(--ink-faint);">${pdvNum(lista.length)} de ${pdvNum(abc.length)} produto(s) · curva ABC por faturamento (A até 80%, B até 95%, C o restante)</span>
    </div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>#</th><th>Produto</th><th>Grupo</th><th style="text-align:right;">Quantidade</th><th style="text-align:right;">Preço médio</th>
        <th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th><th style="text-align:right;">% acumulado</th>
        <th style="text-align:right;">Cupons</th><th>ABC</th></tr></thead>
      <tbody>${lista.slice(0, 400).map(p => `<tr>
        <td>${p.posicao}</td><td style="color:var(--ink);">${pdvEsc(p.descricao)}</td>
        <td>${pdvEsc([p.grupo, p.subgrupo].filter(Boolean).join(' · ') || '—')}</td>
        <td style="text-align:right; white-space:nowrap;">${pdvNum(p.quantidade, p.unidade === 'KG' ? 1 : 0)} ${p.unidade === 'KG' ? 'kg' : 'un'}</td>
        <td style="text-align:right; white-space:nowrap;">${p.quantidade ? pdvMoeda(p.vendas / p.quantidade) + (p.unidade === 'KG' ? '/kg' : '') : '—'}</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(p.vendas)}</td>
        <td style="text-align:right;">${pdvNum(p.pct, 1)}%</td><td style="text-align:right;">${pdvNum(p.pct_acum, 1)}%</td>
        <td style="text-align:right;">${pdvNum(p.cupons)}</td>
        <td><span class="tag-status ${corClasse[p.classe]}">${p.classe}</span></td></tr>`).join('') || '<tr><td colspan="10">Nenhum produto encontrado.</td></tr>'}</tbody>
    </table></div>
    ${lista.length > 400 ? '<p style="font-size:11.5px; color:var(--ink-faint); margin-top:10px;">Mostrando os 400 primeiros. Use a busca ou exporte para Excel para ver todos.</p>' : ''}`;
  const busca = document.getElementById('pdvBuscaProduto');
  busca.addEventListener('input', () => {
    pdvFiltroProduto = busca.value; const pos = busca.selectionStart;
    renderAbaPdvProdutos(alvo);
    const n = document.getElementById('pdvBuscaProduto'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){}
  });
  const ex = document.getElementById('pdvExcelProdutos');
  if(ex && !ex.dataset.ligado){ ex.dataset.ligado = '1'; ex.addEventListener('click', () => {
    if(typeof XLSX === 'undefined') return;
    const linhas = pdvCurvaABC(pdvAnalises.produtos, pdvAnalises.geral.vendas).map(p => ({
      'Posição': p.posicao, 'Código': p.codigo_barras, 'Produto': p.descricao, 'Grupo': p.grupo || '', 'Subgrupo': p.subgrupo || '',
      'Unidade': p.unidade || '', 'Quantidade': p.quantidade, 'Preço médio': p.quantidade ? p.vendas / p.quantidade : null,
      'Vendas': p.vendas, '% das vendas': p.pct, '% acumulado': p.pct_acum, 'Cupons': p.cupons, 'Classe ABC': p.classe,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Produtos PDV');
    XLSX.writeFile(wb, `Produtos PDV ${pdvPeriodo.inicio} a ${pdvPeriodo.fim}.xlsx`);
  }); }
}

function renderAbaPdvGrupos(alvo){
  const a = pdvAnalises, g = a.geral;
  alvo.innerHTML = `
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Grupo</th><th>Subgrupo</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th>
        <th style="text-align:right;">Quilos</th><th style="text-align:right;">Preço médio/kg</th><th style="text-align:right;">Itens</th><th style="text-align:right;">Cupons</th></tr></thead>
      <tbody>${a.grupos.map(x => `<tr><td style="color:var(--ink);">${pdvEsc(x.grupo)}</td><td>${pdvEsc(x.subgrupo || '—')}</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(x.vendas)}</td><td style="text-align:right;">${pdvPct(x.vendas, g.vendas)}</td>
        <td style="text-align:right;">${x.kg ? pdvNum(x.kg, 1) + ' kg' : '—'}</td>
        <td style="text-align:right;">${x.kg ? '≈ ' + pdvMoeda(x.vendas / x.kg) : '—'}</td>
        <td style="text-align:right;">${pdvNum(x.itens)}</td><td style="text-align:right;">${pdvNum(x.cupons)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p style="font-size:11.5px; color:var(--ink-faint); margin-top:10px;">
      Grupo e subgrupo vêm do cadastro de produtos do AutoPlus. "(sem cadastro)" reúne itens sem código ou com código que não está mais no cadastro.
      O preço médio por kg é aproximado quando o grupo mistura produtos por peso e por unidade.
    </p>`;
}

function renderAbaPdvHoras(alvo){
  const a = pdvAnalises, g = a.geral;
  alvo.innerHTML = `
    <div style="height:240px; margin-bottom:14px;"><canvas id="pdvChartHoras"></canvas></div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Hora</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th><th style="text-align:right;">Cupons</th>
        <th style="text-align:right;">Ticket médio</th><th style="text-align:right;">Média por dia</th></tr></thead>
      <tbody>${a.por_hora.map(h => `<tr><td style="color:var(--ink);">${String(h.hora).padStart(2,'0')}h às ${String(h.hora).padStart(2,'0')}h59</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(h.vendas)}</td><td style="text-align:right;">${pdvPct(h.vendas, g.vendas)}</td>
        <td style="text-align:right;">${pdvNum(h.cupons)}</td><td style="text-align:right;">${pdvMoeda(h.cupons ? h.vendas / h.cupons : null)}</td>
        <td style="text-align:right;">${pdvMoeda(g.dias ? h.vendas / g.dias : null)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p style="font-size:11.5px; color:var(--ink-faint); margin-top:10px;">
      Hora do fechamento do cupom. Nos cupons já importados pela retaguarda do AutoPlus a hora vem arredondada, por isso a leitura é por hora cheia.
      "Média por dia" divide pelas datas com venda no período.
    </p>`;
  pdvBarras('pdvChartHoras', a.por_hora.map(h => String(h.hora).padStart(2,'0') + 'h'),
    [{ rotulo: 'Média de vendas por dia', valores: a.por_hora.map(h => g.dias ? h.vendas / g.dias : 0), cor: pdvCor() }], v => pdvMoeda(v));
}

function renderAbaPdvSemana(alvo){
  const a = pdvAnalises, g = a.geral;
  const ordem = [1, 2, 3, 4, 5, 6, 0].map(d => a.por_dia_semana.find(x => x.dia_semana === d)).filter(Boolean);
  alvo.innerHTML = `
    <div style="height:240px; margin-bottom:14px;"><canvas id="pdvChartSemana"></canvas></div>
    <div style="overflow-x:auto;"><table class="report">
      <thead><tr><th>Dia da semana</th><th style="text-align:right;">Dias no período</th><th style="text-align:right;">Vendas</th><th style="text-align:right;">% das vendas</th>
        <th style="text-align:right;">Média por dia</th><th style="text-align:right;">Cupons por dia</th><th style="text-align:right;">Ticket médio</th></tr></thead>
      <tbody>${ordem.map(d => `<tr><td style="color:var(--ink);">${PDV_DIAS[d.dia_semana]}</td><td style="text-align:right;">${pdvNum(d.dias)}</td>
        <td style="text-align:right;">${pdvMoeda(d.vendas)}</td><td style="text-align:right;">${pdvPct(d.vendas, g.vendas)}</td>
        <td style="text-align:right; font-weight:600; color:var(--ink);">${pdvMoeda(d.vendas / d.dias)}</td>
        <td style="text-align:right;">${pdvNum(d.cupons / d.dias, 0)}</td><td style="text-align:right;">${pdvMoeda(d.cupons ? d.vendas / d.cupons : null)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  pdvBarras('pdvChartSemana', ordem.map(d => PDV_DIAS[d.dia_semana]),
    [{ rotulo: 'Média de vendas por dia', valores: ordem.map(d => d.vendas / d.dias), cor: pdvCor() }], v => pdvMoeda(v));
}
