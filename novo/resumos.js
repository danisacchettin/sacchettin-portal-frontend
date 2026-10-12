/* Nova versão — base dos resumos com BI + páginas de VENDAS (análise profunda dos itens do PDV).
   Só existe em /novo. Somente leitura: nada aqui grava nem altera lançamento.
   Os números de vendas vêm de /api/pdv-bi/* (tabelas-resumo no banco), nunca dos itens crus: por isso não pesa.
   Se a rota ainda não existir (backend não atualizado) ou a carga inicial não tiver sido feita, a página avisa e
   oferece a tela atual do PDV — nada quebra. */
(function(){
  'use strict';
  var R = window.DSSJ_R = window.DSSJ_R || {};
  R.paginas = R.paginas || {};

  /* ---------------- utilitários ---------------- */
  function esc(s){ s = (s === null || s === undefined) ? '' : String(s); return s.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function brl(v){ return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
  function brl0(v){ return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0}); }
  function num(v, c){ return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', {minimumFractionDigits:c||0, maximumFractionDigits:c||0}); }
  function pc(v, c){ return (v === null || v === undefined || isNaN(v)) ? '—' : num(v, c === undefined ? 1 : c) + '%'; }
  function iso(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function hoje(){ return iso(new Date()); }               // data LOCAL (não UTC): evita o dia errado à noite
  function pdata(s){ var p = String(s).slice(0,10).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function somaDias(s, n){ var d = pdata(s); d.setDate(d.getDate()+n); return iso(d); }
  function dbr(s){ var p = String(s).slice(0,10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function dm(s){ return String(s).slice(8,10) + '/' + String(s).slice(5,7); }
  var DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  var DIAS3 = ['dom','seg','ter','qua','qui','sex','sáb'];
  function soma(a, f){ var t = 0; for (var i = 0; i < a.length; i++) t += Number(f ? f(a[i]) : a[i]) || 0; return t; }
  function varPct(a, b){ return (!b || a === null || a === undefined) ? null : (a - b) / b * 100; }
  // seta de variação; "inverso" = subir é ruim (despesa)
  function delta(p, inverso){
    if (p === null || p === undefined || !isFinite(p)) return '';
    var sobe = p > 0.5, desce = p < -0.5;
    var bom = inverso ? desce : sobe, ruim = inverso ? sobe : desce;
    return '<span class="' + (bom ? 'v2-up' : ruim ? 'v2-down' : 'v2-eq') + '" title="variação sobre o período anterior de mesmo tamanho">' + (sobe ? '▲' : desce ? '▼' : '≈') + ' ' + num(Math.abs(p), 1) + '%</span>';
  }
  function card(o){
    return '<div class="v2-card ' + (o.tom || '') + '"><div class="l">' + esc(o.rot) + (o.selo ? ' ' + selo(o.selo[0], o.selo[1]) : '') + '</div>' +
      '<div class="v">' + o.valor + (o.delta ? ' <span style="font-size:12px; font-weight:600;">' + o.delta + '</span>' : '') + '</div>' +
      (o.sub ? '<div class="s">' + o.sub + '</div>' : '') + '</div>';
  }
  function selo(txt, tipo){ return '<span class="v2-selo ' + (tipo || '') + '">' + esc(txt) + '</span>'; }
  function calc(txt){ return '<details class="v2-calc"><summary>Como é calculado</summary><div>' + txt + '</div></details>'; }
  function sec(t){ return '<div class="v2-sec">' + esc(t) + '</div>'; }
  function bar(p, cor){ return '<div class="v2-bar" role="img" aria-label="' + num(p, 0) + '%"><i style="width:' + Math.max(0, Math.min(100, p)) + '%;' + (cor ? 'background:' + cor : '') + '"></i></div>'; }
  function admin(){ try{ return typeof podeVerSaudeEmpresa === 'function' && podeVerSaudeEmpresa(); }catch(e){ return false; } }
  function escritorio(){ try{ return !!(typeof USUARIO !== 'undefined' && USUARIO && USUARIO.papel === 'escritorio'); }catch(e){ return false; } }

  var CORES = {vinho:'#5A2132', ouro:'#9C7A3D', rosa:'#B07A89', verde:'#1F6B47', verm:'#C1554B', cinza:'#8E8183'};
  var graficos = [];
  function limparGraficos(){ graficos.forEach(function(g){ try{ g.destroy(); }catch(e){} }); graficos = []; }
  function grafico(canvasId, cfg){
    var el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    cfg.options = cfg.options || {}; cfg.options.maintainAspectRatio = false;
    cfg.options.animation = false;
    var g = new Chart(el, cfg); graficos.push(g); return g;
  }
  var EIXO_MIL = {ticks:{color:'rgba(36,20,23,.65)', font:{size:10}, maxTicksLimit:6, callback:function(x){ return x >= 1000 ? 'R$ ' + num(x / 1000, x % 1000 ? 1 : 0) + ' mil' : 'R$ ' + num(x, 0); }}, grid:{color:'rgba(36,20,23,.07)'}};
  var EIXO = {ticks:{color:'rgba(36,20,23,.65)', font:{size:10}}, grid:{color:'rgba(36,20,23,.07)'}};

  /* ---------------- chamada à API com cache curto (não repete a mesma consulta) ---------------- */
  var cache = {}; var TTL = 3 * 60e3;
  function chave(p){ var t = ''; try{ t = (typeof authToken === 'string' && authToken) ? authToken.slice(-10) : ''; }catch(e){} return t + '|' + p; }
  function api(path, opt){
    opt = opt || {};
    var k = chave(path), c = cache[k];
    if (!opt.fresco && c && Date.now() - c.t < TTL) return c.p;
    var p = apiFetch(path);
    cache[k] = {t: Date.now(), p: p};
    p.catch(function(){ delete cache[k]; });
    return p;
  }
  R.api = api; R.limparCache = function(){ cache = {}; };

  /* ---------------- estado do período (compartilhado entre as abas de Vendas) ---------------- */
  var PRESETS = [['7','Últimos 7 dias'], ['30','Últimos 30 dias'], ['mes','Este mês'], ['mes_passado','Mês passado'], ['90','Últimos 90 dias'], ['365','Últimos 12 meses'], ['livre','Personalizado']];
  var per = {preset:'mes', de:'', ate:''};
  function aplicarPreset(p){
    var h = new Date(), ini = new Date(h), fim = new Date(h);
    if (p === '7') ini.setDate(h.getDate() - 6);
    else if (p === '30') ini.setDate(h.getDate() - 29);
    else if (p === '90') ini.setDate(h.getDate() - 89);
    else if (p === '365') ini.setDate(h.getDate() - 364);
    else if (p === 'mes') ini = new Date(h.getFullYear(), h.getMonth(), 1);
    else if (p === 'mes_passado'){ ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); fim = new Date(h.getFullYear(), h.getMonth(), 0); }
    else if (p === 'livre'){ per.preset = 'livre'; if (!per.de){ per.de = iso(ini); per.ate = iso(fim); } return; }
    per = {preset: p, de: iso(ini), ate: iso(fim)};
  }
  aplicarPreset('mes');
  function qs(){ var ate = per.ate > hoje() ? hoje() : per.ate; return 'de=' + per.de + '&ate=' + ate; }
  function barraPeriodo(onChange){
    return '<div class="v2-barra"><label>Período<select id="v2Preset">' + PRESETS.map(function(p){ return '<option value="' + p[0] + '"' + (per.preset === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label>' +
      '<span id="v2Livre" style="display:' + (per.preset === 'livre' ? 'flex' : 'none') + '; gap:8px; align-items:end;"><label>De<input type="date" id="v2De" value="' + per.de + '"></label><label>Até<input type="date" id="v2Ate" value="' + per.ate + '"></label></span>' +
      '<span class="s" style="font-size:11.5px; color:var(--ink-faint);" id="v2PerTxt"></span></div>';
  }
  function ligarPeriodo(alvo, recarregar){
    var s = alvo.querySelector('#v2Preset'); if (!s) return;
    var t = alvo.querySelector('#v2PerTxt'); if (t) t.textContent = dbr(per.de) + ' a ' + dbr(per.ate > hoje() ? hoje() : per.ate);
    s.addEventListener('change', function(){
      aplicarPreset(s.value);
      alvo.querySelector('#v2Livre').style.display = s.value === 'livre' ? 'flex' : 'none';
      if (s.value !== 'livre') recarregar();
    });
    ['v2De','v2Ate'].forEach(function(id){
      var e = alvo.querySelector('#' + id); if (!e) return;
      e.addEventListener('change', function(){
        var de = alvo.querySelector('#v2De').value, ate = alvo.querySelector('#v2Ate').value;
        if (de && ate && de <= ate){ per.de = de; per.ate = ate; recarregar(); }
      });
    });
  }

  /* ---------------- PDV: disponibilidade da análise profunda ---------------- */
  function semBI(alvo, motivo){
    alvo.innerHTML =
      '<div class="v2-vazio"><strong>' + esc(motivo || 'A análise profunda do PDV ainda não está ativa.') + '</strong><br>' +
      'Enquanto isso, as telas atuais do PDV continuam funcionando normalmente.<br><br>' +
      '<button type="button" class="v2-btn" id="v2AbrirPdv">Abrir o PDV atual</button>' +
      (escritorio() ? '<div style="margin-top:12px; font-size:12px; color:var(--ink-faint);">Escritório: aplicar a migração 027 no banco, publicar o backend (rota /api/pdv-bi) e rodar a carga inicial — passo a passo em APLICAR-server.js.diff.txt.</div>' : '') + '</div>';
    var b = alvo.querySelector('#v2AbrirPdv');
    if (b) b.addEventListener('click', function(){ var c = document.getElementById('btnPDV'); if (c) c.click(); });
  }
  var statusPdv = null, statusPdvT = 0;
  function pdvPronto(){
    if (statusPdv && Date.now() - statusPdvT < 120e3) return Promise.resolve(statusPdv);
    return apiFetch('/api/pdv-bi/status').then(function(s){ statusPdv = s; statusPdvT = Date.now(); return s; })
      .catch(function(){ statusPdv = {pronto:false, indisponivel:true}; statusPdvT = Date.now(); return statusPdv; });
  }
  R.pdvPronto = pdvPronto;

  /* Carrega uma rota de pdv-bi para o período atual; devolve null se não estiver pronto. */
  function pdvDados(rota, extra){
    return pdvPronto().then(function(s){
      if (!s.pronto) return null;
      return api('/api/pdv-bi/' + rota + '?' + qs() + (extra || ''));
    }).then(function(d){ return (d && d.pronto === false) ? null : d; });
  }

  /* ---------------- insights (regras explícitas, todas mostradas em "como é calculado") ---------------- */
  function insightsVendas(v){
    var L = [], t = v.totais, a = v.anterior;
    var dv = varPct(t.valor, a.valor);
    if (dv !== null && a.valor > 0 && Math.abs(dv) >= 5){
      L.push([dv > 0 ? 'bom' : 'alerta', 'Vendas ' + (dv > 0 ? 'subiram ' : 'caíram ') + pc(Math.abs(dv)) + ' sobre o período anterior de mesmo tamanho (' + brl0(a.valor) + ' → ' + brl0(t.valor) + ').']);
    }
    var dow = v.dia_da_semana.filter(function(x){ return x.dias >= 2; });
    if (dow.length >= 3){
      var ms = dow.slice().sort(function(x, y){ return y.media - x.media; }), melhor = ms[0], pior = ms[ms.length - 1];
      var mediaGeral = soma(dow, function(x){ return x.valor; }) / (soma(dow, function(x){ return x.dias; }) || 1);
      if (mediaGeral > 0) L.push(['', 'Melhor dia: <strong>' + DIAS[melhor.dow] + '</strong> (média de ' + brl0(melhor.media) + ', ' + pc((melhor.media / mediaGeral - 1) * 100, 0) + ' acima da média). Mais fraco: <strong>' + DIAS[pior.dow] + '</strong> (' + brl0(pior.media) + ').']);
    }
    var porHora = {}; v.hora.forEach(function(h){ porHora[h.hora] = (porHora[h.hora] || 0) + h.valor; });
    var horas = Object.keys(porHora).map(Number).sort(function(a2, b2){ return a2 - b2; });
    var totH = soma(horas, function(h){ return porHora[h]; });
    if (horas.length >= 4 && totH > 0){
      var melhorJ = null;
      for (var i = 0; i + 1 < horas.length; i++){
        if (horas[i + 1] !== horas[i] + 1) continue;
        var s2 = porHora[horas[i]] + porHora[horas[i + 1]];
        if (!melhorJ || s2 > melhorJ.s) melhorJ = {h: horas[i], s: s2};
      }
      if (melhorJ) L.push(['', 'Pico de vendas: das <strong>' + melhorJ.h + 'h às ' + (melhorJ.h + 2) + 'h</strong> concentra ' + pc(melhorJ.s / totH * 100, 0) + ' do faturamento do período — a equipe e o estoque de balcão precisam estar completos nessa janela.']);
    }
    var c = v.concentracao;
    if (c.produtos_distintos) L.push(['', '<strong>' + c.curva_abc.A + ' produtos</strong> (classe A) respondem por 80% do faturamento; os 10 maiores somam ' + pc(c.top10_pct, 0) + '. Esses itens merecem preço, ruptura e fornecedor acompanhados de perto.']);
    if (t.pct_generico >= 3) L.push(['alerta', 'Itens genéricos (sem produto identificado) somam <strong>' + pc(t.pct_generico) + '</strong> das vendas (' + brl0(t.generico) + '). Quanto maior esse número, menos a análise por produto e por margem é confiável: vale cadastrar os itens que mais saem como genérico.']);
    if (t.cobertura_custo_pct !== undefined && t.cobertura_custo_pct !== null && t.cobertura_custo_pct < 90) L.push(['alerta', 'Só <strong>' + pc(t.cobertura_custo_pct, 0) + '</strong> das vendas têm custo cadastrado: a margem mostrada vale para essa parte, não para o total.']);
    if (t.margem_pct !== undefined && a.margem_pct !== undefined && t.margem_pct !== null && a.margem_pct !== null && Math.abs(t.margem_pct - a.margem_pct) >= 1.5){
      var dp = t.margem_pct - a.margem_pct;
      L.push([dp > 0 ? 'bom' : 'alerta', 'Margem sobre o custo cadastrado ' + (dp > 0 ? 'melhorou ' : 'piorou ') + num(Math.abs(dp), 1) + ' pontos (' + pc(a.margem_pct) + ' → ' + pc(t.margem_pct) + ').']);
    }
    return L;
  }

  /* Direcionamento (só escritório): o que olhar primeiro. Regras simples e visíveis. */
  function direcionamento(v, cmp){
    if (v.totais.custo === undefined) return '';
    var L = [], mg = v.totais.margem_pct;
    if (mg !== null && mg !== undefined){
      v.grupos.filter(function(g){ return g.margem_pct !== null && g.margem_pct !== undefined && g.participacao_pct >= 5 && g.margem_pct < mg - 8; }).slice(0, 2).forEach(function(g){
        L.push('Grupo <strong>' + esc(g.grupo) + '</strong> pesa ' + pc(g.participacao_pct, 0) + ' das vendas com margem de ' + pc(g.margem_pct) + ', ' + num(mg - g.margem_pct, 0) + ' pontos abaixo da média (' + pc(mg) + '): revisar preço de venda e custo de compra.');
      });
      v.produtos.filter(function(p){ return p.classe === 'A' && p.margem_pct !== null && p.margem_pct !== undefined && p.margem_pct < mg - 10; }).slice(0, 2).forEach(function(p){
        L.push('Produto de classe A <strong>' + esc(p.descricao) + '</strong> com margem de ' + pc(p.margem_pct) + ' (média ' + pc(mg) + '): é onde um ajuste de preço mais rende.');
      });
    }
    if (cmp && cmp.caem && cmp.caem.length){
      var q = cmp.caem[0];
      L.push('Maior queda no período: <strong>' + esc(q.descricao) + '</strong> (' + brl0(q.anterior) + ' → ' + brl0(q.atual) + '). Conferir ruptura, preço ou mudança de hábito do cliente.');
    }
    if (v.totais.pct_generico >= 3) L.push('Cadastrar os itens vendidos como genérico (' + pc(v.totais.pct_generico) + ' das vendas) para a análise de margem cobrir o negócio todo.');
    if (!L.length) return '';
    return '<div class="v2-dir"><h3>Direcionamento · só escritório</h3><ol>' + L.slice(0, 5).map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol>' +
      calc('Regras: grupo com mais de 5% das vendas e margem 8 pontos abaixo da média; produto classe A com margem 10 pontos abaixo; maior queda de faturamento por produto contra o período anterior de mesmo tamanho; itens genéricos acima de 3%. São pontos de partida para investigar, não conclusões — confira antes de agir.') + '</div>';
  }

  /* ================= VENDAS · RESUMO ================= */
  R.paginas['vendas.resumo'] = function(alvo, ctx){
    function desenhar(){
      alvo.innerHTML = '<div class="v2-pag"><h2>Vendas</h2><p class="v2-sub">Leitura do PDV: o que vendeu, quando, a que preço e com que margem. Os números vêm de tabelas-resumo e abrem rápido mesmo em períodos longos.</p>' +
        barraPeriodo() + '<div id="v2Corpo"><div class="v2-load">Carregando…</div></div></div>';
      ligarPeriodo(alvo, desenhar);
      var corpo = alvo.querySelector('#v2Corpo');
      pdvPronto().then(function(s){
        if (!ctx.vivo()) return;
        if (!s.pronto){ semBI(corpo, s.indisponivel ? 'A análise profunda do PDV depende de uma atualização do servidor que ainda não foi aplicada.' : 'A carga inicial da análise do PDV ainda não foi feita.'); return; }
        return Promise.all([pdvDados('visao'), (escritorio() ? pdvDados('comparativo').catch(function(){ return null; }) : Promise.resolve(null))]).then(function(r){
          if (!ctx.vivo()) return;
          var v = r[0]; if (!v){ semBI(corpo, 'Não consegui carregar a análise agora.'); return; }
          corpo.innerHTML = htmlVendas(v, r[1]);
          limparGraficos(); chartsVendas(v);
          var ver = corpo.querySelector('#v2VerProdutos'); if (ver) ver.addEventListener('click', function(){ if (R.irPara) R.irPara('vendas', 'produtos'); });
        });
      }).catch(function(e){ if (ctx.vivo()) semBI(corpo, 'Erro ao carregar: ' + (e && e.message ? e.message : e)); });
    }
    desenhar();
  };

  function htmlVendas(v, cmp){
    var t = v.totais, a = v.anterior, off = t.custo !== undefined;
    var temAnt = a && a.valor > 0;
    var cards = [
      card({rot:'Vendas', valor:brl0(t.valor), delta: temAnt ? delta(varPct(t.valor, a.valor)) : '', sub:'inclui ' + brl0(t.taxa_entrega) + ' de taxa de entrega · ' + t.dias_com_venda + ' dia(s) com venda'}),
      card({rot:'Ticket médio', valor:brl(t.ticket_medio), delta: temAnt ? delta(varPct(t.ticket_medio, a.ticket_medio)) : '', sub:'por cupom, sem taxa de entrega · ' + num(t.itens_por_cupom, 1) + ' itens por cupom'}),
      card({rot:'Cupons', valor:num(t.cupons), delta: temAnt ? delta(varPct(t.cupons, a.cupons)) : '', sub:'atendimentos no período'}),
      card({rot:'Média por dia', valor:brl0(t.media_por_dia), delta: temAnt ? delta(varPct(t.media_por_dia, a.media_por_dia)) : '', sub:'considera só dias com venda'}),
      card({rot:'Quilos vendidos', valor:num(t.kg, 0) + ' kg', delta: temAnt ? delta(varPct(t.kg, a.kg)) : '', sub:'itens vendidos por peso'})
    ];
    if (off){
      cards.push(card({rot:'Margem sobre custo', valor: t.margem_pct === null ? '—' : pc(t.margem_pct), delta: (a.margem_pct !== undefined && a.margem_pct !== null && t.margem_pct !== null) ? delta(t.margem_pct - a.margem_pct) : '', tom: (t.margem_pct !== null && t.margem_pct < 20) ? 'alerta' : '', selo: [t.cobertura_custo_pct !== null && t.cobertura_custo_pct >= 90 ? 'dado completo' : pc(t.cobertura_custo_pct, 0) + ' com custo', t.cobertura_custo_pct >= 90 ? 'ok' : 'est'], sub:'só escritório · lucro bruto estimado ' + brl0((t.valor_com_custo || 0) - (t.custo || 0))}));
    }
    cards.push(card({rot:'Itens sem identificação', valor:pc(t.pct_generico), tom: t.pct_generico >= 3 ? 'alerta' : '', sub: brl0(t.generico) + ' vendidos como genéricos'}));
    var ins = insightsVendas(v);
    var top = v.produtos.slice(0, 5);
    var h = '<div class="v2-grid">' + cards.join('') + '</div>';
    if (off) h += direcionamento(v, cmp);
    h += '<div class="v2-cols"><div class="v2-box"><h3>Vendas por dia</h3><div style="height:230px;"><canvas id="v2GDia" role="img" aria-label="Vendas por dia"></canvas></div></div>' +
      '<div class="v2-box"><h3>Média por dia da semana</h3><div style="height:230px;"><canvas id="v2GDow" role="img" aria-label="Média de vendas por dia da semana"></canvas></div></div></div>';
    if (ins.length) h += sec('O que os números dizem') + '<ul class="v2-ins">' + ins.map(function(i){ return '<li class="' + i[0] + '">' + i[1] + '</li>'; }).join('') + '</ul>';
    h += sec('Produtos que mais vendem') + '<div class="v2-box"><div class="v2-tab-wrap"><table class="v2-t"><thead><tr><th>Produto</th><th class="n">Vendas</th><th class="n">% do total</th>' + (off ? '<th class="n">Margem</th>' : '') + '<th>Classe</th></tr></thead><tbody>' +
      top.map(function(p){ return '<tr><td>' + esc(p.descricao) + '<div style="font-size:11px;color:var(--ink-faint);">' + esc(p.grupo || '') + '</div></td><td class="n">' + brl0(p.valor) + '</td><td class="n">' + pc(p.participacao_pct) + '</td>' + (off ? '<td class="n">' + (p.margem_pct === null || p.margem_pct === undefined ? '—' : pc(p.margem_pct)) + '</td>' : '') + '<td><span class="v2-abc ' + p.classe + '">' + p.classe + '</span></td></tr>'; }).join('') +
      '</tbody></table></div><div style="margin-top:10px;"><button type="button" class="v2-btn" id="v2VerProdutos">Ver todos os produtos</button></div></div>';
    h += calc('<strong>Vendas</strong> = soma dos itens dos cupons do PDV (inclui taxa de entrega), com a regra do relatório do PDV: por cupom vale o registro TST quando existir, senão o MDB; cupom cancelado fora. <strong>Ticket médio</strong> = vendas sem taxa ÷ cupons. <strong>Variação</strong> compara com o período imediatamente anterior de mesmo número de dias. ' +
      '<strong>Margem</strong> (escritório) = (vendas − custo) ÷ vendas, só sobre itens com custo cadastrado. <strong>Classe A/B/C</strong>: A = produtos que somam os primeiros 80% do faturamento; B até 95%; C o restante. Itens atualizados automaticamente a cada poucos minutos.');
    return h;
  }

  function chartsVendas(v){
    var med = v.dias.map(function(d, i){ var ini = Math.max(0, i - 6), w = v.dias.slice(ini, i + 1); return soma(w, function(x){ return x.valor; }) / w.length; });
    grafico('v2GDia', {type:'bar', data:{labels:v.dias.map(function(d){ return dm(d.data); }), datasets:[
      {type:'bar', label:'Vendas', data:v.dias.map(function(d){ return d.valor; }), backgroundColor:'rgba(90,33,50,.78)', borderRadius:3, order:2},
      {type:'line', label:'Média móvel 7 dias', data:med, borderColor:CORES.ouro, backgroundColor:CORES.ouro, borderWidth:2, pointRadius:0, tension:.3, order:1}]},
      options:{responsive:true, plugins:{legend:{display:true, labels:{boxWidth:10, font:{size:10}}}, tooltip:{callbacks:{label:function(c){ return c.dataset.label + ': ' + brl(c.parsed.y); }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO_MIL}}});
    var porDow = {}; v.dia_da_semana.forEach(function(x){ porDow[x.dow] = x; });
    var mx = Math.max.apply(null, v.dia_da_semana.map(function(x){ return x.media; }).concat([1]));
    grafico('v2GDow', {type:'bar', data:{labels:DIAS3.map(function(d){ return d; }), datasets:[{data:DIAS3.map(function(_, i){ return porDow[i] ? porDow[i].media : 0; }),
      backgroundColor:DIAS3.map(function(_, i){ return porDow[i] && porDow[i].media === mx ? CORES.ouro : 'rgba(90,33,50,.78)'; }), borderRadius:3}]},
      options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return 'média ' + brl(c.parsed.y) + ' (' + (porDow[c.dataIndex] ? porDow[c.dataIndex].dias : 0) + ' dia(s))'; }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO_MIL}}});
  }

  /* ================= VENDAS · PRODUTOS ================= */
  R.paginas['vendas.produtos'] = function(alvo, ctx){
    var estado = {q:'', grupo:'', classe:'', ordem:'valor', dir:-1, lista:[], base:0, off:false};
    function desenhar(){
      alvo.innerHTML = '<div class="v2-pag"><h2>Produtos</h2><p class="v2-sub">Cada produto com participação, curva ABC, preço médio' + (escritorio() ? ', margem e lucro' : '') + '. Clique em uma linha para ver a evolução do produto.</p>' +
        barraPeriodo() + '<div id="v2Corpo"><div class="v2-load">Carregando…</div></div></div>';
      ligarPeriodo(alvo, desenhar);
      var corpo = alvo.querySelector('#v2Corpo');
      pdvPronto().then(function(s){
        if (!ctx.vivo()) return;
        if (!s.pronto){ semBI(corpo, 'A análise profunda do PDV ainda não está ativa.'); return; }
        return pdvDados('produtos', '&limite=500').then(function(d){
          if (!ctx.vivo()) return;
          if (!d){ semBI(corpo, 'Não consegui carregar os produtos agora.'); return; }
          estado.lista = d.produtos; estado.base = d.base_valor; estado.off = d.produtos.length ? d.produtos[0].custo !== undefined : escritorio();
          corpo.innerHTML = '<div class="v2-barra"><label>Buscar produto<input type="search" id="v2Q" placeholder="ex.: picanha" style="width:200px;"></label>' +
            '<label>Grupo<select id="v2G"><option value="">Todos</option>' + Array.from(new Set(estado.lista.map(function(p){ return p.grupo || '(sem grupo)'; }))).sort().map(function(g){ return '<option>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
            '<div class="v2-chips" role="group" aria-label="Classe ABC">' + ['', 'A', 'B', 'C'].map(function(c){ return '<button type="button" class="v2-chip" data-c="' + c + '" aria-pressed="' + (c === '' ? 'true' : 'false') + '">' + (c || 'Todas') + '</button>'; }).join('') + '</div>' +
            '<button type="button" class="v2-btn" id="v2Xls">Exportar Excel</button></div>' +
            '<div id="v2Resumo" class="s" style="font-size:12.5px;color:var(--ink-soft);margin:0 0 8px;"></div><div class="v2-tab-wrap" style="max-height:60vh;overflow:auto;"><table class="v2-t"><thead id="v2Th"></thead><tbody id="v2Tb"></tbody></table></div><div id="v2Ficha"></div>' +
            calc('Lista de até 500 produtos do período, ordenada por faturamento. <strong>Classe</strong>: A = itens que formam os primeiros 80% do faturamento do período, B até 95%, C o restante (a classe é calculada sobre todos os produtos, mesmo quando você filtra). <strong>Preço médio</strong> = vendas ÷ quantidade. ' + (estado.off ? '<strong>Margem</strong> = (vendas − custo) ÷ vendas dos itens com custo cadastrado; sem custo aparece “—”.' : ''));
          montarTabela(corpo);
        });
      }).catch(function(e){ if (ctx.vivo()) semBI(corpo, 'Erro ao carregar: ' + (e && e.message ? e.message : e)); });
    }
    function filtrada(){
      var q = estado.q.trim().toLowerCase();
      var l = estado.lista.filter(function(p){
        return (!q || String(p.descricao || '').toLowerCase().indexOf(q) !== -1) && (!estado.grupo || (p.grupo || '(sem grupo)') === estado.grupo) && (!estado.classe || p.classe === estado.classe);
      });
      var o = estado.ordem, d = estado.dir;
      l.sort(function(a, b){ var x = a[o], y = b[o]; if (typeof x === 'string') return d * String(x).localeCompare(String(y), 'pt-BR'); x = (x === null || x === undefined) ? -Infinity : x; y = (y === null || y === undefined) ? -Infinity : y; return d * (x - y); });
      return l;
    }
    function montarTabela(corpo){
      var cols = [['descricao','Produto',0], ['grupo','Grupo',0], ['valor','Vendas',1], ['participacao_pct','% total',1], ['classe','Classe',0], ['kg','Kg',1], ['preco_medio','Preço médio',1]];
      if (estado.off) cols.push(['margem_pct','Margem',1], ['lucro','Lucro',1]);
      function linhas(){
        var l = filtrada(); var tot = soma(l, function(p){ return p.valor; });
        corpo.querySelector('#v2Resumo').innerHTML = '<strong>' + l.length + '</strong> produto(s) · ' + brl0(tot) + ' (' + pc(estado.base ? tot / estado.base * 100 : 0, 0) + ' das vendas do período)';
        corpo.querySelector('#v2Th').innerHTML = '<tr>' + cols.map(function(c){ return '<th class="ord ' + (c[2] ? 'n' : '') + '" data-o="' + c[0] + '" aria-sort="' + (estado.ordem === c[0] ? (estado.dir < 0 ? 'descending' : 'ascending') : 'none') + '">' + c[1] + (estado.ordem === c[0] ? (estado.dir < 0 ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr>';
        corpo.querySelector('#v2Tb').innerHTML = l.slice(0, 300).map(function(p){
          return '<tr class="clic" tabindex="0" data-k="' + esc(p.chave) + '"><td>' + esc(p.descricao || '(sem descrição)') + (p.generico ? ' <span class="v2-selo est">genérico</span>' : '') + '</td><td>' + esc(p.grupo || '—') + '</td><td class="n">' + brl(p.valor) + '</td><td class="n">' + pc(p.participacao_pct) + '</td><td><span class="v2-abc ' + p.classe + '">' + p.classe + '</span></td><td class="n">' + (p.kg ? num(p.kg, 1) : '—') + '</td><td class="n">' + (p.preco_medio === null ? '—' : brl(p.preco_medio)) + '</td>' +
            (estado.off ? '<td class="n">' + (p.margem_pct === null || p.margem_pct === undefined ? '—' : pc(p.margem_pct)) + '</td><td class="n">' + (p.lucro === null || p.lucro === undefined ? '—' : brl(p.lucro)) + '</td>' : '') + '</tr>';
        }).join('') || '<tr><td colspan="9" style="padding:18px;color:var(--ink-faint);">Nenhum produto neste filtro.</td></tr>';
      }
      linhas();
      corpo.querySelector('#v2Q').addEventListener('input', function(e){ estado.q = e.target.value; linhas(); });
      corpo.querySelector('#v2G').addEventListener('change', function(e){ estado.grupo = e.target.value; linhas(); });
      corpo.querySelectorAll('.v2-chip').forEach(function(b){ b.addEventListener('click', function(){ estado.classe = b.dataset.c; corpo.querySelectorAll('.v2-chip').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); linhas(); }); });
      corpo.querySelector('#v2Th').addEventListener('click', function(e){ var th = e.target.closest('th[data-o]'); if (!th) return; var o = th.dataset.o; estado.dir = estado.ordem === o ? -estado.dir : (o === 'descricao' || o === 'grupo' || o === 'classe' ? 1 : -1); estado.ordem = o; linhas(); });
      function abrir(tr){ if (tr) ficha(corpo.querySelector('#v2Ficha'), tr.dataset.k); }
      corpo.querySelector('#v2Tb').addEventListener('click', function(e){ abrir(e.target.closest('tr[data-k]')); });
      corpo.querySelector('#v2Tb').addEventListener('keydown', function(e){ if (e.key === 'Enter') abrir(e.target.closest('tr[data-k]')); });
      corpo.querySelector('#v2Xls').addEventListener('click', function(){
        if (typeof XLSX === 'undefined') return;
        var rows = filtrada().map(function(p){ var o = {Produto:p.descricao, Grupo:p.grupo, 'Vendas (R$)':p.valor, '% do total':p.participacao_pct, Classe:p.classe, Kg:p.kg, 'Preço médio':p.preco_medio}; if (estado.off){ o['Margem %'] = p.margem_pct; o['Lucro (R$)'] = p.lucro; } return o; });
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Produtos');
        XLSX.writeFile(wb, 'produtos-pdv-' + per.de + '-a-' + per.ate + '.xlsx');
      });
    }
    function ficha(el, chv){
      el.innerHTML = '<div class="v2-ficha"><div class="v2-load">Carregando produto…</div></div>';
      el.scrollIntoView({block:'nearest', behavior:'smooth'});
      pdvDados('produto', '&chave=' + encodeURIComponent(chv)).then(function(d){
        if (!ctx.vivo()) return;
        if (!d || !d.produto){ el.innerHTML = '<div class="v2-ficha">Sem vendas deste produto no período.</div>'; return; }
        var p = d.produto, off = p.margem_pct !== undefined;
        el.innerHTML = '<div class="v2-ficha"><div style="display:flex;justify-content:space-between;gap:10px;"><h3 style="margin:0 0 8px;font-size:16px;">' + esc(p.descricao) + ' <span style="font-weight:400;color:var(--ink-faint);font-size:12px;">' + esc(p.grupo || '') + '</span></h3><button type="button" class="v2-btn" id="v2FFecha">Fechar</button></div>' +
          '<div class="v2-grid">' + card({rot:'Vendas', valor:brl(p.valor), sub: pc(p.participacao_pct) + ' do total do período'}) + card({rot:'Quantidade', valor:num(p.qtd, p.unidade === 'KG' ? 1 : 0) + ' ' + esc((p.unidade || '').toLowerCase()), sub: p.cupons + ' cupom(ns) · vendeu em ' + p.dias_vendido + ' dia(s)'}) +
          card({rot:'Preço médio', valor: p.preco_medio === null ? '—' : brl(p.preco_medio), sub:'por ' + esc((p.unidade || 'unidade').toLowerCase())}) + (off ? card({rot:'Margem', valor: p.margem_pct === null ? '—' : pc(p.margem_pct), sub: p.lucro === null ? 'sem custo cadastrado' : 'lucro bruto ' + brl(p.lucro)}) : '') + '</div>' +
          '<div style="height:190px;"><canvas id="v2GProd" role="img" aria-label="Vendas do produto por dia"></canvas></div></div>';
        el.querySelector('#v2FFecha').addEventListener('click', function(){ el.innerHTML = ''; });
        limparGraficos();
        grafico('v2GProd', {type:'bar', data:{labels:d.serie.map(function(x){ return dm(x.data); }), datasets:[{data:d.serie.map(function(x){ return x.valor; }), backgroundColor:'rgba(90,33,50,.78)', borderRadius:3}]},
          options:{responsive:true, plugins:{legend:{display:false}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
      }).catch(function(){ el.innerHTML = '<div class="v2-ficha">Não consegui carregar este produto.</div>'; });
    }
    desenhar();
  };

  /* ================= VENDAS · GRUPOS ================= */
  R.paginas['vendas.grupos'] = function(alvo, ctx){
    function desenhar(){
      alvo.innerHTML = '<div class="v2-pag"><h2>Grupos' + (escritorio() ? ' e margem' : '') + '</h2><p class="v2-sub">Para onde vai o faturamento por grupo de produto' + (escritorio() ? ' e onde a margem está acima ou abaixo da média' : '') + '.</p>' + barraPeriodo() + '<div id="v2Corpo"><div class="v2-load">Carregando…</div></div></div>';
      ligarPeriodo(alvo, desenhar);
      var corpo = alvo.querySelector('#v2Corpo');
      pdvDados('visao').then(function(v){
        if (!ctx.vivo()) return;
        if (!v){ semBI(corpo, 'A análise profunda do PDV ainda não está ativa.'); return; }
        var off = v.totais.custo !== undefined, mg = v.totais.margem_pct, mx = Math.max.apply(null, v.grupos.map(function(g){ return g.participacao_pct; }).concat([1]));
        corpo.innerHTML = '<div class="v2-cols"><div class="v2-box"><h3>Participação no faturamento</h3><div style="height:280px;"><canvas id="v2GGr" role="img" aria-label="Faturamento por grupo"></canvas></div></div>' +
          '<div class="v2-box"><div class="v2-tab-wrap"><table class="v2-t"><thead><tr><th>Grupo</th><th class="n">Vendas</th><th style="min-width:90px;">% do total</th><th class="n">Kg</th>' + (off ? '<th class="n">Margem</th>' : '') + '</tr></thead><tbody>' +
          v.grupos.map(function(g){ var baixa = off && g.margem_pct !== null && g.margem_pct !== undefined && mg !== null && g.margem_pct < mg - 8;
            return '<tr><td>' + esc(g.grupo) + '<div style="font-size:11px;color:var(--ink-faint);">' + g.produtos + ' produto(s)</div></td><td class="n">' + brl0(g.valor) + '</td><td>' + bar(g.participacao_pct / mx * 100) + '<div style="font-size:11px;">' + pc(g.participacao_pct) + '</div></td><td class="n">' + (g.kg ? num(g.kg, 0) : '—') + '</td>' +
            (off ? '<td class="n" style="' + (baixa ? 'color:var(--red);font-weight:700;' : '') + '">' + (g.margem_pct === null || g.margem_pct === undefined ? '—' : pc(g.margem_pct)) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div></div></div>' +
          calc('Grupos conforme o cadastro do PDV (produtos sem grupo aparecem como “(sem grupo)”). Taxa de entrega fica fora. ' + (off ? 'Margem em vermelho = 8 pontos ou mais abaixo da margem média do período; considera só itens com custo cadastrado.' : ''));
        limparGraficos();
        var top = v.grupos.slice(0, 8), outros = soma(v.grupos.slice(8), function(g){ return g.valor; });
        var lab = top.map(function(g){ return g.grupo; }), dat = top.map(function(g){ return g.valor; }); if (outros > 0){ lab.push('Outros'); dat.push(outros); }
        grafico('v2GGr', {type:'doughnut', data:{labels:lab, datasets:[{data:dat, backgroundColor:[CORES.vinho, CORES.ouro, CORES.rosa, CORES.verde, '#7C3A4E', '#d9c3a0', '#4a6b5b', '#c98f9c', CORES.cinza], borderWidth:1}]},
          options:{responsive:true, plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:10}}}, tooltip:{callbacks:{label:function(c){ return c.label + ': ' + brl(c.parsed); }}}}}});
      }).catch(function(e){ if (ctx.vivo()) semBI(alvo.querySelector('#v2Corpo'), 'Erro ao carregar: ' + (e && e.message ? e.message : e)); });
    }
    desenhar();
  };

  /* ================= VENDAS · QUANDO VENDE ================= */
  R.paginas['vendas.quando'] = function(alvo, ctx){
    function desenhar(){
      alvo.innerHTML = '<div class="v2-pag"><h2>Quando vende</h2><p class="v2-sub">Mapa de calor por dia da semana e hora: onde estão os picos e os vales, para escalar equipe, repor balcão e planejar promoções.</p>' + barraPeriodo() + '<div id="v2Corpo"><div class="v2-load">Carregando…</div></div></div>';
      ligarPeriodo(alvo, desenhar);
      var corpo = alvo.querySelector('#v2Corpo');
      pdvDados('visao').then(function(v){
        if (!ctx.vivo()) return;
        if (!v){ semBI(corpo, 'A análise profunda do PDV ainda não está ativa.'); return; }
        var m = {}, horas = {};
        v.hora.forEach(function(x){ m[x.dow + '|' + x.hora] = x; horas[x.hora] = 1; });
        var hs = Object.keys(horas).map(Number).sort(function(a, b){ return a - b; });
        if (!hs.length){ corpo.innerHTML = '<div class="v2-vazio">Sem horários de venda no período.</div>'; return; }
        var h0 = hs[0], h1 = hs[hs.length - 1], mx = 1;
        // média por ocorrência do dia da semana (evita que um dia com mais ocorrências no período pareça melhor)
        var ocorr = {}; v.dia_da_semana.forEach(function(x){ ocorr[x.dow] = x.dias || 1; });
        v.hora.forEach(function(x){ var vv = x.valor / (ocorr[x.dow] || 1); if (vv > mx) mx = vv; });
        var ordem = [1, 2, 3, 4, 5, 6, 0];
        var t = '<table class="v2-heat" aria-label="Média de vendas por dia da semana e hora"><thead><tr><th></th>';
        for (var h = h0; h <= h1; h++) t += '<th>' + h + 'h</th>';
        t += '</tr></thead><tbody>';
        ordem.forEach(function(dw){
          t += '<tr><th class="d">' + DIAS3[dw] + '</th>';
          for (var h2 = h0; h2 <= h1; h2++){
            var c = m[dw + '|' + h2], val = c ? c.valor / (ocorr[dw] || 1) : 0, a = mx ? val / mx : 0;
            t += '<td title="' + DIAS[dw] + ' ' + h2 + 'h: média de ' + brl(val) + '" style="background:rgba(90,33,50,' + (0.06 + a * 0.82).toFixed(2) + ');color:' + (a > 0.5 ? '#fff' : 'var(--ink)') + ';">' + (val ? num(val / 1000, 1) : '') + '</td>';
          }
          t += '</tr>';
        });
        t += '</tbody></table>';
        var porH = {}; v.hora.forEach(function(x){ porH[x.hora] = (porH[x.hora] || 0) + x.valor; });
        var totH = soma(Object.keys(porH), function(k){ return porH[k]; });
        corpo.innerHTML = '<div class="v2-box"><h3>Média de vendas por dia da semana e hora <span class="v2-selo">em R$ mil</span></h3><div class="v2-tab-wrap">' + t + '</div></div>' +
          '<div class="v2-cols" style="margin-top:14px;"><div class="v2-box"><h3>Vendas por hora do dia</h3><div style="height:220px;"><canvas id="v2GHora" role="img" aria-label="Vendas por hora"></canvas></div></div>' +
          '<div class="v2-box"><h3>Leitura</h3><ul class="v2-ins">' + insightsVendas(v).filter(function(i){ return /Pico|Melhor dia/.test(i[1]); }).map(function(i){ return '<li>' + i[1] + '</li>'; }).join('') + '</ul></div></div>' +
          calc('Cada célula é a média de vendas (sem taxa de entrega) naquele dia da semana e hora, dividindo pelo número de vezes que aquele dia da semana ocorreu no período. Escala de cor: mais escuro = mais vendas. Pico = duas horas seguidas com maior faturamento.');
        limparGraficos();
        grafico('v2GHora', {type:'bar', data:{labels:hs.map(function(x){ return x + 'h'; }), datasets:[{data:hs.map(function(x){ return porH[x]; }), backgroundColor:'rgba(90,33,50,.78)', borderRadius:3}]},
          options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return brl(c.parsed.y) + ' (' + pc(totH ? c.parsed.y / totH * 100 : 0) + ')'; }}}}, scales:{x:Object.assign({}, EIXO, {grid:{display:false}}), y:EIXO}}});
      }).catch(function(e){ if (ctx.vivo()) semBI(alvo.querySelector('#v2Corpo'), 'Erro ao carregar: ' + (e && e.message ? e.message : e)); });
    }
    desenhar();
  };

  /* ================= VENDAS · O QUE MUDOU ================= */
  R.paginas['vendas.mudou'] = function(alvo, ctx){
    function desenhar(){
      alvo.innerHTML = '<div class="v2-pag"><h2>O que mudou</h2><p class="v2-sub">Produtos que cresceram, caíram, apareceram ou sumiram em relação ao período imediatamente anterior de mesmo tamanho. Considera produtos identificados com pelo menos R$ 50 de venda em algum dos dois períodos.</p>' + barraPeriodo() + '<div id="v2Corpo"><div class="v2-load">Carregando…</div></div></div>';
      ligarPeriodo(alvo, desenhar);
      var corpo = alvo.querySelector('#v2Corpo');
      pdvDados('comparativo').then(function(d){
        if (!ctx.vivo()) return;
        if (!d){ semBI(corpo, 'A análise profunda do PDV ainda não está ativa.'); return; }
        function lista(titulo, itens, tipo){
          if (!itens.length) return '<div class="v2-box"><h3>' + titulo + '</h3><div class="s" style="color:var(--ink-faint);font-size:12.5px;">Nada a destacar.</div></div>';
          return '<div class="v2-box"><h3>' + titulo + '</h3><table class="v2-t"><thead><tr><th>Produto</th><th class="n">Antes</th><th class="n">Agora</th><th class="n">Variação</th></tr></thead><tbody>' +
            itens.map(function(x){ return '<tr><td>' + esc(x.descricao) + '<div style="font-size:11px;color:var(--ink-faint);">' + esc(x.grupo || '') + '</div></td><td class="n">' + brl0(x.anterior) + '</td><td class="n">' + brl0(x.atual) + '</td><td class="n"><span class="' + (x.delta >= 0 ? 'v2-up' : 'v2-down') + '">' + (x.delta >= 0 ? '+' : '−') + brl0(Math.abs(x.delta)) + (x.delta_pct === null ? '' : '<br><span style="font-size:11px;">' + (x.delta_pct >= 0 ? '+' : '−') + num(Math.abs(x.delta_pct), 0) + '%</span>') + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
        }
        corpo.innerHTML = '<div class="v2-cols">' + lista('Mais cresceram', d.crescem) + lista('Mais caíram', d.caem) + lista('Novos no período', d.novos) + lista('Sumiram do período', d.sumiram) + '</div>' +
          calc('Compara o faturamento por produto do período escolhido com o período anterior de mesmo número de dias. Itens genéricos e taxa de entrega ficam de fora. “Sumiram” não significa descontinuados: pode ser sazonalidade, ruptura ou troca de cadastro — confira antes de concluir.');
      }).catch(function(e){ if (ctx.vivo()) semBI(alvo.querySelector('#v2Corpo'), 'Erro ao carregar: ' + (e && e.message ? e.message : e)); });
    }
    desenhar();
  };

  /* exporta utilitários para as páginas de gestão (resumos-gestao.js) */
  R.u = {esc:esc, brl:brl, brl0:brl0, num:num, pc:pc, iso:iso, hoje:hoje, pdata:pdata, somaDias:somaDias, dbr:dbr, dm:dm, soma:soma, varPct:varPct, delta:delta, card:card, selo:selo, calc:calc, sec:sec, bar:bar,
    admin:admin, escritorio:escritorio, CORES:CORES, grafico:grafico, limparGraficos:limparGraficos, EIXO:EIXO, semBI:semBI, pdvPronto:pdvPronto, api:api, DIAS:DIAS, DIAS3:DIAS3};
  R.render = function(chv, alvo){
    var f = R.paginas[chv];
    var tok = String(Date.now()) + Math.random();
    alvo.dataset.tok = tok;
    var ctx = {vivo: function(){ return alvo.isConnected && alvo.dataset.tok === tok; }};
    limparGraficos();
    if (!f){ alvo.innerHTML = '<div class="v2-vazio">Esta página ainda não existe.</div>'; return; }
    try{ f(alvo, ctx); }catch(e){ console.error('resumo ' + chv, e); alvo.innerHTML = '<div class="v2-vazio">Não consegui montar esta página agora.</div>'; }
  };
})();
