/* ==========================================================================================
   CUSTO DE PRODUTO / RATEIO DE COMPRA (pedido da Danielle, 29/09/2026) — rateia o valor pago
   numa compra (carcaça, caixa fechada, fardo) entre os produtos/cortes resultantes, por peso
   ou quantidade, calculando custo alocado e margem em tempo real no navegador (só grava no
   servidor ao clicar em "Salvar"). Também cobre o caso mais simples de Lançamento Direto
   (compra = venda na mesma unidade, ex. carvão/bebida), o cadastro central de produtos (com
   preço de venda editável a qualquer momento) e o controle de estoque (saldo calculado
   on-the-fly + baixa manual, preparado para receber baixa automática futura por relatório de
   vendas do PDV/distribuidora em PDF). Backend: src/routes/produtos.js. Este módulo NÃO lança
   nem referencia contas_pagar — é só composição de custo/CMV, decisão explícita da Danielle.
   ========================================================================================== */
let rateioItens = [];
let custoProdutoAba = 'rateio';

function custoProdutoTabsHtml(){
    const abas = [
      {key:'rateio', label:'Rateio de Compra'},
       {key:'multiplo', label:'Vários Produtos (1 nota)'},
      {key:'direto', label:'Lançamento Direto'},
      {key:'produtos', label:'Produtos & Preços'},
      {key:'estoque', label:'Estoque'},
        ];
    return abas.map(a => `<button type="button" class="btn ${custoProdutoAba===a.key?'gold':'ghost'} cp-tab" data-aba="${a.key}" style="margin-right:8px; margin-bottom:8px;">${a.label}</button>`).join('');
}

async function openCustoProdutoPanel(aba){
    custoProdutoAba = aba || 'rateio';
    openOverlay(`<div class="panel-head"><div><h2>Custo de Produto</h2><p>Carregando…</p></div><button class="close-x" onclick="closeOverlay()">✕</button></div>`);
    try{
          await carregarCadastros();
          renderCustoProdutoPanel();
    }catch(err){
          openOverlay(`<div class="panel-head"><div><h2>Custo de Produto</h2><p style="color:var(--red);">Erro ao carregar: ${err.message}</p></div><button class="close-x" onclick="closeOverlay()">✕</button></div>`);
    }
}

function renderCustoProdutoPanel(){
    openOverlay(`
        <div class="panel-head">
              <div><h2>Custo de Produto</h2><p>Rateio de compra (carcaça, caixa fechada), lançamento direto, cadastro de produtos com preço de venda e controle de estoque.</p></div>
                    <button class="close-x" onclick="closeOverlay()">✕</button>
                        </div>
                            <div style="margin-bottom:10px;">${custoProdutoTabsHtml()}</div>
                                <div id="cpAbaContent"></div>
                                    <div class="panel-actions" style="margin-top:20px;"><button type="button" class="btn ghost" onclick="closeOverlay()">Fechar</button></div>
                                      `);
    document.querySelectorAll('.cp-tab').forEach(btn=>{
          btn.addEventListener('click', ()=>{ custoProdutoAba = btn.dataset.aba; renderCustoProdutoPanel(); });
    });
    if(custoProdutoAba==='rateio') renderAbaRateioModo1();
       else if(custoProdutoAba==='multiplo') renderAbaMultiplo();
    else if(custoProdutoAba==='direto') renderAbaRateioModo2();
    else if(custoProdutoAba==='produtos') renderAbaProdutos();
    else if(custoProdutoAba==='estoque') renderAbaEstoque();
}

/* ---------- Modo 1: Rateio por Peso/Quantidade ---------- */

function optsProdutosRateio(selectedId){
    const lista = CADASTROS.produtos || [];
    const opts = [`<option value="" disabled ${!selectedId?'selected':''}>— Selecione —</option>`]
      .concat(lista.map(p=>`<option value="${p.id}" data-preco="${p.preco_venda!=null?p.preco_venda:''}" ${String(selectedId)===String(p.id)?'selected':''}>${escapeHtml(p.nome)}</option>`))
      .concat([`<option value="__novo__" ${selectedId==='__novo__'?'selected':''}>+ Cadastrar novo produto</option>`]);
    return opts.join('');
}

