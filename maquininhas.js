/* ==========================================================================================
   TAXAS DE MAQUININHA E RECEBIMENTOS DO PDV (pedido da Danielle, 29/09/2026) -- duas partes:
   (1) cadastro de vigencias de taxa por operadora/forma de pagamento (ex.: Mercado Pago, link
   de pagamento = vendas de balcao, 4,77%; Getnet, credito D2), cada taxa nova cadastrada para a
   mesma operadora+forma+modalidade encerra automaticamente a vigencia aberta anterior; (2)
   lancamento diario dos recebimentos do PDV -- ao informar o valor bruto do dia, o sistema busca
   a taxa vigente na data e calcula taxa/valor liquido; se uma conta bancaria for indicada, gera
   automaticamente a despesa financeira correspondente (categoria "TAXAS DE MAQUININHA") ja paga,
   vinculada em Caixa e Bancos -- mesmo padrao de "vinculo automatico" ja usado em Contas a Pagar
   para juros/encargos. A base de venda do site da contabilidade e so o que foi emitido de NF
   (uso contabil) -- nao serve para conferencia gerencial aqui; por isso os valores de recebimento
   do PDV sao lancados manualmente/por relatorio da operadora (ex.: Getnet por dia), nao puxados
   do site da contabilidade. Backend: src/routes/maquininhas.js (GET/POST /api/maquininhas/taxas
   e /api/maquininhas/recebimentos).
   ========================================================================================== */
let maquininhasAba = 'taxas';
let maquininhasTaxas = [];
let maquininhasRecebimentos = [];
let maquininhasFiltroInicio = '';
let maquininhasFiltroFim = '';

function maquininhasTabsHtml(){
  const abas = [
    {key:'taxas', label:'Taxas Cadastradas'},
    {key:'recebimentos', label:'Recebimentos do PDV'},
  ];
  return abas.map(a => `<button type="button" class="btn ${maquininhasAba===a.key?'gold':'ghost'} mq-tab" data-aba="${a.key}" style="margin-right:8px; margin-bottom:8px;">${a.label}</button>`).join('');
}

async function openMaquininhasPanel(aba){
  maquininhasAba = aba || 'taxas';
  openOverlay(`<div class="panel-head"><div><h2>Taxas de Maquininha e Recebimentos PDV</h2><p>Carregando...</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
  try{
    await carregarCadastros();
    const hoje = new Date();
    maquininhasFiltroInicio = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
    maquininhasFiltroFim = todayISO();
    await Promise.all([carregarMaquininhasTaxas(), carregarMaquininhasRecebimentos()]);
    renderMaquininhasPanel();
  }catch(err){
    openOverlay(`<div class="panel-head"><div><h2>Taxas de Maquininha e Recebimentos PDV</h2><p style="color:var(--red);">Erro ao carregar: ${err.message}</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
  }
}

async function carregarMaquininhasTaxas(){
  maquininhasTaxas = await apiFetch('/api/maquininhas/taxas') || [];
}

async function carregarMaquininhasRecebimentos(){
  const qs = new URLSearchParams();
  if(maquininhasFiltroInicio) qs.set('inicio', maquininhasFiltroInicio);
  if(maquininhasFiltroFim) qs.set('fim', maquininhasFiltroFim);
  maquininhasRecebimentos = await apiFetch(`/api/maquininhas/recebimentos?${qs.toString()}`) || [];
}

function renderMaquininhasPanel(){
  openOverlay(`
    <div class="panel-head">
      <div><h2>Taxas de Maquininha e Recebimentos PDV</h2><p>Taxa por operadora/forma de pagamento e lancamento diario dos recebimentos do PDV, com calculo automatico de taxa e valor liquido.</p></div>
      <button class="close-x" onclick="closeOverlay()">X</button>
    </div>
    <div style="margin-bottom:10px;">${maquininhasTabsHtml()}</div>
    <div id="mqAbaContent"></div>
    <div class="panel-actions" style="margin-top:20px;"><button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button></div>
  `);
  document.querySelectorAll('.mq-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{ maquininhasAba = btn.dataset.aba; renderMaquininhasPanel(); });
  });
  if(maquininhasAba==='taxas') renderAbaMaquininhasTaxas();
  else renderAbaMaquininhasRecebimentos();
}

/* ---------- Aba: Taxas Cadastradas ---------- */

