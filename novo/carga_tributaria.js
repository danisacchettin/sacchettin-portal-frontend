/* ==========================================================================================
     CARGA TRIBUTARIA / DAS MENSAL (pedido da Danielle, 29/09/2026) -- registra, por competencia,
          os dados de apuracao do Simples Nacional extraidos do relatorio mensal da contabilidade
   (Tonolli/Gestta): DAS apurado, aliquota efetiva, composicao por tributo (IRPJ/CSLL/COFINS/
   PIS/CPP/ICMS), receita bruta do mes, entradas fiscais, massa de folha e saldo fiscal do mes.
          Uso gerencial -- acompanhar a evolucao da carga tributaria mes a mes dentro do Portal -- nao
          substitui a apuracao oficial da contabilidade, e so o resumo trazido para ca. Lancar de novo
   uma competencia ja existente atualiza (upsert) os dados daquela competencia. Backend:
   src/routes/cargaTributaria.js.
          ========================================================================================== */
let cargaTributariaHistorico = [];

async function openCargaTributariaPanel(){
    openOverlay(`<div class="panel-head"><div><h2>Carga Tributaria / DAS Mensal</h2><p>Carregando...</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
  try{
    await carregarCargaTributaria();
    renderCargaTributariaPanel();
  }catch(err){
    openOverlay(`<div class="panel-head"><div><h2>Carga Tributaria / DAS Mensal</h2><p style="color:var(--red);">Erro ao carregar: ${err.message}</p></div><button class="close-x" onclick="closeOverlay()">X</button></div>`);
                                                                                                                                    }
  }

async function carregarCargaTributaria(){
  cargaTributariaHistorico = await apiFetch('/api/carga-tributaria') || [];
}

function fmtCompetencia(iso){
    if(!iso) return '-';
  const partes = String(iso).substring(0,7).split('-');
  const ano = partes[0], mes = partes[1];
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[Number(mes)-1]}/${ano}`;
}

function renderCargaTributariaPanel(){
  const linhasOrdenadas = [...cargaTributariaHistorico].sort((a,b)=> String(b.competencia).localeCompare(String(a.competencia)));
  const linhas = linhasOrdenadas.map(r => `
    <tr data-id="${r.id}">
      <td>${fmtCompetencia(r.competencia)}</td>
      <td style="text-align:right;">${r.receita_bruta_mes!=null?fmtBRL(r.receita_bruta_mes):'-'}</td>
      <td style="text-align:right;">${fmtBRL(r.das_apurado)}</td>
      <td style="text-align:right;">${r.das_percentual_efetivo!=null?Number(r.das_percentual_efetivo).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})+'%':'-'}</td>
      <td style="text-align:right;">${r.saldo_fiscal_mes!=null?fmtBRL(r.saldo_fiscal_mes):'-'}</td>
      <td>${escapeHtml(r.fonte||'-')}</td>
      <td><button type="button" class="btn-mini ct-excluir" data-id="${r.id}" title="Excluir">X</button></td>
    </tr>`).join('');

  openOverlay(`
    <div class="panel-head">
      <div><h2>Carga Tributaria / DAS Mensal</h2><p>Registro mensal da apuracao do Simples Nacional, extraido do relatorio da contabilidade (Tonolli/Gestta) -- acompanhamento gerencial, nao substitui a apuracao oficial.</p></div>
      <button class="close-x" onclick="closeOverlay()">X</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="report">
        <thead><tr><th>Competencia</th><th>Receita bruta</th><th>DAS apurado</th><th>% efetivo</th><th>Saldo fiscal do mes</th><th>Fonte</th><th></th></tr></thead>
        <tbody id="ctHistBody">${linhas || '<tr><td colspan="7">Nenhuma competencia registrada ainda.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="section-title">Lancar / atualizar competencia</div>
    <p style="font-size:12px; color:var(--ink-soft); margin-top:-6px;">Lancar novamente uma competencia ja existente substitui os dados daquela competencia.</p>
    <div class="form-grid">
      <div class="field"><label>Competencia *</label><input type="month" id="ctCompetencia"></div>
      <div class="field"><label>Receita bruta do mes (R$)</label><input type="number" step="0.01" min="0" id="ctReceitaBruta"></div>
      <div class="field"><label>DAS apurado (R$) *</label><input type="number" step="0.01" min="0" id="ctDasApurado"></div>
      <div class="field"><label>% efetivo (aliquota)</label><input type="number" step="0.0001" min="0" id="ctPercentualEfetivo" placeholder="ex: 6.5"></div>
      <div class="field"><label>IRPJ (R$)</label><input type="number" step="0.01" min="0" id="ctIrpj"></div>
      <div class="field"><label>CSLL (R$)</label><input type="number" step="0.01" min="0" id="ctCsll"></div>
      <div class="field"><label>COFINS (R$)</label><input type="number" step="0.01" min="0" id="ctCofins"></div>
      <div class="field"><label>PIS (R$)</label><input type="number" step="0.01" min="0" id="ctPis"></div>
      <div class="field"><label>CPP (R$)</label><input type="number" step="0.01" min="0" id="ctCpp"></div>
      <div class="field"><label>ICMS (R$)</label><input type="number" step="0.01" min="0" id="ctIcms"></div>
      <div class="field"><label>Entradas fiscais do mes (R$)</label><input type="number" step="0.01" min="0" id="ctEntradasFiscais"></div>
      <div class="field"><label>Massa de folha do mes (R$)</label><input type="number" step="0.01" min="0" id="ctMassaFolha"></div>
      <div class="field"><label>Saldo fiscal do mes (R$)</label><input type="number" step="0.01" id="ctSaldoFiscal"></div>
      <div class="field"><label>Fonte</label><input type="text" id="ctFonte" value="Relatorio contabilidade"></div>
      <div class="field full"><label>Observacoes</label><input type="text" id="ctObservacoes" placeholder="opcional"></div>
    </div>
    <div id="ctMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
    <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="ctSalvar">Salvar competencia</button></div>
  `);

  document.querySelectorAll('.ct-excluir').forEach(btn=>{
    btn.addEventListener('click', ()=>excluirCargaTributaria(btn.dataset.id));
});
  document.getElementById('ctSalvar').addEventListener('click', salvarCargaTributaria);
}

async function salvarCargaTributaria(){
  const msg = document.getElementById('ctMsg');
  msg.style.display = 'none';
  const btn = document.getElementById('ctSalvar');
  btn.disabled = true;
  try{
    const competenciaMes = document.getElementById('ctCompetencia').value;
    if(!competenciaMes) throw new Error('Informe a competencia.');
    const competencia = competenciaMes + '-01';
    const dasApurado = parseFloat(document.getElementById('ctDasApurado').value);
    if(!(dasApurado>0)) throw new Error('Informe o DAS apurado.');

    const num = id => { const v = document.getElementById(id).value; return v===''?undefined:parseFloat(v); };
    await apiFetch('/api/carga-tributaria', {method:'POST', body: JSON.stringify({
      competencia,
      das_apurado: dasApurado,
      receita_bruta_mes: num('ctReceitaBruta'),
      das_percentual_efetivo: num('ctPercentualEfetivo'),
      irpj: num('ctIrpj'), csll: num('ctCsll'), cofins: num('ctCofins'), pis: num('ctPis'),
      cpp: num('ctCpp'), icms: num('ctIcms'),
      entradas_fiscais_mes: num('ctEntradasFiscais'),
      massa_folha_mes: num('ctMassaFolha'),
      saldo_fiscal_mes: num('ctSaldoFiscal'),
      fonte: document.getElementById('ctFonte').value.trim() || undefined,
      observacoes: document.getElementById('ctObservacoes').value.trim() || undefined,
})});

    await carregarCargaTributaria();
    msg.textContent = 'Competencia salva com sucesso'; msg.style.color='var(--olive)'; msg.style.display='block';
    renderCargaTributariaPanel();
}catch(err){
    msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
    btn.disabled = false;
}
}

async function excluirCargaTributaria(id){
  if(!confirm('Excluir este registro de competencia?')) return;
  try{
    await apiFetch(`/api/carga-tributaria/${id}`, {method:'DELETE'});
    await carregarCargaTributaria();
    renderCargaTributariaPanel();
}catch(err){
    alert('Erro ao excluir: ' + err.message);
}
}