function renderAbaRateioModo1(){
    if(!rateioItens.length){
          rateioItens = [{produto_id:'', produto_nome:'', peso_ou_quantidade:'', preco_venda:'', observacao:''}];
    }
    const linhas = rateioItens.map((it,i)=>`
        <tr class="rateio-row" data-idx="${i}">
              <td style="min-width:180px;">
                      <select class="rateio-produto">${optsProdutosRateio(it.produto_id)}</select>
                              <input type="text" class="rateio-produto-novo" placeholder="Nome do novo produto" style="display:${it.produto_id==='__novo__'?'block':'none'}; margin-top:4px;" value="${escapeHtml(it.produto_nome||'')}">
                                    </td>
                                          <td style="min-width:100px;"><input type="number" step="0.001" min="0" class="rateio-peso" value="${escapeHtml(String(it.peso_ou_quantidade))}"></td>
                                                <td class="rateio-pct" style="text-align:right;">—</td>
                                                      <td class="rateio-custo" style="text-align:right;">—</td>
                                                            <td style="min-width:110px;"><input type="number" step="0.01" min="0" class="rateio-preco" value="${escapeHtml(String(it.preco_venda))}"></td>
                                                                  <td class="rateio-lucro-unit" style="text-align:right;">—</td>
                                                                        <td class="rateio-lucro-total" style="text-align:right;">—</td>
                                                                              <td style="min-width:130px;"><input type="text" class="rateio-obs" placeholder="opcional" style="width:100%; box-sizing:border-box;" value="${escapeHtml(it.observacao||'')}"></td>
                                                                                    <td>${rateioItens.length>1?`<button type="button" class="btn-mini rateio-remover" data-idx="${i}">✕</button>`:''}</td>
                                                                                        </tr>`).join('');

  document.getElementById('cpAbaContent').innerHTML = `
      <div class="form-grid">
            ${renderCadastroField({name:'rateio_fornecedor', label:'Fornecedor', cadastro:'fornecedores', full:false}, {})}
                  <div class="field"><label>Data da compra</label><input type="date" id="rateioData" value="${todayISO()}"></div>
                        <div class="field"><label>Valor total pago (R$)</label><input type="number" step="0.01" min="0" id="rateioValorTotal"></div>
                              <div class="field"><label>Base de rateio</label>
                                      <select id="rateioBase">
                                                <option value="peso">Peso (kg)</option>
                                                          <option value="quantidade">Quantidade (un)</option>
                                                                  </select>
                                                                        </div>
                                                                              <div class="field"><label>Peso/qtd total declarado (conferência, opcional)</label><input type="number" step="0.001" min="0" id="rateioDeclarado"></div>
                                                                                  </div>
                                                                                      <div id="rateioDivergencia" style="display:none; background:var(--gold-wash); color:var(--gold); border-radius:8px; padding:10px 14px; font-size:12.5px; margin:10px 0;"></div>
                                                                                          <div style="overflow-x:auto;">
                                                                                                <table class="report">
                                                                                                        <thead><tr><th>Produto/corte</th><th>Peso/Qtd</th><th>% total</th><th>Custo alocado</th><th>Preço venda</th><th>Lucro/un</th><th>Lucro total</th><th>Obs.</th><th></th></tr></thead>
                                                                                                                <tbody id="rateioBody">${linhas}</tbody>
                                                                                                                        <tfoot><tr style="font-weight:600;"><td>Total</td><td id="rateioTotalPeso">—</td><td></td><td id="rateioTotalCusto">—</td><td></td><td></td><td id="rateioTotalLucro">—</td><td></td><td></td></tr></tfoot>
                                                                                                                              </table>
                                                                                                                                  </div>
                                                                                                                                      <button type="button" class="btn ghost" id="rateioAdicionarLinha" style="margin-top:8px;">+ Adicionar corte/produto</button>
                                                                                                                                          <div id="rateioMsg" style="font-size:12px; margin-top:12px; display:none;"></div>
                                                                                                                                              <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="rateioSalvar">Salvar rateio</button></div>
                                                                                                                                                `;

  wireAbaRateioModo1();
    recalcularRateio();
}

function wireAbaRateioModo1(){
    document.querySelectorAll('#rateioBody .rateio-row').forEach(row=>{
          const idx = Number(row.dataset.idx);
          const selProduto = row.querySelector('.rateio-produto');
          selProduto.addEventListener('change', e=>{
                  rateioItens[idx].produto_id = e.target.value;
                  const novoWrap = row.querySelector('.rateio-produto-novo');
                  novoWrap.style.display = e.target.value==='__novo__' ? 'block' : 'none';
                  if(e.target.value && e.target.value!=='__novo__'){
                            const opt = e.target.selectedOptions[0];
                            const preco = opt ? opt.dataset.preco : '';
                            if(preco && !rateioItens[idx].preco_venda){
                                        rateioItens[idx].preco_venda = preco;
                                        row.querySelector('.rateio-preco').value = preco;
                            }
                  }
                  recalcularRateio();
          });
          row.querySelector('.rateio-produto-novo').addEventListener('input', e=>{ rateioItens[idx].produto_nome = e.target.value; });
          row.querySelector('.rateio-peso').addEventListener('input', e=>{ rateioItens[idx].peso_ou_quantidade = e.target.value; recalcularRateio(); });
          row.querySelector('.rateio-preco').addEventListener('input', e=>{ rateioItens[idx].preco_venda = e.target.value; recalcularRateio(); });
          row.querySelector('.rateio-obs').addEventListener('input', e=>{ rateioItens[idx].observacao = e.target.value; });
    });
    document.querySelectorAll('#rateioBody .rateio-remover').forEach(btn=>{
          btn.addEventListener('click', e=>{
                  const idx = Number(e.currentTarget.dataset.idx);
                  rateioItens.splice(idx,1);
                  renderAbaRateioModo1();
          });
    });
    document.getElementById('rateioAdicionarLinha').addEventListener('click', ()=>{
          rateioItens.push({produto_id:'', produto_nome:'', peso_ou_quantidade:'', preco_venda:'', observacao:''});
          renderAbaRateioModo1();
    });
    document.getElementById('rateioValorTotal').addEventListener('input', recalcularRateio);
    document.getElementById('rateioDeclarado').addEventListener('input', recalcularRateio);
    document.getElementById('rateioSalvar').addEventListener('click', salvarRateio);
}