function operadoraSelectHtml(id, selected){
  const opcoes = ['Mercado Pago','Getnet','Stone','Cielo','Rede'];
  const optsHtml = opcoes.map(o=>`<option value="${o}" ${selected===o?'selected':''}>${o}</option>`).join('');
  return `<select id="${id}">${optsHtml}<option value="__outra__" ${selected==='__outra__'?'selected':''}>+ Outra operadora</option></select>`;
}

function formaPagamentoSelectHtml(id, selected){
  const opcoes = ['Debito','Credito a vista','Credito parcelado','Link de pagamento','Vale Alimentacao/Refeicao','Pix'];
  const optsHtml = opcoes.map(o=>`<option value="${o}" ${selected===o?'selected':''}>${o}</option>`).join('');
  return `<select id="${id}">${optsHtml}<option value="__outra__" ${selected==='__outra__'?'selected':''}>+ Outra forma</option></select>`;
}

function renderAbaMaquininhasTaxas(){
  const linhasOrdenadas = [...maquininhasTaxas].sort((a,b)=>{
    if(a.operadora!==b.operadora) return a.operadora.localeCompare(b.operadora);
    if(a.forma_pagamento!==b.forma_pagamento) return a.forma_pagamento.localeCompare(b.forma_pagamento);
    return String(b.vigencia_inicio).localeCompare(String(a.vigencia_inicio));
  });
  const linhas = linhasOrdenadas.map(t => `
    <tr>
      <td>${escapeHtml(t.operadora)}</td>
      <td>${escapeHtml(t.forma_pagamento)}</td>
      <td>${escapeHtml(t.modalidade||'-')}</td>
      <td style="text-align:right;">${Number(t.percentual_taxa).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})}%</td>
      <td>${fmtDate(t.vigencia_inicio)}</td>
      <td>${t.vigencia_fim?fmtDate(t.vigencia_fim):'<span style="color:var(--olive); font-weight:600;">em vigor</span>'}</td>
      <td>${escapeHtml(t.observacoes||'-')}</td>
    </tr>`).join('');

  document.getElementById('mqAbaContent').innerHTML = `
    <div style="overflow-x:auto;">
      <table class="report">
        <thead><tr><th>Operadora</th><th>Forma</th><th>Modalidade</th><th>% Taxa</th><th>Vigencia inicio</th><th>Vigencia fim</th><th>Observacoes</th></tr></thead>
        <tbody id="mqTaxasBody">${linhas || '<tr><td colspan="7">Nenhuma taxa cadastrada ainda.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="section-title">Cadastrar nova taxa</div>
    <p style="font-size:12px; color:var(--ink-soft); margin-top:-6px;">Cadastrar uma nova taxa para a mesma operadora + forma + modalidade encerra automaticamente a vigencia anterior em aberto, na vespera do novo inicio.</p>
    <div class="form-grid">
      <div class="field">
        <label>Operadora *</label>
        ${operadoraSelectHtml('mqTxOperadora','')}
        <input type="text" id="mqTxOperadoraOutra" placeholder="Nome da operadora" style="display:none; margin-top:4px;">
      </div>
      <div class="field">
        <label>Forma de pagamento *</label>
        ${formaPagamentoSelectHtml('mqTxForma','')}
        <input type="text" id="mqTxFormaOutra" placeholder="Nome da forma de pagamento" style="display:none; margin-top:4px;">
      </div>
      <div class="field"><label>Modalidade (opcional)</label><input type="text" id="mqTxModalidade" placeholder="ex: D1, D2, D30"></div>
      <div class="field"><label>% de taxa *</label><input type="number" step="0.0001" min="0" id="mqTxPercentual" placeholder="ex: 4.77"></div>
      <div class="field"><label>Vigencia inicio *</label><input type="date" id="mqTxVigenciaInicio" value="${todayISO()}"></div>
      <div class="field"><label>Vigencia fim (opcional)</label><input type="date" id="mqTxVigenciaFim"></div>
      <div class="field full"><label>Observacoes</label><input type="text" id="mqTxObservacoes" placeholder="opcional"></div>
    </div>
    <div id="mqTxMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
    <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="mqTxSalvar">Cadastrar taxa</button></div>
  `;

  document.getElementById('mqTxOperadora').addEventListener('change', e=>{
    document.getElementById('mqTxOperadoraOutra').style.display = e.target.value==='__outra__' ? 'block' : 'none';
  });
  document.getElementById('mqTxForma').addEventListener('change', e=>{
    document.getElementById('mqTxFormaOutra').style.display = e.target.value==='__outra__' ? 'block' : 'none';
  });
  document.getElementById('mqTxSalvar').addEventListener('click', salvarMaquininhaTaxa);
}

