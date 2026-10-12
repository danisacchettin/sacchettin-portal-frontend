/* Nova versão — páginas de resumo com BI dos módulos: Hoje, Caixa, Contas, Resultado, Dívidas e contratos,
   Compras e custos, Pessoas e Cadastros. Só existe em /novo. Somente leitura.
   Usa os mesmos dados que o portal atual já carrega (DATA e as rotas que as telas atuais já usam),
   portanto os totais batem com as telas de detalhe. Onde o dado é estimativa ou parcial, a página diz. */
(function(){
  'use strict';
  var R = window.DSSJ_R; if (!R || !R.u) return;
  var U = R.u, esc = U.esc, brl = U.brl, brl0 = U.brl0, num = U.num, pc = U.pc, card = U.card, selo = U.selo, calc = U.calc, sec = U.sec, soma = U.soma, delta = U.delta, varPct = U.varPct, CORES = U.CORES, EIXO = U.EIXO;
  var P = R.paginas;

  function d10(s){ return String(s || '').slice(0, 10); }
  function diasAte(venc){ return Math.round((U.pdata(d10(venc)) - U.pdata(U.hoje())) / 86400000); } // dias até o vencimento (negativo = atrasado), data LOCAL
  function aberto(x, tipo){ return (typeof saldoAberto === 'function') ? saldoAberto(x, tipo) : 0; }
  function pagar(){ return (typeof DATA !== 'undefined' && DATA && DATA.contasPagar) || []; }
  function receber(){ return (typeof DATA !== 'undefined' && DATA && DATA.contasReceber) || []; }
  function contas(){ return (typeof DATA !== 'undefined' && DATA && DATA.saldoContas) || []; }
  function mesDe(iso){ return d10(iso).slice(0, 7); }
  function mesAtual(){ return U.hoje().slice(0, 7); }
  function mesDelta(ym, n){ var p = ym.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  var MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  function rotMes(ym){ return MESES[+ym.slice(5, 7) - 1] + '/' + ym.slice(2, 4); }
  function semDados(alvo){ alvo.innerHTML = '<div class="v2-vazio">Os dados do portal ainda não foram carregados. Aguarde alguns segundos e abra a página novamente.</div>'; }
  function cab(t, s){ return '<h2>' + esc(t) + '</h2><p class="v2-sub">' + s + '</p>'; }
  function vendasPeriodo(de, ate){
    return U.pdvPronto().then(function(s){ if (!s.pronto) return null; return U.api('/api/pdv-bi/visao?de=' + de + '&ate=' + ate); })
      .then(function(d){ return (d && d.pronto !== false) ? d : null; }).catch(function(){ return null; });
  }
  var JANELA = 'Base: títulos carregados no portal (saldo em aberto ou vencimento nos últimos 180 dias).';

  /* ================= HOJE ================= */
  P['hoje'] = function(alvo, ctx){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var hj = U.hoje(), pg = pagar(), rc = receber();
    var saldo = soma(contas(), function(c){ return c.saldo; });
    var pgHoje = pg.filter(function(x){ return d10(x.vencimento) === hj && aberto(x, 'pagar') > 0; });
    var venc = pg.filter(function(x){ return diasAte(x.vencimento) < 0 && aberto(x, 'pagar') > 0 && (typeof emAtraso === 'function' ? emAtraso(x, 'pagar') : true); });
    var rcAtr = rc.filter(function(x){ return diasAte(x.vencimento) < 0 && aberto(x, 'receber') > 0 && (typeof emAtraso === 'function' ? emAtraso(x, 'receber') : true); });
    var prox7 = pg.filter(function(x){ var d = diasAte(x.vencimento); return d >= 0 && d <= 7 && aberto(x, 'pagar') > 0; });
    var rec7 = rc.filter(function(x){ var d = diasAte(x.vencimento); return d >= 0 && d <= 7 && aberto(x, 'receber') > 0; });
    var tPg7 = soma(prox7, function(x){ return aberto(x, 'pagar'); }), tRc7 = soma(rec7, function(x){ return aberto(x, 'receber'); });
    var tVenc = soma(venc, function(x){ return aberto(x, 'pagar'); });
    var semCat = pg.filter(function(x){ return !x.grupo_dre && aberto(x, 'pagar') > 0; });
    var alertas = [];
    if (venc.length) alertas.push(['alerta', '<strong>' + venc.length + ' título(s) vencido(s)</strong> a pagar, somando ' + brl(tVenc) + '. Priorize negociar os mais antigos antes que gerem juros e multa.']);
    if (pgHoje.length) alertas.push(['', '<strong>' + pgHoje.length + ' título(s) vencem hoje</strong>: ' + brl(soma(pgHoje, function(x){ return aberto(x, 'pagar'); })) + '.']);
    if (saldo < tPg7 + tVenc && (tPg7 + tVenc) > 0) alertas.push(['alerta', 'O saldo em contas (' + brl(saldo) + ') <strong>não cobre</strong> os vencidos + os próximos 7 dias (' + brl(tPg7 + tVenc) + '). Faltam ' + brl(tPg7 + tVenc - saldo) + ' — considere antecipar recebíveis ou renegociar datas.']);
    else if (tPg7 + tVenc > 0) alertas.push(['bom', 'O saldo em contas cobre os vencidos e os próximos 7 dias (' + brl(tPg7 + tVenc) + ').']);
    if (rcAtr.length) alertas.push(['alerta', '<strong>' + rcAtr.length + ' recebimento(s) em atraso</strong> (' + brl(soma(rcAtr, function(x){ return aberto(x, 'receber'); })) + '). Acione a cobrança.']);
    if (U.admin() && semCat.length) alertas.push(['', '<strong>' + semCat.length + ' título(s) em aberto sem grupo no DRE</strong> (' + brl(soma(semCat, function(x){ return aberto(x, 'pagar'); })) + '): classificar melhora a leitura de resultado.']);

    alvo.innerHTML = '<div class="v2-pag">' + cab('Hoje', U.DIAS[U.pdata(hj).getDay()] + ', ' + U.dbr(hj) + ' — o que exige atenção agora.') +
      '<div class="v2-grid">' +
      card({rot:'Saldo em contas', valor:brl0(saldo), sub: contas().length + ' conta(s) bancária(s)', selo:['dado completo', 'ok']}) +
      card({rot:'A pagar hoje', valor:brl0(soma(pgHoje, function(x){ return aberto(x, 'pagar'); })), sub: pgHoje.length + ' título(s)'}) +
      card({rot:'Vencidos a pagar', valor:brl0(tVenc), tom: venc.length ? 'alerta' : 'bom', sub: venc.length + ' título(s) em atraso'}) +
      card({rot:'Próximos 7 dias', valor:brl0(tPg7), sub:'a pagar · a receber ' + brl0(tRc7)}) +
      '<div id="v2HojeVendas"></div></div>' +
      sec('Alertas') + '<ul class="v2-ins" id="v2Alertas">' + (alertas.length ? alertas.map(function(a){ return '<li class="' + a[0] + '">' + a[1] + '</li>'; }).join('') : '<li class="bom">Nada urgente no momento.</li>') + '</ul>' +
      '<div class="v2-cols" style="margin-top:18px;"><div class="v2-box"><h3>Próximos 7 dias: a pagar × a receber</h3><div style="height:220px;"><canvas id="v2GHoje" role="img" aria-label="Pagar e receber nos próximos 7 dias"></canvas></div></div>' +
      '<div class="v2-box"><h3>Maiores títulos a pagar nos próximos 7 dias</h3>' + (prox7.length ? '<table class="v2-t"><tbody>' + prox7.slice().sort(function(a, b){ return aberto(b, 'pagar') - aberto(a, 'pagar'); }).slice(0, 6).map(function(x){ return '<tr><td>' + esc(x.credor || 'Fornecedor não informado') + '<div style="font-size:11px;color:var(--ink-faint);">vence ' + U.dbr(d10(x.vencimento)) + '</div></td><td class="n">' + brl(aberto(x, 'pagar')) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="s" style="color:var(--ink-faint);font-size:12.5px;">Nenhum título a pagar nos próximos 7 dias.</div>') + '</div></div>' +
      calc('Saldo = soma dos saldos das contas bancárias cadastradas. Vencido = título com vencimento anterior a hoje e saldo em aberto. “Cobre” compara o saldo atual com vencidos + vencimentos dos próximos 7 dias, sem considerar recebimentos futuros. ' + JANELA) + '</div>';
    var dias = [], i;
    for (i = 0; i < 7; i++) dias.push(U.somaDias(hj, i));
    U.grafico('v2GHoje', {type:'bar', data:{labels:dias.map(U.dm), datasets:[
      {label:'A pagar', data:dias.map(function(d){ return soma(pg.filter(function(x){ return d10(x.vencimento) === d; }), function(x){ return aberto(x, 'pagar'); }); }), backgroundColor:'rgba(90,33,50,.8)', borderRadius:3},
      {label:'A receber', data:dias.map(function(d){ return soma(rc.filter(function(x){ return d10(x.vencimento) === d; }), function(x){ return aberto(x, 'receber'); }); }), backgroundColor:'rgba(31,107,71,.75)', borderRadius:3}]},
      options:{responsive:true, plugins:{legend:{labels:{boxWidth:10, font:{size:10}}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
    // vendas de ontem (se a análise do PDV estiver ativa): comparação com o mesmo dia da semana anterior
    var ont = U.somaDias(hj, -1), ant = U.somaDias(hj, -8);
    Promise.all([vendasPeriodo(ont, ont), vendasPeriodo(ant, ant)]).then(function(r){
      if (!ctx.vivo() || !r[0]) return;
      var el = alvo.querySelector('#v2HojeVendas');
      if (el) el.outerHTML = card({rot:'Vendas de ontem', valor:brl0(r[0].totais.valor), delta: r[1] && r[1].totais.valor > 0 ? delta(varPct(r[0].totais.valor, r[1].totais.valor)) : '', sub: r[0].totais.cupons + ' cupons · vs. ' + U.DIAS[U.pdata(ant).getDay()] + ' anterior'});
    });
  };

  /* ================= CAIXA ================= */
  P['caixa.resumo'] = function(alvo){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var hj = U.hoje(), ini30 = U.somaDias(hj, -29);
    var cx = DATA.caixaMovimentos || [];
    var m30 = cx.filter(function(m){ return d10(m.data) >= ini30 && d10(m.data) <= hj; });
    var ent = soma(m30, function(m){ return m.entrada; }), sai = soma(m30, function(m){ return m.saida; });
    var saldo = soma(contas(), function(c){ return c.saldo; });
    var porForma = {}; m30.forEach(function(m){ var f = m.forma_pagamento || 'Não informada'; porForma[f] = (porForma[f] || 0) + (Number(m.entrada || 0) - Number(m.saida || 0)); });
    var flux = DATA.fluxoProjetado || [], ac = saldo, acum = flux.map(function(m){ ac += (Number(m.receber) - Number(m.pagar)); return ac; });
    var menor = acum.length ? Math.min.apply(null, acum) : null;
    var mediaSaida = flux.length ? Number(flux[0].pagar) / 30 : 0;
    var diasCaixa = mediaSaida > 0 ? saldo / mediaSaida : null;
    var ins = [];
    if (menor !== null && menor < 0) { var im = acum.indexOf(menor); ins.push(['alerta', 'O fluxo projetado fica <strong>negativo em ' + esc(flux[im].mes) + '</strong> (' + brl0(menor) + ') se nada mudar. É o ponto para antecipar recebíveis, renegociar prazos ou reforçar vendas.']); }
    else if (menor !== null) ins.push(['bom', 'O fluxo projetado se mantém positivo nos próximos ' + flux.length + ' meses (mínimo de ' + brl0(menor) + ').']);
    if (diasCaixa !== null) ins.push([diasCaixa < 15 ? 'alerta' : '', 'O saldo atual equivale a <strong>' + num(diasCaixa, 0) + ' dia(s)</strong> de pagamentos, tomando o a pagar do mês corrente como base.']);
    alvo.innerHTML = '<div class="v2-pag">' + cab('Caixa', 'Quanto há, quanto entrou e saiu e para onde o fluxo aponta.') +
      '<div class="v2-grid">' + card({rot:'Saldo em contas', valor:brl0(saldo), sub: contas().length + ' conta(s)', selo:['dado completo', 'ok']}) +
      card({rot:'Entradas · 30 dias', valor:brl0(ent), sub: m30.length + ' lançamento(s) de caixa', selo:['lançamentos carregados', 'est']}) +
      card({rot:'Saídas · 30 dias', valor:brl0(sai), sub:'resultado do período ' + brl0(ent - sai)}) +
      card({rot:'Dias de caixa', valor: diasCaixa === null ? '—' : num(diasCaixa, 0), tom: diasCaixa !== null && diasCaixa < 15 ? 'alerta' : '', selo:['estimativa', 'est'], sub:'saldo ÷ pagamentos médios por dia do mês'}) + '</div>' +
      (ins.length ? sec('O que os números dizem') + '<ul class="v2-ins">' + ins.map(function(i){ return '<li class="' + i[0] + '">' + i[1] + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="v2-cols" style="margin-top:18px;"><div class="v2-box"><h3>Fluxo projetado acumulado</h3><div style="height:230px;"><canvas id="v2GFlux" role="img" aria-label="Fluxo de caixa projetado"></canvas></div></div>' +
      '<div class="v2-box"><h3>Saldo por conta</h3>' + (contas().length ? '<table class="v2-t"><tbody>' + contas().map(function(c){ return '<tr><td>' + esc(c.conta) + '</td><td class="n" style="' + (c.saldo < 0 ? 'color:var(--red);' : '') + '">' + brl(c.saldo) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="s" style="font-size:12.5px;color:var(--ink-faint);">Nenhuma conta cadastrada.</div>') +
      '<h3 style="margin-top:14px;">Entradas líquidas por forma · 30 dias</h3><table class="v2-t"><tbody>' + Object.keys(porForma).sort(function(a, b){ return porForma[b] - porForma[a]; }).map(function(f){ return '<tr><td>' + esc(f) + '</td><td class="n">' + brl(porForma[f]) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      calc('Saldo = soma dos saldos por conta (saldo inicial + movimentos). Entradas/saídas = lançamentos de caixa carregados nos últimos 30 dias (o portal carrega os lançamentos mais recentes; períodos muito movimentados podem não estar completos). Fluxo projetado = saldo atual + (a receber − a pagar) mês a mês, conforme os títulos lançados — não inclui vendas futuras à vista.') + '</div>';
    U.grafico('v2GFlux', {type:'line', data:{labels:flux.map(function(m){ return m.mes; }), datasets:[{data:acum, borderColor:CORES.vinho, backgroundColor:'rgba(90,33,50,.12)', fill:true, tension:.3, pointRadius:3, pointBackgroundColor:acum.map(function(v){ return v < 0 ? CORES.verm : CORES.vinho; })}]},
      options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return brl(c.parsed.y); }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
  };

  /* ================= CONTAS ================= */
  P['contas.resumo'] = function(alvo){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var pg = pagar().filter(function(x){ return aberto(x, 'pagar') > 0; }), rc = receber().filter(function(x){ return aberto(x, 'receber') > 0; });
    var venc = pg.filter(function(x){ return diasAte(x.vencimento) < 0; }), pg30 = pg.filter(function(x){ var d = diasAte(x.vencimento); return d >= 0 && d <= 30; });
    var rcAtr = rc.filter(function(x){ return diasAte(x.vencimento) < 0; }), rc30 = rc.filter(function(x){ var d = diasAte(x.vencimento); return d >= 0 && d <= 30; });
    var tV = soma(venc, function(x){ return aberto(x, 'pagar'); }), tP = soma(pg30, function(x){ return aberto(x, 'pagar'); }), tR = soma(rc30, function(x){ return aberto(x, 'receber'); }), tRA = soma(rcAtr, function(x){ return aberto(x, 'receber'); });
    var porCred = {}; pg.forEach(function(x){ var k = x.credor || 'Fornecedor não informado'; porCred[k] = (porCred[k] || 0) + aberto(x, 'pagar'); });
    var topC = Object.keys(porCred).sort(function(a, b){ return porCred[b] - porCred[a]; }).slice(0, 6), totAb = soma(Object.keys(porCred), function(k){ return porCred[k]; });
    var aging = (typeof computeAging === 'function') ? computeAging() : {};
    var ins = [];
    if (tV > 0) { var ag = aging['90+'] || 0; ins.push(['alerta', '<strong>' + brl0(tV) + '</strong> em ' + venc.length + ' título(s) vencido(s)' + (ag > 0 ? ', sendo ' + brl0(ag) + ' com mais de 90 dias de atraso' : '') + '. Atraso longo costuma custar juros/multa e fecha crédito de fornecedor.']); }
    if (tR - tP - tV < 0) ins.push(['alerta', 'Nos próximos 30 dias, o a receber (' + brl0(tR) + ') <strong>não cobre</strong> o a pagar + vencidos (' + brl0(tP + tV) + '): descasamento de ' + brl0(tP + tV - tR) + ' a cobrir com saldo ou renegociação.']);
    if (topC.length && totAb > 0 && porCred[topC[0]] / totAb >= 0.3) ins.push(['', '<strong>' + esc(topC[0]) + '</strong> concentra ' + pc(porCred[topC[0]] / totAb * 100, 0) + ' do que a empresa deve em aberto. Dependência alta: vale negociar prazo/limite com esse fornecedor.']);
    if (tRA > 0) ins.push(['alerta', 'Há ' + brl0(tRA) + ' em recebimentos atrasados (' + rcAtr.length + ' título(s)).']);
    alvo.innerHTML = '<div class="v2-pag">' + cab('Contas', 'O que a empresa deve e o que tem a receber — vencidos, próximos 30 dias e concentração por fornecedor.') +
      '<div class="v2-grid">' + card({rot:'Vencidos a pagar', valor:brl0(tV), tom: tV > 0 ? 'alerta' : 'bom', sub: venc.length + ' título(s)'}) +
      card({rot:'A pagar · 30 dias', valor:brl0(tP), sub: pg30.length + ' título(s)'}) +
      card({rot:'A receber · 30 dias', valor:brl0(tR), sub: rc30.length + ' título(s)'}) +
      card({rot:'Recebimentos em atraso', valor:brl0(tRA), tom: tRA > 0 ? 'alerta' : '', sub: rcAtr.length + ' título(s)'}) +
      card({rot:'Resultado 30 dias', valor:brl0(tR - tP), tom: (tR - tP) < 0 ? 'alerta' : 'bom', sub:'a receber − a pagar (sem vencidos)', selo:['estimativa', 'est']}) + '</div>' +
      (ins.length ? sec('O que os números dizem') + '<ul class="v2-ins">' + ins.map(function(i){ return '<li class="' + i[0] + '">' + i[1] + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="v2-cols" style="margin-top:18px;"><div class="v2-box"><h3>Vencidos por faixa de atraso</h3><div style="height:220px;"><canvas id="v2GAging" role="img" aria-label="Vencidos por faixa de atraso"></canvas></div></div>' +
      '<div class="v2-box"><h3>Quem a empresa mais deve (em aberto)</h3><table class="v2-t"><tbody>' + topC.map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="n">' + brl0(porCred[k]) + '</td><td style="width:80px;">' + U.bar(totAb ? porCred[k] / totAb * 100 : 0) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      calc('Valores = saldo em aberto (valor original − pago). Vencido = vencimento anterior a hoje. 30 dias = vencimento de hoje até hoje+30. ' + JANELA) + '</div>';
    U.grafico('v2GAging', {type:'bar', data:{labels:Object.keys(aging).map(function(k){ return k + ' dias'; }), datasets:[{data:Object.keys(aging).map(function(k){ return aging[k]; }), backgroundColor:['#D8B4BD', '#B07A89', '#7C3A4E', '#C1554B'], borderRadius:3}]},
      options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return brl(c.parsed.y); }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
  };

  /* ================= RESULTADO ================= */
  P['resultado.resumo'] = function(alvo, ctx){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var off = U.admin();
    var estado = {periodo:'mes'};
    function desenhar(){
      var ym = mesAtual(), ymA = mesDelta(ym, -1);
      var pgMes = pagar().filter(function(x){ return mesDe(x.vencimento) === ym; }), pgAnt = pagar().filter(function(x){ return mesDe(x.vencimento) === ymA; });
      function grp(l, g){ return soma(l.filter(function(x){ return g.indexOf(x.grupo_dre) !== -1; }), function(x){ return x.valor_original; }); }
      var cmv = grp(pgMes, ['CMV', 'Despesas Variáveis']), fix = grp(pgMes, ['Despesas Fixas']), fin = grp(pgMes, ['Despesas Financeiras']), semG = soma(pgMes.filter(function(x){ return !x.grupo_dre; }), function(x){ return x.valor_original; });
      var cmvA = grp(pgAnt, ['CMV', 'Despesas Variáveis']), fixA = grp(pgAnt, ['Despesas Fixas']), finA = grp(pgAnt, ['Despesas Financeiras']);
      alvo.innerHTML = '<div class="v2-pag">' + cab('Resultado', off ? 'Vendas do PDV contra despesas do mês, e a leitura de saúde da empresa.' : 'Quanto a empresa vende e quanto consome por tipo de despesa neste mês.') +
        '<div id="v2ResPdv"><div class="v2-load">Carregando vendas…</div></div>' +
        sec('Despesas lançadas no mês (por vencimento)') +
        '<div class="v2-grid">' +
        card({rot:'Compras e custos variáveis', valor:brl0(cmv), delta: cmvA ? delta(varPct(cmv, cmvA), true) : '', sub:'CMV e despesas variáveis · mês anterior ' + brl0(cmvA)}) +
        card({rot:'Despesas fixas', valor:brl0(fix), delta: fixA ? delta(varPct(fix, fixA), true) : '', sub:'mês anterior ' + brl0(fixA)}) +
        card({rot:'Despesas financeiras', valor:brl0(fin), delta: finA ? delta(varPct(fin, finA), true) : '', sub:'juros, tarifas e encargos lançados · mês anterior ' + brl0(finA)}) +
        (off ? card({rot:'Sem grupo no DRE', valor:brl0(semG), tom: semG > 0 ? 'alerta' : 'bom', sub:'lançamentos ainda não classificados'}) : '') + '</div>' +
        '<div id="v2ResSaude"></div>' + calc('Despesas = soma do valor original dos títulos a pagar com vencimento no mês, agrupados pelo grupo do DRE da categoria (regime de vencimento). ' + JANELA) + '</div>';
      var mi = ym + '-01', mf = U.hoje();
      Promise.all([vendasPeriodo(mi, mf), vendasPeriodo(U.iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 2, 1)), U.iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 0)))]).then(function(r){
        if (!ctx.vivo()) return;
        var el = alvo.querySelector('#v2ResPdv'); if (!el) return;
        if (!r[0]){ el.innerHTML = '<div class="v2-vazio" style="text-align:left;">As vendas do PDV aparecem aqui quando a análise do PDV estiver ativa. As despesas abaixo já estão completas.</div>'; return; }
        var vd = r[0].totais.valor, vdA = r[1] ? r[1].totais.valor : null, desp = cmv + fix + fin;
        var htmlV = '<div class="v2-grid">' + card({rot:'Vendas do mês (PDV)', valor:brl0(vd), sub:'até ' + U.dbr(mf) + ' · ' + r[0].totais.dias_com_venda + ' dia(s) com venda', selo:['dado completo', 'ok']}) +
          card({rot:'Despesas lançadas ÷ vendas', valor: vd ? pc(desp / vd * 100, 0) : '—', sub:'compras + fixas + financeiras sobre as vendas até hoje', selo:['estimativa', 'est']});
        if (off) htmlV += card({rot:'Resultado estimado do mês', valor:brl0(vd - desp), tom: (vd - desp) < 0 ? 'alerta' : 'bom', selo:['estimativa', 'est'], sub:'vendas do PDV − despesas lançadas no mês'});
        if (vdA) htmlV += card({rot:'Vendas · mês passado', valor:brl0(vdA), sub: r[1].totais.dias_com_venda + ' dia(s) com venda'});
        el.innerHTML = htmlV + '</div>' + (off ? '<p class="v2-sub" style="margin-top:-8px;font-size:12px;">Atenção: “resultado estimado” compara vendas até hoje com despesas do mês inteiro (inclusive as que ainda vão vencer) e não inclui estoque. Use como termômetro, não como lucro contábil.</p>' : '');
      });
      if (off && typeof calcularSaudeEmpresa === 'function'){
        var sa = alvo.querySelector('#v2ResSaude');
        sa.innerHTML = sec('Saúde da empresa · só escritório') + '<div class="v2-load">Calculando…</div>';
        calcularSaudeEmpresa(estado.periodo).then(function(c){
          if (!ctx.vivo()) return;
          var st = statusSaudeEmpresa(c), tom = st.cor === 'verde' ? 'bom' : st.cor === 'vermelho' ? 'alerta' : 'ouro';
          sa.innerHTML = sec('Saúde da empresa · só escritório') +
            '<div class="v2-barra"><label>Período<select id="v2SaPer"><option value="mes">Este mês</option><option value="trimestre">Trimestre</option><option value="ano">12 meses</option></select></label></div>' +
            '<div class="v2-grid">' + card({rot:'Leitura', valor:esc(st.label), tom:tom, sub:esc(st.frase)}) +
            card({rot:'Receita (contas a receber)', valor:brl0(c.receitaBruta), selo:['parcial', 'parc'], sub:'não inclui vendas à vista do PDV'}) +
            card({rot:'Margem de contribuição', valor:pc(c.margemPct, 0), sub:brl0(c.margem)}) +
            card({rot:'Ponto de equilíbrio', valor: c.pontoEquilibrio === null ? '—' : brl0(c.pontoEquilibrio), sub: c.margemSegurancaPct === null ? '' : 'margem de segurança ' + pc(c.margemSegurancaPct, 0)}) +
            card({rot:'Lucro líquido (DRE)', valor:brl0(c.lucroLiquido), tom: c.lucroLiquido < 0 ? 'alerta' : '', selo:['parcial', 'parc']}) + '</div>' +
            (st.pendencias && st.pendencias.length ? '<ul class="v2-ins">' + st.pendencias.map(function(p){ return '<li>Para fechar o retrato: ' + esc(p) + '.</li>'; }).join('') + '</ul>' : '') +
            calc('Mesma conta da faixa “Saúde da empresa” do portal. A receita usa os títulos a receber lançados: vendas à vista do PDV não entram, então receita, margem e lucro desta caixa podem estar <strong>subestimados</strong> para uma casa de carnes. Por isso ela vem rotulada como parcial; a leitura de vendas do PDV acima é a mais completa.');
          var s = sa.querySelector('#v2SaPer'); s.value = estado.periodo; s.addEventListener('change', function(){ estado.periodo = s.value; desenhar(); });
        }).catch(function(){ if (ctx.vivo()) sa.innerHTML = ''; });
      }
    }
    desenhar();
  };

  P['resultado.despesas'] = function(alvo){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var ym = mesAtual();
    function desenhar(mes){
      var ant = mesDelta(mes, -1);
      function por(m){ var o = {}; pagar().filter(function(x){ return mesDe(x.vencimento) === m; }).forEach(function(x){ var k = x.categoria || '(sem categoria)'; o[k] = (o[k] || 0) + x.valor_original; }); return o; }
      var a = por(mes), b = por(ant), ks = Object.keys(a).sort(function(x, y){ return a[y] - a[x]; }), tot = soma(ks, function(k){ return a[k]; });
      var meses = []; for (var i = 5; i >= 0; i--) meses.push(mesDelta(ym, -i));
      alvo.innerHTML = '<div class="v2-pag">' + cab('Despesas por categoria', 'Para onde vai o dinheiro, mês a mês, e o que mudou em relação ao mês anterior.') +
        '<div class="v2-barra"><label>Mês<select id="v2DespMes">' + meses.map(function(m){ return '<option value="' + m + '"' + (m === mes ? ' selected' : '') + '>' + rotMes(m) + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="v2-grid">' + card({rot:'Total no mês', valor:brl0(tot), delta: soma(Object.keys(b), function(k){ return b[k]; }) ? delta(varPct(tot, soma(Object.keys(b), function(k){ return b[k]; })), true) : '', sub: ks.length + ' categoria(s)'}) + '</div>' +
        '<div class="v2-box"><div class="v2-tab-wrap"><table class="v2-t"><thead><tr><th>Categoria</th><th class="n">' + rotMes(mes) + '</th><th style="min-width:90px;">% do total</th><th class="n">' + rotMes(ant) + '</th><th class="n">Variação</th></tr></thead><tbody>' +
        ks.map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="n">' + brl0(a[k]) + '</td><td>' + U.bar(tot ? a[k] / tot * 100 : 0) + '</td><td class="n">' + (b[k] ? brl0(b[k]) : '—') + '</td><td class="n">' + (b[k] ? delta(varPct(a[k], b[k]), true) : '<span class="v2-eq">novo</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
        calc('Soma do valor original dos títulos a pagar por categoria, pelo mês de vencimento. ' + JANELA + ' Meses mais antigos que a janela podem estar incompletos.') + '</div>';
      alvo.querySelector('#v2DespMes').addEventListener('change', function(e){ desenhar(e.target.value); });
    }
    desenhar(ym);
  };

  /* ================= DÍVIDAS E CONTRATOS ================= */
  P['dividas.resumo'] = function(alvo, ctx){
    alvo.innerHTML = '<div class="v2-pag">' + cab('Dívidas e contratos', 'Quanto custa o dinheiro tomado, quanto compromete por mês e quais contratos pedem ação.') + '<div class="v2-load">Carregando…</div></div>';
    var mesRef = mesAtual();
    Promise.all([
      apiFetch('/api/financiamentos/resumo?mes=' + mesRef).catch(function(){ return null; }),
      apiFetch('/api/contratos').catch(function(){ return null; }),
      apiFetch('/api/contratos-prestadores').catch(function(){ return null; })
    ]).then(function(r){
      if (!ctx.vivo()) return;
      var fin = r[0], ct = r[1] || [], pr = r[2] || [];
      var f = fin && fin.financiamentos ? fin.financiamentos : null, jm = fin && fin.jurosMoratorios ? fin.jurosMoratorios : null;
      var ativos = ct.filter(function(c){ var tot = c.num_parcelas_total ? Number(c.num_parcelas_total) : (Number(c.parcelas_lancadas) || 0); var pg = Number(c.parcelas_pagas || 0) + Number(c.parcelas_pagas_anteriores || 0); return !tot || pg < tot; });
      var comp = soma(ativos, function(c){ return c.valor_parcela; });
      var venc30 = pr.filter(function(c){ return c.status === 'Ativo' && c.dias_para_vencer !== null && c.dias_para_vencer !== undefined && c.dias_para_vencer <= 30; });
      var vencidos = venc30.filter(function(c){ return c.dias_para_vencer < 0; });
      var serie = (fin && fin.serieMensal) || [];
      var ins = [];
      if (vencidos.length) ins.push(['alerta', '<strong>' + vencidos.length + ' contrato(s) de prestador vencido(s)</strong>: ' + vencidos.slice(0, 3).map(function(c){ return esc(c.fornecedor_nome || 'prestador'); }).join(', ') + '. Renovar ou encerrar formalmente evita cobrança indevida.']);
      var prox = venc30.length - vencidos.length; if (prox > 0) ins.push(['', prox + ' contrato(s) de prestador vencem em até 30 dias — hora de renegociar preço e prazo.']);
      if (f && f.mesAnterior != null && f.mesAtual > f.mesAnterior * 1.1 && f.mesAnterior > 0) ins.push(['alerta', 'As despesas com financiamentos subiram ' + pc((f.mesAtual / f.mesAnterior - 1) * 100, 0) + ' sobre o mês anterior.']);
      if (jm && jm.mesAtual > 0) ins.push(['alerta', 'Juros moratórios pagos no mês: <strong>' + brl(jm.mesAtual) + '</strong> — é dinheiro perdido por atraso; vale priorizar esses pagamentos.']);
      alvo.innerHTML = '<div class="v2-pag">' + cab('Dívidas e contratos', 'Quanto custa o dinheiro tomado, quanto compromete por mês e quais contratos pedem ação.') +
        '<div class="v2-grid">' +
        card({rot:'Custo financeiro no mês', valor: f ? brl0(f.mesAtual) : '—', delta: f && f.mesAnterior ? delta(varPct(f.mesAtual, f.mesAnterior), true) : '', sub:'financiamentos · mês anterior ' + (f && f.mesAnterior != null ? brl0(f.mesAnterior) : '—')}) +
        card({rot:'Juros moratórios no mês', valor: jm ? brl0(jm.mesAtual) : '—', tom: jm && jm.mesAtual > 0 ? 'alerta' : '', sub:'encargos por pagar em atraso'}) +
        card({rot:'Compromisso mensal em parcelas', valor:brl0(comp), selo:['estimativa', 'est'], sub: ativos.length + ' contrato(s) com parcelas a pagar'}) +
        card({rot:'Contratos de prestadores a vencer', valor: String(venc30.length), tom: vencidos.length ? 'alerta' : '', sub: vencidos.length + ' já vencido(s) · próximos 30 dias'}) + '</div>' +
        (ins.length ? sec('O que os números dizem') + '<ul class="v2-ins">' + ins.map(function(i){ return '<li class="' + i[0] + '">' + i[1] + '</li>'; }).join('') + '</ul>' : '') +
        (serie.length ? '<div class="v2-box" style="margin-top:18px;"><h3>Custo financeiro por mês</h3><div style="height:220px;"><canvas id="v2GFin" role="img" aria-label="Custo financeiro mensal"></canvas></div></div>' : '') +
        calc('Custo financeiro e juros moratórios vêm da tela “Despesas financeiras”. Compromisso mensal = soma do valor de parcela dos contratos que ainda têm parcelas a pagar (pagas no portal + pagas antes do cadastro). Prestadores: contratos ativos com vencimento nos próximos 30 dias ou já vencidos.') + '</div>';
      if (serie.length) U.grafico('v2GFin', {type:'bar', data:{labels:serie.map(function(m){ return rotMes(m.mes); }), datasets:[{data:serie.map(function(m){ return m.total; }), backgroundColor:'rgba(90,33,50,.78)', borderRadius:3}]},
        options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return brl(c.parsed.y); }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
    });
  };

  /* ================= COMPRAS E CUSTOS ================= */
  P['compras.resumo'] = function(alvo, ctx){
    if (typeof DATA === 'undefined' || !DATA) return semDados(alvo);
    var ym = mesAtual(), meses = []; for (var i = 5; i >= 0; i--) meses.push(mesDelta(ym, -i));
    var cmv = pagar().filter(function(x){ return x.grupo_dre === 'CMV'; });
    var porMes = {}; cmv.forEach(function(x){ var m = mesDe(x.vencimento); porMes[m] = (porMes[m] || 0) + x.valor_original; });
    var ini90 = U.somaDias(U.hoje(), -89), forn = {};
    cmv.filter(function(x){ var d = d10(x.vencimento); return d >= ini90 && d <= U.hoje(); }).forEach(function(x){ var k = x.credor || 'Fornecedor não informado'; forn[k] = (forn[k] || 0) + x.valor_original; });
    var ks = Object.keys(forn).sort(function(a, b){ return forn[b] - forn[a]; }), tot = soma(ks, function(k){ return forn[k]; });
    var ins = [];
    if (ks.length && tot > 0 && forn[ks[0]] / tot >= 0.3) ins.push(['alerta', '<strong>' + esc(ks[0]) + '</strong> responde por ' + pc(forn[ks[0]] / tot * 100, 0) + ' das compras dos últimos 90 dias. Concentração alta enfraquece a negociação e aumenta o risco de ruptura.']);
    if (ks.length >= 3 && tot > 0) ins.push(['', 'Os 3 maiores fornecedores somam ' + pc(soma(ks.slice(0, 3), function(k){ return forn[k]; }) / tot * 100, 0) + ' das compras (' + brl0(tot) + ' em 90 dias).']);
    alvo.innerHTML = '<div class="v2-pag">' + cab('Compras e custos', 'Quanto a empresa compra (CMV), de quem, e como isso pesa nas vendas.') +
      '<div id="v2CompCmv"></div><div class="v2-grid">' + card({rot:'Compras · mês atual', valor:brl0(porMes[ym] || 0), delta: porMes[mesDelta(ym, -1)] ? delta(varPct(porMes[ym] || 0, porMes[mesDelta(ym, -1)]), true) : '', sub:'títulos de CMV com vencimento no mês', selo:['dado parcial', 'est']}) +
      card({rot:'Compras · 90 dias', valor:brl0(tot), sub: ks.length + ' fornecedor(es)'}) + '</div>' +
      (ins.length ? sec('O que os números dizem') + '<ul class="v2-ins">' + ins.map(function(i){ return '<li class="' + i[0] + '">' + i[1] + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="v2-cols" style="margin-top:18px;"><div class="v2-box"><h3>Compras por mês</h3><div style="height:220px;"><canvas id="v2GCmv" role="img" aria-label="Compras por mês"></canvas></div></div>' +
      '<div class="v2-box"><h3>Fornecedores · 90 dias</h3>' + (ks.length ? '<table class="v2-t"><tbody>' + ks.slice(0, 8).map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="n">' + brl0(forn[k]) + '</td><td style="width:80px;">' + U.bar(tot ? forn[k] / tot * 100 : 0) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="s" style="font-size:12.5px;color:var(--ink-faint);">Sem compras classificadas como CMV no período.</div>') + '</div></div>' +
      calc('Compras = títulos a pagar cujo grupo no DRE é “CMV”, por mês de vencimento (inclui os já pagos). Depende de as categorias estarem com o grupo do DRE preenchido. ' + JANELA + ' Custo por produto e carga tributária estão nas abas ao lado.') + '</div>';
    U.grafico('v2GCmv', {type:'bar', data:{labels:meses.map(rotMes), datasets:[{data:meses.map(function(m){ return porMes[m] || 0; }), backgroundColor:'rgba(90,33,50,.78)', borderRadius:3}]},
      options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return brl(c.parsed.y); }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
    // compras ÷ vendas do mês anterior fechado (se o PDV estiver ativo)
    var mAnt = mesDelta(ym, -1), mi = mAnt + '-01', mf = U.iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 0));
    vendasPeriodo(mi, mf).then(function(v){
      if (!ctx.vivo() || !v || !porMes[mAnt]) return;
      var el = alvo.querySelector('#v2CompCmv');
      if (el) el.innerHTML = '<div class="v2-grid">' + card({rot:'Compras ÷ vendas · ' + rotMes(mAnt), valor: pc(porMes[mAnt] / v.totais.valor * 100, 0), selo:['estimativa', 'est'], sub:'compras (CMV por vencimento) sobre as vendas do PDV do mês fechado'}) + '</div>';
    });
  };

  /* ================= PESSOAS ================= */
  P['pessoas.resumo'] = function(alvo, ctx){
    alvo.innerHTML = '<div class="v2-pag">' + cab('Pessoas', 'Equipe, custo mensal e alertas de prazo.') + '<div class="v2-load">Carregando…</div></div>';
    apiFetch('/api/funcionarios').then(function(l){
      if (!ctx.vivo()) return;
      l = l || [];
      var folha = soma(l, function(f){ return f.salario; }), enc = soma(l, function(f){ return Number(f.vale_transporte || 0) + Number(f.vale_alimentacao || 0) + Number(f.inss || 0) + Number(f.fgts || 0); });
      var alertas = []; l.forEach(function(f){ (typeof alertasFuncionario === 'function' ? alertasFuncionario(f) : []).forEach(function(a){ alertas.push(esc(f.nome) + ': ' + esc(a)); }); });
      alvo.innerHTML = '<div class="v2-pag">' + cab('Pessoas', 'Equipe, custo mensal e alertas de prazo.') +
        '<div id="v2PesVendas"></div><div class="v2-grid">' + card({rot:'Funcionários', valor:String(l.length), sub:'cadastrados'}) +
        card({rot:'Salários', valor:brl0(folha), sub:'soma dos salários cadastrados'}) +
        card({rot:'Benefícios e encargos', valor:brl0(enc), selo:['conforme cadastro', 'est'], sub:'VT + VA + INSS + FGTS informados'}) +
        card({rot:'Custo mensal da equipe', valor:brl0(folha + enc), selo:['estimativa', 'est'], sub:'salários + benefícios e encargos'}) + '</div>' +
        (alertas.length ? sec('Alertas') + '<ul class="v2-ins">' + alertas.map(function(a){ return '<li class="alerta">' + a + '</li>'; }).join('') + '</ul>' : '<ul class="v2-ins"><li class="bom">Nenhum alerta de férias ou experiência no momento.</li></ul>') +
        calc('Somas dos valores cadastrados em cada funcionário (não inclui 13º, férias provisionadas nem encargos não informados). Alertas: período aquisitivo de férias vencido ou vencendo em até 60 dias; funcionários nos primeiros 90 dias (experiência).') + '</div>';
      var ym = mesAtual();
      vendasPeriodo(ym + '-01', U.hoje()).then(function(v){
        if (!ctx.vivo() || !v || !v.totais.valor) return;
        var el = alvo.querySelector('#v2PesVendas'); if (el) el.innerHTML = '<div class="v2-grid">' + card({rot:'Equipe ÷ vendas do mês', valor: pc((folha + enc) / v.totais.valor * 100, 0), selo:['estimativa', 'est'], sub:'custo mensal da equipe sobre as vendas até hoje (referência comum no varejo: acompanhe a tendência)'}) + '</div>';
      });
    }).catch(function(){ if (ctx.vivo()) alvo.innerHTML = '<div class="v2-pag">' + cab('Pessoas', '') + '<div class="v2-vazio">Não consegui carregar os funcionários agora.</div></div>'; });
  };

  /* ================= CADASTROS ================= */
  P['cadastros.resumo'] = function(alvo, ctx){
    function desenhar(){
      var c = (typeof CADASTROS !== 'undefined' && CADASTROS) || {};
      var semGrupo = pagar().filter(function(x){ return !x.grupo_dre; }), semCat = pagar().filter(function(x){ return !x.categoria; });
      alvo.innerHTML = '<div class="v2-pag">' + cab('Cadastros', 'Base de fornecedores, clientes, produtos e categorias — e o que falta organizar para os números ficarem confiáveis.') +
        '<div class="v2-grid">' + card({rot:'Fornecedores', valor:String((c.fornecedores || []).length)}) + card({rot:'Clientes (sacados)', valor:String((c.sacados || []).length)}) +
        card({rot:'Produtos', valor:String((c.produtos || []).length)}) + card({rot:'Categorias de despesa', valor:String((c.categoriasDespesa || []).length)}) + card({rot:'Contas bancárias', valor:String((c.contasBancarias || []).length)}) + '</div>' +
        sec('Qualidade dos dados') + '<ul class="v2-ins">' +
        '<li class="' + (semGrupo.length ? 'alerta' : 'bom') + '">' + (semGrupo.length ? '<strong>' + semGrupo.length + ' título(s) a pagar</strong> sem grupo no DRE (' + brl0(soma(semGrupo, function(x){ return x.valor_original; })) + '): ajuste o grupo da categoria em Cadastros para o DRE e a Saúde da empresa ficarem completos.' : 'Todos os títulos carregados têm grupo no DRE.') + '</li>' +
        '<li class="' + (semCat.length ? 'alerta' : 'bom') + '">' + (semCat.length ? '<strong>' + semCat.length + ' título(s)</strong> sem categoria.' : 'Todos os títulos carregados têm categoria.') + '</li></ul>' +
        calc('Contagens dos cadastros carregados no portal. Qualidade dos dados olha os títulos a pagar carregados (' + JANELA.replace('Base: ', '').replace(/\.$/, '') + ').') + '</div>';
    }
    desenhar();
    if (typeof carregarCadastros === 'function') carregarCadastros().then(function(){ if (ctx.vivo()) desenhar(); }).catch(function(){});
  };
})();