function recalcularRateio(){
    const valorTotal = parseFloat(document.getElementById('rateioValorTotal').value) || 0;
    const declarado = parseFloat(document.getElementById('rateioDeclarado').value) || 0;
    const pesoTotal = rateioItens.reduce((s,it)=> s + (parseFloat(it.peso_ou_quantidade)||0), 0);
    const custoPorUnidade = pesoTotal>0 ? valorTotal/pesoTotal : 0;
    let custoTotalAlocado = 0, lucroTotalGeral = 0;
    document.querySelectorAll('#rateioBody .rateio-row').forEach(row=>{
          const idx = Number(row.dataset.idx);
          const peso = parseFloat(rateioItens[idx].peso_ou_quantidade) || 0;
          const preco = parseFloat(rateioItens[idx].preco_venda) || 0;
          const pct = pesoTotal>0 ? peso/pesoTotal : 0;
          const custo = peso*custoPorUnidade;
          const lucroUnit = preco>0 ? preco-custoPorUnidade : 0;
          const lucroTotal = lucroUnit*peso;
          custoTotalAlocado += custo;
          if(preco>0) lucroTotalGeral += lucroTotal;
          row.querySelector('.rateio-pct').textContent = pesoTotal>0 ? (pct*100).toFixed(1)+'%' : '—';
          row.querySelector('.rateio-custo').textContent = fmtBRL(custo);
          row.querySelector('.rateio-lucro-unit').textContent = preco>0 ? fmtBRL(lucroUnit) : '—';
          row.querySelector('.rateio-lucro-total').textContent = preco>0 ? fmtBRL(lucroTotal) : '—';
    });
    document.getElementById('rateioTotalPeso').textContent = pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:3});
    document.getElementById('rateioTotalCusto').textContent = fmtBRL(custoTotalAlocado);
    document.getElementById('rateioTotalLucro').textContent = fmtBRL(lucroTotalGeral);

  const divBanner = document.getElementById('rateioDivergencia');
    if(declarado>0 && pesoTotal>0){
          const diff = declarado - pesoTotal;
          if(Math.abs(diff) > 0.001){
                  divBanner.style.display = 'block';
                  divBanner.textContent = `Soma das linhas: ${pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:3})} — documento indica ${declarado.toLocaleString('pt-BR',{maximumFractionDigits:3})}. ${diff>0?'Faltam':'Sobram'} ${Math.abs(diff).toLocaleString('pt-BR',{maximumFractionDigits:3})}.`;
          } else {
                  divBanner.style.display = 'none';
          }
    } else {
          divBanner.style.display = 'none';
    }
}

async function salvarRateio(){
    const msg = document.getElementById('rateioMsg');
    msg.style.display = 'none';
    const btn = document.getElementById('rateioSalvar');
    btn.disabled = true;
    try{
          const fornecedorSelect = document.querySelector('select[name="rateio_fornecedor"]');
          const fornecedorForm = { rateio_fornecedor: fornecedorSelect ? fornecedorSelect.value : '', novo_rateio_fornecedor: (document.querySelector('input[name="novo_rateio_fornecedor"]')||{}).value || '' };
          const fornecedorId = await resolverCadastro({name:'rateio_fornecedor', cadastro:'fornecedores', label:'Fornecedor'}, fornecedorForm);

      const dataCompra = document.getElementById('rateioData').value;
          const valorTotal = parseFloat(document.getElementById('rateioValorTotal').value) || 0;
          const base = document.getElementById('rateioBase').value;
          const declarado = document.getElementById('rateioDeclarado').value;

      if(!dataCompra) throw new Error('Informe a data da compra.');
          if(!(valorTotal>0)) throw new Error('Informe o valor total pago.');

      const itens = rateioItens.map(it=>({
              produto_id: it.produto_id && it.produto_id!=='__novo__' ? it.produto_id : undefined,
              produto_nome: it.produto_id==='__novo__' ? it.produto_nome : undefined,
              peso_ou_quantidade: parseFloat(it.peso_ou_quantidade) || 0,
              preco_venda: it.preco_venda ? parseFloat(it.preco_venda) : undefined,
              observacao: it.observacao || undefined,
      })).filter(it => (it.produto_id || it.produto_nome) && it.peso_ou_quantidade>0);

      if(!itens.length) throw new Error('Informe ao menos um produto/corte com peso/quantidade maior que zero.');

      await apiFetch('/api/produtos/rateio', {method:'POST', body: JSON.stringify({
              fornecedor_id: fornecedorId, data_compra: dataCompra, valor_total_pago: valorTotal,
              base_rateio: base, modo: 'rateio',
              peso_ou_qtd_total_declarado: declarado ? parseFloat(declarado) : undefined,
              itens,
      })});

      rateioItens = [];
          await carregarCadastros();
          msg.textContent = 'Rateio salvo com sucesso ✓'; msg.style.color = 'var(--olive)'; msg.style.display='block';
          renderAbaRateioModo1();
    }catch(err){
          msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
          btn.disabled = false;
    }
}

/* ---------- Modo 2: Lançamento Direto (compra = venda na mesma unidade) ---------- */

function renderAbaRateioModo2(){
    document.getElementById('cpAbaContent').innerHTML = `
        <div class="form-grid">
              ${renderCadastroField({name:'direto_produto', label:'Produto', cadastro:'produtos', full:true}, {})}
                    ${renderCadastroField({name:'direto_fornecedor', label:'Fornecedor (opcional)', cadastro:'fornecedores', full:false}, {})}
                          <div class="field"><label>Data da compra</label><input type="date" id="diretoData" value="${todayISO()}"></div>
                                <div class="field"><label>Quantidade comprada</label><input type="number" step="0.001" min="0" id="diretoQtd"></div>
                                      <div class="field"><label>Valor total pago (R$)</label><input type="number" step="0.01" min="0" id="diretoValorTotal"></div>
                                            <div class="field"><label>Preço de venda (R$/un)</label><input type="number" step="0.01" min="0" id="diretoPrecoVenda"></div>
                                                </div>
                                                    <div id="diretoResumo" style="background:var(--paper-2); border:1px solid var(--border); border-radius:10px; padding:12px; margin:12px 0; font-size:13px;">Preencha quantidade e valor total para ver o cálculo.</div>
                                                        <div id="diretoMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
                                                            <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="diretoSalvar">Salvar lançamento</button></div>
                                                              `;
    ['diretoQtd','diretoValorTotal','diretoPrecoVenda'].forEach(id=>{
          document.getElementById(id).addEventListener('input', recalcularDireto);
    });
    document.getElementById('diretoSalvar').addEventListener('click', salvarDireto);
}