async function salvarMaquininhaTaxa(){
  const msg = document.getElementById('mqTxMsg');
  msg.style.display = 'none';
  const btn = document.getElementById('mqTxSalvar');
  btn.disabled = true;
  try{
    const operadoraSel = document.getElementById('mqTxOperadora').value;
    const operadora = operadoraSel==='__outra__' ? document.getElementById('mqTxOperadoraOutra').value.trim() : operadoraSel;
    const formaSel = document.getElementById('mqTxForma').value;
    const formaPagamento = formaSel==='__outra__' ? document.getElementById('mqTxFormaOutra').value.trim() : formaSel;
    const percentual = parseFloat(document.getElementById('mqTxPercentual').value);
    const vigenciaInicio = document.getElementById('mqTxVigenciaInicio').value;
    const vigenciaFim = document.getElementById('mqTxVigenciaFim').value;

    if(!operadora) throw new Error('Informe a operadora.');
    if(!formaPagamento) throw new Error('Informe a forma de pagamento.');
    if(!(percentual>=0)) throw new Error('Informe o percentual de taxa.');
    if(!vigenciaInicio) throw new Error('Informe a data de inicio da vigencia.');

    await apiFetch('/api/maquininhas/taxas', {method:'POST', body: JSON.stringify({
      operadora, forma_pagamento: formaPagamento,
      modalidade: document.getElementById('mqTxModalidade').value.trim() || undefined,
      percentual_taxa: percentual,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim || undefined,
      observacoes: document.getElementById('mqTxObservacoes').value.trim() || undefined,
    })});

    await carregarMaquininhasTaxas();
    msg.textContent = 'Taxa cadastrada com sucesso'; msg.style.color='var(--olive)'; msg.style.display='block';
    renderAbaMaquininhasTaxas();
  }catch(err){
    msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
    btn.disabled = false;
  }
}

/* ---------- Aba: Recebimentos do PDV ---------- */

function renderAbaMaquininhasRecebimentos(){
  const linhasOrdenadas = [...maquininhasRecebimentos].sort((a,b)=> String(b.data).localeCompare(String(a.data)));
  const linhas = linhasOrdenadas.map(r => `
    <tr>
      <td>${fmtDate(r.data)}</td>
      <td>${escapeHtml(r.operadora)}</td>
      <td>${escapeHtml(r.forma_pagamento)}</td>
      <td style="text-align:right;">${fmtBRL(r.valor_bruto)}</td>
      <td style="text-align:right;">${r.percentual_taxa_aplicado!=null?Number(r.percentual_taxa_aplicado).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})+'%':'<span style="color:var(--red);">sem taxa</span>'}</td>
      <td style="text-align:right;">${r.valor_taxa!=null?fmtBRL(r.valor_taxa):'-'}</td>
      <td style="text-align:right;">${r.valor_liquido!=null?fmtBRL(r.valor_liquido):'-'}</td>
      <td>${r.caixa_bancos_id?'<span style="color:var(--olive);">lancado</span>':'-'}</td>
    </tr>`).join('');

  document.getElementById('mqAbaContent').innerHTML = `
    <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;">
      <div class="field" style="margin:0;"><label>De</label><input type="date" id="mqRecInicio" value="${maquininhasFiltroInicio}"></div>
      <div class="field" style="margin:0;"><label>Ate</label><input type="date" id="mqRecFim" value="${maquininhasFiltroFim}"></div>
      <button type="button" class="btn ghost" id="mqRecFiltrar">Filtrar</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="report">
        <thead><tr><th>Data</th><th>Operadora</th><th>Forma</th><th>Valor bruto</th><th>% Taxa aplicado</th><th>Valor taxa</th><th>Valor liquido</th><th>Despesa</th></tr></thead>
        <tbody id="mqRecBody">${linhas || '<tr><td colspan="8">Nenhum recebimento no periodo.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="section-title">Lancar recebimento do dia</div>
    <p style="font-size:12px; color:var(--ink-soft); margin-top:-6px;">A base de venda do site da contabilidade e so o que foi emitido de NF (uso contabil) -- lance aqui pelo relatorio da operadora (ex.: Getnet por dia) ou pelo fechamento do PDV. Indicando a conta bancaria, a despesa da taxa (categoria "TAXAS DE MAQUININHA") e lancada automaticamente em Caixa e Bancos.</p>
    <div class="form-grid">
      <div class="field"><label>Data *</label><input type="date" id="mqRecData" value="${todayISO()}"></div>
      <div class="field">
        <label>Operadora *</label>
        ${operadoraSelectHtml('mqRecOperadora','')}
        <input type="text" id="mqRecOperadoraOutra" placeholder="Nome da operadora" style="display:none; margin-top:4px;">
      </div>
      <div class="field">
        <label>Forma de pagamento *</label>
        ${formaPagamentoSelectHtml('mqRecForma','')}
        <input type="text" id="mqRecFormaOutra" placeholder="Nome da forma de pagamento" style="display:none; margin-top:4px;">
      </div>
      <div class="field"><label>Valor bruto (R$) *</label><input type="number" step="0.01" min="0" id="mqRecValorBruto"></div>
      ${renderCadastroField({name:'mq_conta_bancaria', label:'Conta bancaria (opcional -- gera a despesa da taxa automaticamente)', cadastro:'contasBancarias', full:true}, {})}
      <div class="field full"><label>Observacoes</label><input type="text" id="mqRecObservacoes" placeholder="opcional"></div>
    </div>
    <div id="mqRecMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
    <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="mqRecSalvar">Registrar recebimento</button></div>
  `;

  document.getElementById('mqRecOperadora').addEventListener('change', e=>{
    document.getElementById('mqRecOperadoraOutra').style.display = e.target.value==='__outra__' ? 'block' : 'none';
  });
  document.getElementById('mqRecForma').addEventListener('change', e=>{
    document.getElementById('mqRecFormaOutra').style.display = e.target.value==='__outra__' ? 'block' : 'none';
  });
  document.getElementById('mqRecFiltrar').addEventListener('click', async ()=>{
    maquininhasFiltroInicio = document.getElementById('mqRecInicio').value;
    maquininhasFiltroFim = document.getElementById('mqRecFim').value;
    await carregarMaquininhasRecebimentos();
    renderAbaMaquininhasRecebimentos();
  });
  document.getElementById('mqRecSalvar').addEventListener('click', salvarMaquininhaRecebimento);
}