function recalcularDireto(){
    const qtd = parseFloat(document.getElementById('diretoQtd').value) || 0;
    const valorTotal = parseFloat(document.getElementById('diretoValorTotal').value) || 0;
    const preco = parseFloat(document.getElementById('diretoPrecoVenda').value) || 0;
    const custoUnit = qtd>0 ? valorTotal/qtd : 0;
    const lucroUnit = preco>0 ? preco-custoUnit : 0;
    const lucroTotal = lucroUnit*qtd;
    document.getElementById('diretoResumo').innerHTML = qtd>0
      ? `Custo por unidade: <strong>${fmtBRL(custoUnit)}</strong> · Lucro por unidade: <strong>${preco>0?fmtBRL(lucroUnit):'—'}</strong> · Lucro total: <strong>${preco>0?fmtBRL(lucroTotal):'—'}</strong>`
          : 'Preencha quantidade e valor total para ver o cálculo.';
}

async function salvarDireto(){
    const msg = document.getElementById('diretoMsg');
    msg.style.display = 'none';
    const btn = document.getElementById('diretoSalvar');
    btn.disabled = true;
    try{
          const produtoSelect = document.querySelector('select[name="direto_produto"]');
          const produtoForm = { direto_produto: produtoSelect ? produtoSelect.value : '', novo_direto_produto: (document.querySelector('input[name="novo_direto_produto"]')||{}).value || '' };
          const produtoId = await resolverCadastro({name:'direto_produto', cadastro:'produtos', label:'Produto'}, produtoForm);
          if(!produtoId) throw new Error('Selecione ou cadastre um produto.');

      const fornecedorSelect = document.querySelector('select[name="direto_fornecedor"]');
          const fornecedorForm = { direto_fornecedor: fornecedorSelect ? fornecedorSelect.value : '', novo_direto_fornecedor: (document.querySelector('input[name="novo_direto_fornecedor"]')||{}).value || '' };
          const fornecedorId = await resolverCadastro({name:'direto_fornecedor', cadastro:'fornecedores', label:'Fornecedor'}, fornecedorForm);

      const dataCompra = document.getElementById('diretoData').value;
          const qtd = parseFloat(document.getElementById('diretoQtd').value) || 0;
          const valorTotal = parseFloat(document.getElementById('diretoValorTotal').value) || 0;
          const preco = document.getElementById('diretoPrecoVenda').value;

      if(!dataCompra) throw new Error('Informe a data da compra.');
          if(!(qtd>0)) throw new Error('Informe a quantidade comprada.');
          if(!(valorTotal>0)) throw new Error('Informe o valor total pago.');

      await apiFetch('/api/produtos/rateio', {method:'POST', body: JSON.stringify({
              fornecedor_id: fornecedorId, data_compra: dataCompra, valor_total_pago: valorTotal,
              base_rateio: 'quantidade', modo: 'direto',
              itens: [{ produto_id: produtoId, peso_ou_quantidade: qtd, preco_venda: preco?parseFloat(preco):undefined }],
      })});

      await carregarCadastros();
          msg.textContent = 'Lançamento salvo com sucesso ✓'; msg.style.color='var(--olive)'; msg.style.display='block';
          renderAbaRateioModo2();
    }catch(err){
          msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
          btn.disabled = false;
    }
}


/* ---------- Modo 3: Vários Produtos, 1 nota (cada produto com seu próprio valor pago) ---------- */

let multiploItens = [];

function optsProdutosMultiplo(selectedId){
    const lista = CADASTROS.produtos || [];
    const opts = [`<option value="" disabled ${!selectedId?'selected':''}>— Selecione —</option>`]
      .concat(lista.map(p=>`<option value="${p.id}" data-preco="${p.preco_venda!=null?p.preco_venda:''}" ${String(selectedId)===String(p.id)?'selected':''}>${escapeHtml(p.nome)}</option>`))
      .concat([`<option value="__novo__" ${selectedId==='__novo__'?'selected':''}>+ Cadastrar novo produto</option>`]);
    return opts.join('');
}

function renderAbaMultiplo(){
    if(!multiploItens.length){
          multiploItens = [{produto_id:'', produto_nome:'', quantidade:'', valor_pago:'', preco_venda:'', observacao:''}];
    }
    const linhas = multiploItens.map((it,i)=>`
        <tr class="multiplo-row" data-idx="${i}">
              <td style="min-width:180px;">
                    <select class="multiplo-produto">${optsProdutosMultiplo(it.produto_id)}</select>
                    <input type="text" class="multiplo-produto-novo" placeholder="Nome do novo produto" style="display:${it.produto_id==='__novo__'?'block':'none'}; margin-top:4px;" value="${escapeHtml(it.produto_nome||'')}">
                  </td>
                        <td style="min-width:100px;"><input type="number" step="0.001" min="0" class="multiplo-qtd" value="${escapeHtml(String(it.quantidade))}"></td>
                              <td style="min-width:110px;"><input type="number" step="0.01" min="0" class="multiplo-valor" value="${escapeHtml(String(it.valor_pago))}"></td>
                                    <td class="multiplo-custo-unit" style="text-align:right;">—</td>
                                          <td style="min-width:110px;"><input type="number" step="0.01" min="0" class="multiplo-preco" value="${escapeHtml(String(it.preco_venda))}"></td>
                                                <td class="multiplo-lucro-unit" style="text-align:right;">—</td>
                                                      <td class="multiplo-lucro-total" style="text-align:right;">—</td>
                                                            <td style="min-width:130px;"><input type="text" class="multiplo-obs" placeholder="opcional" style="width:100%; box-sizing:border-box;" value="${escapeHtml(it.observacao||'')}"></td>
                                                                  <td>${multiploItens.length>1?`<button type="button" class="btn-mini multiplo-remover" data-idx="${i}">✕</button>`:''}</td>
                                                                      </tr>`).join('');

  document.getElementById('cpAbaContent').innerHTML = `
      <div class="form-grid">
            ${renderCadastroField({name:'multiplo_fornecedor', label:'Fornecedor', cadastro:'fornecedores', full:false}, {})}
                  <div class="field"><label>Data da compra</label><input type="date" id="multiploData" value="${todayISO()}"></div>
                        <div class="field"><label>Nº da nota (opcional)</label><input type="text" id="multiploNota" placeholder="ex: NF 12345"></div>
                              </div>
                                  <p style="font-size:12px; color:var(--ink-soft); margin:-4px 0 10px;">Uma nota com vários produtos diferentes, cada um com o valor efetivamente pago por ele (sem rateio proporcional).</p>
                                      <div style="overflow-x:auto;">
                                            <table class="report">
                                                    <thead><tr><th>Produto</th><th>Qtd/Peso</th><th>Valor pago</th><th>Custo/un</th><th>Preço venda</th><th>Lucro/un</th><th>Lucro total</th><th>Obs.</th><th></th></tr></thead>
                                                            <tbody id="multiploBody">${linhas}</tbody>
                                                                    <tfoot><tr style="font-weight:600;"><td>Total</td><td></td><td id="multiploTotalValor">—</td><td></td><td></td><td></td><td id="multiploTotalLucro">—</td><td></td><td></td></tr></tfoot>
                                                                          </table>
                                                                              </div>
                                                                                  <button type="button" class="btn ghost" id="multiploAdicionarLinha" style="margin-top:8px;">+ Adicionar produto</button>
                                                                                      <div id="multiploMsg" style="font-size:12px; margin-top:12px; display:none;"></div>
                                                                                          <div class="panel-actions" style="margin-top:14px;"><button type="button" class="btn gold" id="multiploSalvar">Salvar lançamentos</button></div>
                                                                                            `;

  wireAbaMultiplo();
    recalcularMultiplo();
}

function wireAbaMultiplo(){
    document.querySelectorAll('#multiploBody .multiplo-row').forEach(row=>{
          const idx = Number(row.dataset.idx);
          const selProduto = row.querySelector('.multiplo-produto');
          selProduto.addEventListener('change', e=>{
                  multiploItens[idx].produto_id = e.target.value;
                  const novoWrap = row.querySelector('.multiplo-produto-novo');
                  novoWrap.style.display = e.target.value==='__novo__' ? 'block' : 'none';
                  if(e.target.value && e.target.value!=='__novo__'){
                            const opt = e.target.selectedOptions[0];
                            const preco = opt ? opt.dataset.preco : '';
                            if(preco && !multiploItens[idx].preco_venda){
                                        multiploItens[idx].preco_venda = preco;
                                        row.querySelector('.multiplo-preco').value = preco;
                            }
                  }
                  recalcularMultiplo();
          });
          row.querySelector('.multiplo-produto-novo').addEventListener('input', e=>{ multiploItens[idx].produto_nome = e.target.value; });
          row.querySelector('.multiplo-qtd').addEventListener('input', e=>{ multiploItens[idx].quantidade = e.target.value; recalcularMultiplo(); });
          row.querySelector('.multiplo-valor').addEventListener('input', e=>{ multiploItens[idx].valor_pago = e.target.value; recalcularMultiplo(); });
          row.querySelector('.multiplo-preco').addEventListener('input', e=>{ multiploItens[idx].preco_venda = e.target.value; recalcularMultiplo(); });
          row.querySelector('.multiplo-obs').addEventListener('input', e=>{ multiploItens[idx].observacao = e.target.value; });
    });
    document.querySelectorAll('#multiploBody .multiplo-remover').forEach(btn=>{
          btn.addEventListener('click', e=>{
                  const idx = Number(e.currentTarget.dataset.idx);
                  multiploItens.splice(idx,1);
                  renderAbaMultiplo();
          });
    });
    document.getElementById('multiploAdicionarLinha').addEventListener('click', ()=>{
          multiploItens.push({produto_id:'', produto_nome:'', quantidade:'', valor_pago:'', preco_venda:'', observacao:''});
          renderAbaMultiplo();
    });
    document.getElementById('multiploSalvar').addEventListener('click', salvarMultiplo);
}