async function salvarMaquininhaRecebimento(){
  const msg = document.getElementById('mqRecMsg');
  msg.style.display = 'none';
  const btn = document.getElementById('mqRecSalvar');
  btn.disabled = true;
  try{
    const data = document.getElementById('mqRecData').value;
    const operadoraSel = document.getElementById('mqRecOperadora').value;
    const operadora = operadoraSel==='__outra__' ? document.getElementById('mqRecOperadoraOutra').value.trim() : operadoraSel;
    const formaSel = document.getElementById('mqRecForma').value;
    const formaPagamento = formaSel==='__outra__' ? document.getElementById('mqRecFormaOutra').value.trim() : formaSel;
    const valorBruto = parseFloat(document.getElementById('mqRecValorBruto').value);

    if(!data) throw new Error('Informe a data.');
    if(!operadora) throw new Error('Informe a operadora.');
    if(!formaPagamento) throw new Error('Informe a forma de pagamento.');
    if(!(valorBruto>0)) throw new Error('Informe o valor bruto.');

    const contaSelect = document.querySelector('select[name="mq_conta_bancaria"]');
    const contaForm = { mq_conta_bancaria: contaSelect ? contaSelect.value : '', novo_mq_conta_bancaria: (document.querySelector('input[name="novo_mq_conta_bancaria"]')||{}).value || '' };
    const contaBancariaId = contaSelect && contaSelect.value ? await resolverCadastro({name:'mq_conta_bancaria', cadastro:'contasBancarias', label:'Conta bancaria'}, contaForm) : undefined;

    const resultado = await apiFetch('/api/maquininhas/recebimentos', {method:'POST', body: JSON.stringify({
      data, operadora, forma_pagamento: formaPagamento, valor_bruto: valorBruto,
      conta_bancaria_id: contaBancariaId || undefined,
      observacoes: document.getElementById('mqRecObservacoes').value.trim() || undefined,
    })});

    await carregarMaquininhasRecebimentos();
    msg.textContent = resultado && resultado.taxa_encontrada
      ? 'Recebimento registrado com sucesso'
      : 'Recebimento registrado -- atencao: nao ha taxa cadastrada para essa operadora/forma nessa data, valor lancado sem calculo de taxa.';
    msg.style.color = resultado && resultado.taxa_encontrada ? 'var(--olive)' : 'var(--gold)';
    msg.style.display='block';
    renderAbaMaquininhasRecebimentos();
  }catch(err){
    msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
    btn.disabled = false;
  }
}