function recalcularMultiplo(){
    let valorTotalGeral = 0, lucroTotalGeral = 0;
    document.querySelectorAll('#multiploBody .multiplo-row').forEach(row=>{
          const idx = Number(row.dataset.idx);
          const qtd = parseFloat(multiploItens[idx].quantidade) || 0;
          const valorPago = parseFloat(multiploItens[idx].valor_pago) || 0;
          const preco = parseFloat(multiploItens[idx].preco_venda) || 0;
          const custoUnit = qtd>0 ? valorPago/qtd : 0;
          const lucroUnit = preco>0 ? preco-custoUnit : 0;
          const lucroTotal = lucroUnit*qtd;
          valorTotalGeral += valorPago;
          if(preco>0) lucroTotalGeral += lucroTotal;
          row.querySelector('.multiplo-custo-unit').textContent = qtd>0 ? fmtBRL(custoUnit) : '—';
          row.querySelector('.multiplo-lucro-unit').textContent = preco>0 ? fmtBRL(lucroUnit) : '—';
          row.querySelector('.multiplo-lucro-total').textContent = preco>0 ? fmtBRL(lucroTotal) : '—';
    });
    document.getElementById('multiploTotalValor').textContent = fmtBRL(valorTotalGeral);
    document.getElementById('multiploTotalLucro').textContent = fmtBRL(lucroTotalGeral);
}

async function salvarMultiplo(){
    const msg = document.getElementById('multiploMsg');
    msg.style.display = 'none';
    const btn = document.getElementById('multiploSalvar');
    btn.disabled = true;
    try{
          const fornecedorSelect = document.querySelector('select[name="multiplo_fornecedor"]');
          const fornecedorForm = { multiplo_fornecedor: fornecedorSelect ? fornecedorSelect.value : '', novo_multiplo_fornecedor: (document.querySelector('input[name="novo_multiplo_fornecedor"]')||{}).value || '' };
          const fornecedorId = await resolverCadastro({name:'multiplo_fornecedor', cadastro:'fornecedores', label:'Fornecedor'}, fornecedorForm);

      const dataCompra = document.getElementById('multiploData').value;
          const nota = document.getElementById('multiploNota').value.trim();

      if(!dataCompra) throw new Error('Informe a data da compra.');

      const itensValidos = multiploItens.filter(it => (it.produto_id || it.produto_nome) && (parseFloat(it.quantidade)||0)>0 && (parseFloat(it.valor_pago)||0)>0);
          if(!itensValidos.length) throw new Error('Informe ao menos um produto com quantidade e valor pago maiores que zero.');

      for(const it of itensValidos){
              const observacao = [nota ? `Nota ${nota}` : '', it.observacao || ''].filter(Boolean).join(' — ') || undefined;
              await apiFetch('/api/produtos/rateio', {method:'POST', body: JSON.stringify({
                        fornecedor_id: fornecedorId, data_compra: dataCompra, valor_total_pago: parseFloat(it.valor_pago),
                        base_rateio: 'quantidade', modo: 'direto',
                        itens: [{
                                    produto_id: it.produto_id && it.produto_id!=='__novo__' ? it.produto_id : undefined,
                                    produto_nome: it.produto_id==='__novo__' ? it.produto_nome : undefined,
                                    peso_ou_quantidade: parseFloat(it.quantidade) || 0,
                                    preco_venda: it.preco_venda ? parseFloat(it.preco_venda) : undefined,
                                    observacao,
                        }],
              })});
      }

      multiploItens = [];
          await carregarCadastros();
          msg.textContent = 'Lançamentos salvos com sucesso ✓'; msg.style.color = 'var(--olive)'; msg.style.display='block';
          renderAbaMultiplo();
    }catch(err){
          msg.textContent = 'Erro: ' + err.message; msg.style.color='var(--red)'; msg.style.display='block';
          btn.disabled = false;
    }
}

/* ---------- Produtos & Preços ---------- */

async function renderAbaProdutos(){
    document.getElementById('cpAbaContent').innerHTML = `<p style="font-size:12.5px; color:var(--ink-soft);">Carregando produtos…</p>`;
    let produtos = [];
    try{
          produtos = await apiFetch('/api/produtos') || [];
    }catch(err){
          document.getElementById('cpAbaContent').innerHTML = `<p style="color:var(--red);">Erro ao carregar produtos: ${err.message}</p>`;
          return;
    }
    const linhas = produtos.map(p => `
        <tr data-id="${p.id}">
              <td>${escapeHtml(p.nome)}</td>
                    <td>${escapeHtml(p.categoria || '—')}</td>
                          <td>${escapeHtml(p.unidade_padrao)}</td>
                                <td><input type="number" step="0.01" min="0" class="prod-preco" data-id="${p.id}" value="${p.preco_venda!=null?p.preco_venda:''}" style="width:100px;"></td>
                                      <td>${Number(p.saldo_atual).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${escapeHtml(p.unidade_padrao)}</td>
                                            <td><span class="prod-msg" style="font-size:10.5px;"></span></td>
                                                </tr>`).join('');

  document.getElementById('cpAbaContent').innerHTML = `
      <div style="overflow-x:auto;">
            <table class="report">
                    <thead><tr><th>Produto</th><th>Categoria</th><th>Unidade</th><th>Preço de venda (R$)</th><th>Saldo em estoque</th><th></th></tr></thead>
                            <tbody id="prodBody">${linhas || '<tr><td colspan="6">Nenhum produto cadastrado ainda.</td></tr>'}</tbody>
                                  </table>
                                      </div>
                                          <div class="section-title">Novo produto</div>
                                              <div class="form-grid">
                                                    <div class="field"><label>Nome</label><input type="text" id="novoProdNome"></div>
                                                          <div class="field"><label>Categoria (opcional)</label><input type="text" id="novoProdCategoria" placeholder="ex: Corte bovino, Mercado/Churrasco"></div>
                                                                <div class="field"><label>Unidade padrão</label><select id="novoProdUnidade"><option value="kg">kg</option><option value="un">un</option></select></div>
                                                                      <div class="field"><label>Preço de venda (R$, opcional)</label><input type="number" step="0.01" min="0" id="novoProdPreco"></div>
                                                                          </div>
                                                                              <div id="novoProdMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
                                                                                  <button type="button" class="btn gold" id="novoProdSalvar" style="margin-top:8px;">Cadastrar produto</button>
                                                                                    `;

  document.querySelectorAll('.prod-preco').forEach(inp=>{
        inp.addEventListener('change', async e=>{
                const id = e.target.dataset.id;
                const msg = e.target.closest('tr').querySelector('.prod-msg');
                try{
                          await apiFetch(`/api/produtos/${id}`, {method:'PATCH', body: JSON.stringify({preco_venda: parseFloat(e.target.value)||null})});
                          msg.textContent = 'Salvo ✓'; msg.style.color = 'var(--olive)';
                          await carregarCadastros();
                }catch(err){ msg.textContent = 'Erro: '+err.message; msg.style.color='var(--red)'; }
        });
  });

  document.getElementById('novoProdSalvar').addEventListener('click', async ()=>{
        const msg = document.getElementById('novoProdMsg');
        msg.style.display = 'none';
        const nome = document.getElementById('novoProdNome').value.trim();
        if(!nome){ msg.textContent = 'Informe o nome do produto.'; msg.style.color='var(--red)'; msg.style.display='block'; return; }
        try{
                await apiFetch('/api/produtos', {method:'POST', body: JSON.stringify({
                          nome, categoria: document.getElementById('novoProdCategoria').value.trim() || undefined,
                          unidade_padrao: document.getElementById('novoProdUnidade').value,
                          preco_venda: document.getElementById('novoProdPreco').value ? parseFloat(document.getElementById('novoProdPreco').value) : undefined,
                })});
                await carregarCadastros();
                renderAbaProdutos();
        }catch(err){ msg.textContent = 'Erro: '+err.message; msg.style.color='var(--red)'; msg.style.display='block'; }
  });
}

/* ---------- Estoque: saldo + baixa manual ---------- */

async function renderAbaEstoque(){
  document.getElementById('cpAbaContent').innerHTML = `<p style="font-size:12.5px; color:var(--ink-soft);">Carregando estoque…</p>`;
  let saldo;
  try{
    saldo = await apiFetch('/api/produtos/estoque/saldo') || [];
  }catch(err){
    document.getElementById('cpAbaContent').innerHTML = `<p style="color:var(--red);">Erro ao carregar estoque: ${err.message}</p>`;
    return;
  }
  const linhas = saldo.map(s => `<tr data-produto="${escapeHtml(s.produto_nome)}">
    <td>${escapeHtml(s.produto_nome)}</td>
    <td><input type="number" step="0.001" min="0" class="estoque-saldo" value="${Number(s.saldo_atual||0)}" style="width:110px;"> ${escapeHtml(s.unidade_padrao||'')}</td>
    <td>${s.ultima_movimentacao ? fmtDate(s.ultima_movimentacao) : '—'}</td>
    <td><span class="estoque-msg" style="font-size:10.5px;"></span></td>
  </tr>`).join('');

  document.getElementById('cpAbaContent').innerHTML = `
    <div style="overflow-x:auto;">
      <table class="report">
        <thead><tr><th>Produto</th><th>Saldo atual</th><th>Última movimentação</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="4">Nenhum movimento de estoque ainda.</td></tr>'}</tbody>
      </table>
    </div>
    <p style="font-size:11.5px; color:var(--ink-soft); margin-top:-4px;">Edite o saldo diretamente para corrigir uma contagem física — o ajuste fica registrado no histórico de movimentações, igual a uma entrada ou baixa normal.</p>
    <div class="section-title">Baixa manual de estoque</div>
    <p style="font-size:12px; color:var(--ink-soft); margin-top:-6px;">Venda avulsa, perda, consumo interno — não lança nem referencia contas a pagar/receber.</p>
    <div class="form-grid">
      ${renderCadastroField({name:'baixa_produto', label:'Produto', cadastro:'produtos', full:true})}
      <div class="field"><label>Quantidade</label><input type="number" step="0.001" min="0" id="baixaQtd"></div>
      <div class="field"><label>Data</label><input type="date" id="baixaData" value="${todayISO()}"></div>
      <div class="field full"><label>Observação (opcional)</label><input type="text" id="baixaObs"></div>
    </div>
    <div id="baixaMsg" style="font-size:12px; margin-top:8px; display:none;"></div>
    <button type="button" class="btn gold" id="baixaSalvar" style="margin-top:8px;">Registrar baixa</button>
  `;

  document.querySelectorAll('.estoque-saldo').forEach(inp=>{
    inp.addEventListener('change', async (e)=>{
      const produtoNome = e.target.closest('tr').dataset.produto;
      const msg = e.target.closest('tr').querySelector('.estoque-msg');
      msg.style.display = 'none';
      const novoSaldo = parseFloat(e.target.value);
      if(!(novoSaldo >= 0)){
        msg.textContent = 'Valor inválido.';
        msg.style.color = 'var(--red)';
        msg.style.display = 'block';
        return;
      }
      try{
        await apiFetch('/api/produtos/estoque/ajuste', {method:'POST', body: JSON.stringify({
          produto_nome: produtoNome, novo_saldo: novoSaldo, observacao: 'Ajuste manual via aba Estoque'
        })});
        msg.textContent = 'Salvo ✓';
        msg.style.color = 'var(--olive)';
        msg.style.display = 'block';
        await carregarCadastros();
      }catch(err){
        msg.textContent = 'Erro: ' + err.message;
        msg.style.color = 'var(--red)';
        msg.style.display = 'block';
      }
    });
  });

  document.getElementById('baixaSalvar').addEventListener('click', async ()=>{
    const msg = document.getElementById('baixaMsg');
    msg.style.display = 'none';
    try{
      const produtoSelect = document.querySelector('select[name="baixa_produto"]');
      const produtoForm = produtoSelect ? { baixa_produto: produtoSelect.value } : { novo_baixa_produto: document.querySelector('input[name="novo_baixa_produto"]').value };
      const produtoId = await resolverCadastro({ name:'baixa_produto', cadastro:'produtos', label:'Produto', form: produtoForm });
      if(!produtoId) throw new Error('Selecione um produto.');
      const qtd = parseFloat(document.getElementById('baixaQtd').value) || 0;
      const data = document.getElementById('baixaData').value;
      if(!(qtd > 0)) throw new Error('Informe a quantidade.');
      if(!data) throw new Error('Informe a data.');
      await apiFetch('/api/produtos/estoque/baixa', {method:'POST', body: JSON.stringify({
        produto_id: produtoId, quantidade: qtd, data, observacao: document.getElementById('baixaObs').value.trim() || undefined
      })});
      msg.textContent = 'Baixa registrada ✓';
      msg.style.color = 'var(--olive)';
      msg.style.display = 'block';
      renderAbaEstoque();
    }catch(err){
      msg.textContent = 'Erro: ' + err.message;
      msg.style.color = 'var(--red)';
      msg.style.display = 'block';
    }
  });
}


/* ---------- Tipo de peça: auto-popula cortes no Rateio de Compra ----------
   Pedido da Danielle (01/10/2026): quando a Cristal compra uma peça inteira (ex: capote
   traseiro bovino, dianteiro bovino, suíno inteiro) e desossa internamente em vários cortes
   de venda, selecionar o tipo aqui auto-popula as linhas do Rateio de Compra (aba "Rateio de
   Compra") com os cortes certos, bastando preencher peso e preço de venda de cada um.
   Implementado sem alterar renderAbaRateioModo1/wireAbaRateioModo1 originais — só "encapsula"
   a função original e insere uma barra de seleção acima da tabela depois que ela renderiza.
   Backend: GET/POST /api/produtos/tipos-peca (src/routes/produtos.js). */
let TIPOS_PECA_CACHE = null;

async function carregarTiposPeca(forcar){
  if(TIPOS_PECA_CACHE && !forcar) return TIPOS_PECA_CACHE;
  try{
    TIPOS_PECA_CACHE = await apiFetch('/api/produtos/tipos-peca') || [];
  }catch(err){
    TIPOS_PECA_CACHE = [];
  }
  return TIPOS_PECA_CACHE;
}

function tipoPecaBarraHtml(tipos){
  const opts = ['<option value="">Tipo de peça (opcional) — selecione para auto-popular os cortes</option>']
    .concat(tipos.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`))
    .join('');
  return `<div class="field full" style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
    <select id="tipoPecaSelect" style="min-width:280px;">${opts}</select>
    <button type="button" class="btn ghost" id="tipoPecaNovoBtn" style="font-size:12px;">+ Novo tipo de peça</button>
  </div>`;
}

function wireTipoPecaBarra(){
  const sel = document.getElementById('tipoPecaSelect');
  if(sel){
    sel.addEventListener('change', (e)=>{
      const tipoId = e.target.value;
      if(!tipoId) return;
      const tipo = (TIPOS_PECA_CACHE || []).find(t => String(t.id) === tipoId);
      if(!tipo || !tipo.cortes || !tipo.cortes.length) return;
      rateioItens = tipo.cortes.map(nomeCorte => ({
        produto_id: '', produto_nome: nomeCorte, peso_ou_quantidade: '', preco_venda: '', observacao: ''
      }));
      renderAbaRateioModo1();
    });
  }
  const novoBtn = document.getElementById('tipoPecaNovoBtn');
  if(novoBtn){
    novoBtn.addEventListener('click', async ()=>{
      const nome = prompt('Nome do tipo de peça (ex: Capote traseiro bovino):');
      if(!nome || !nome.trim()) return;
      const cortesTxt = prompt('Cole os cortes que essa peça origina, um por linha:');
      if(!cortesTxt) return;
      const cortes = cortesTxt.split('\n').map(c => c.trim()).filter(Boolean);
      if(!cortes.length) return;
      try{
        await apiFetch('/api/produtos/tipos-peca', {method:'POST', body: JSON.stringify({ nome: nome.trim(), cortes })});
        await carregarTiposPeca(true);
        renderAbaRateioModo1();
      }catch(err){
        alert('Erro ao salvar tipo de peça: ' + err.message);
      }
    });
  }
}

const __renderAbaRateioModo1Base = renderAbaRateioModo1;
renderAbaRateioModo1 = function(){
  __renderAbaRateioModo1Base();
  const wrap = document.getElementById('cpAbaContent');
  if(wrap && !document.getElementById('tipoPecaSelect')){
    carregarTiposPeca().then(tipos=>{
      if(!document.getElementById('cpAbaContent') || document.getElementById('tipoPecaSelect')) return;
      const bar = document.createElement('div');
      bar.innerHTML = tipoPecaBarraHtml(tipos);
      wrap.insertBefore(bar.firstElementChild, wrap.firstElementChild);
      wireTipoPecaBarra();
    });
  }
};
