/* Nova versão — menu por módulos: OPERACIONAL (o que se usa todo dia) e GESTÃO (análise e decisão).
   Só existe em /novo. Não reimplementa nenhuma tela: cada aba "de detalhe" aciona a tela que já existe no portal
   (mesmo clique, mesma função, mesma permissão); a primeira aba de cada módulo é uma página de resumo com BI (resumos*.js).
   Para comparar com o menu anterior dentro desta versão: acrescente ?menu=antigo ao endereço. */
(function(){
  'use strict';
  if (!document.body.classList.contains('layout-novo')) return;
  if (/[?&]menu=antigo\b/.test(location.search)) return;
  var nav = document.getElementById('navLateral');
  var subbar = document.querySelector('.subbar');
  var R = window.DSSJ_R;
  if (!nav || !subbar || !R) return;

  /* ---------- definição dos módulos ----------
     abas: { id, rot, pag }            -> página de resumo/BI (resumos*.js)
           { id, rot, pdv:'dias' }     -> tela atual do PDV, já na aba pedida
           { id, rot, alvo:'#seletor' }-> clica no cartão/botão que já existe
           { id, rot, fn:'nomeFuncao' }-> chama a função global que já existe
           so:'admin'                  -> só escritório (mesma regra do portal atual) */
  var MODULOS = [
    { grupo: 'Operacional', itens: [
      { id: 'hoje', rot: 'Hoje', ic: '◉', abas: [ { id: 'resumo', rot: 'Hoje', pag: 'hoje' } ] },
      { id: 'vendas', rot: 'Vendas', sub: 'PDV', ic: '▤', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'vendas.resumo' },
        { id: 'produtos', rot: 'Produtos',             pag: 'vendas.produtos' },
        { id: 'grupos',   rot: 'Grupos',               pag: 'vendas.grupos' },
        { id: 'quando',   rot: 'Quando vende',         pag: 'vendas.quando' },
        { id: 'mudou',    rot: 'O que mudou',          pag: 'vendas.mudou' },
        { id: 'dias',     rot: 'Dias e fechamento',    pdv: 'dias' },
        { id: 'gestao',   rot: 'Gestão do PDV',        pdv: 'gestao', so: 'admin' },
        { id: 'qualidade',rot: 'Qualidade dos dados',  pdv: 'qualidade', so: 'admin' },
        { id: 'maq',      rot: 'Taxas de maquininha',  alvo: '#btnMaquininhas' } ] },
      { id: 'caixa', rot: 'Caixa', ic: '$', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'caixa.resumo' },
        { id: 'fech',     rot: 'Fechamento de caixa',  fn: 'openFechamentoSemanaPanel' },
        { id: 'fluxo',    rot: 'Fluxo de caixa',       fn: 'openFluxoPanel' },
        { id: 'saldos',   rot: 'Saldos bancários',     fn: 'openSaldoPanel' },
        { id: 'conc',     rot: 'Conciliação',          alvo: '#btnConciliacao' },
        { id: 'cheques',  rot: 'Cheques recebidos',    alvo: '#btnChequesRecebidos' } ] },
      { id: 'contas', rot: 'Contas', ic: '≡', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'contas.resumo' },
        { id: 'pagar',    rot: 'A pagar',              alvo: '#cardPagar' },
        { id: 'hoje',     rot: 'A pagar hoje',         alvo: '#cardPagarHoje' },
        { id: 'venc',     rot: 'Vencidos',             alvo: '#cardVencidos' },
        { id: 'faixas',   rot: 'Faixas de atraso',     fn: 'openAgingPanel' },
        { id: 'receber',  rot: 'A receber',            alvo: '#cardReceber' },
        { id: 'pagas',    rot: 'Contas pagas',         alvo: '#btnContasPagas' } ] }
    ] },
    { grupo: 'Gestão', itens: [
      { id: 'resultado', rot: 'Resultado', ic: '▥', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'resultado.resumo' },
        { id: 'dre',      rot: 'DRE',                  alvo: '#btnDRE' },
        { id: 'saude',    rot: 'Saúde da empresa',     alvo: '#saudeEmpresaBanner', so: 'admin' },
        { id: 'desp',     rot: 'Despesas por categoria', pag: 'resultado.despesas' } ] },
      { id: 'dividas', rot: 'Dívidas e contratos', ic: '▤', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'dividas.resumo' },
        { id: 'contratos',rot: 'Contratos bancários',  alvo: '#btnContratos' },
        { id: 'despfin',  rot: 'Despesas financeiras', alvo: '#btnDespesasFinanceiras' },
        { id: 'prest',    rot: 'Prestadores',          alvo: '#btnContratosPrestadores' } ] },
      { id: 'compras', rot: 'Compras e custos', ic: '▣', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'compras.resumo' },
        { id: 'custo',    rot: 'Custo de produto',     alvo: '#btnCustoProduto' },
        { id: 'carga',    rot: 'Carga tributária',     alvo: '#btnCargaTributaria' } ] },
      { id: 'pessoas', rot: 'Pessoas', ic: '♦', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'pessoas.resumo' },
        { id: 'func',     rot: 'Funcionários',         alvo: '#btnFuncionarios' } ] },
      { id: 'cadastros', rot: 'Cadastros', ic: '⇧', abas: [
        { id: 'resumo',   rot: 'Resumo',               pag: 'cadastros.resumo' },
        { id: 'editar',   rot: 'Editar cadastros',     alvo: '#btnMenu' },
        { id: 'importar', rot: 'Importar planilha',    alvo: '#btnImportar' },
        { id: 'imprimir', rot: 'Relatório para impressão', alvo: '#btnPrint' } ] }
    ] }
  ];

  document.body.classList.add('menu-v2');

  var porId = {}, botoes = {};
  function eAdmin(){ try{ return typeof podeVerSaudeEmpresa === 'function' && podeVerSaudeEmpresa(); }catch(e){ return false; } }
  function abasVisiveis(m){ return m.abas.filter(function(a){ return a.so !== 'admin' || eAdmin(); }); }

  /* ---------- menu lateral ---------- */
  var rodape = nav.querySelector('.nav-rodape');
  function criarItem(m){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-item'; b.setAttribute('data-v2', m.id);
    b.innerHTML = '<span class="nav-ic" aria-hidden="true">' + m.ic + '</span><span>' + m.rot + '</span>' + (m.sub ? '<span class="nav-sub">' + m.sub + '</span>' : '') + '<span class="nav-badge" data-v2-badge="' + m.id + '" style="display:none;"></span>';
    b.addEventListener('click', function(){ selecionar(m.id, m.abas[0].id); });
    nav.insertBefore(b, rodape);
    botoes[m.id] = b; porId[m.id] = m;
  }
  var inicio = document.createElement('button');
  inicio.type = 'button'; inicio.className = 'nav-item ativo'; inicio.setAttribute('data-v2', 'inicio');
  inicio.innerHTML = '<span class="nav-ic" aria-hidden="true">⌂</span><span>Início</span>';
  inicio.addEventListener('click', function(){ fecharMenuMovel(); if (typeof closeOverlay === 'function') { try{ closeOverlay(true); }catch(e){} } window.scrollTo({top: 0, behavior: 'smooth'}); });
  nav.insertBefore(inicio, rodape); botoes.inicio = inicio;
  MODULOS.forEach(function(g){
    var t = document.createElement('div');
    t.className = 'nav-grupo-titulo'; t.setAttribute('data-v2', '1'); t.textContent = g.grupo;
    nav.insertBefore(t, rodape);
    g.itens.forEach(criarItem);
  });

  /* ---------- barra de abas horizontais (dentro da barra superior) ---------- */
  var tabs = document.createElement('div');
  tabs.className = 'v2-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Páginas do módulo');
  subbar.appendChild(tabs);
  tabs.addEventListener('keydown', function(e){
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var l = Array.prototype.slice.call(tabs.querySelectorAll('.v2-tab')), i = l.indexOf(document.activeElement);
    if (i === -1) return;
    var n = l[(i + (e.key === 'ArrowRight' ? 1 : -1) + l.length) % l.length];
    n.focus(); e.preventDefault();
  });

  /* ---------- estado e navegação ---------- */
  var estado = {mod: null, aba: null, armado: false};
  function fecharMenuMovel(){ if (document.body.classList.contains('nav-aberto')){ var s = document.querySelector('.nav-scrim'); if (s) s.click(); } }
  function toast(txt){
    var el = document.getElementById('v2Toast');
    if (!el){ el = document.createElement('div'); el.id = 'v2Toast'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--nav-bg);color:var(--nav-ink,#fff);padding:10px 18px;border-radius:7px;font-size:12.5px;z-index:80;box-shadow:0 10px 30px rgba(0,0,0,.25);'; document.body.appendChild(el); }
    el.textContent = txt; el.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function(){ el.style.display = 'none'; }, 3500);
  }
  function marcarNav(modId){
    Object.keys(botoes).forEach(function(k){
      var on = (k === modId) || (modId === null && k === 'inicio');
      botoes[k].classList.toggle('ativo', on);
      if (on) botoes[k].setAttribute('aria-current', 'page'); else botoes[k].removeAttribute('aria-current');
    });
  }
  function desenharTabs(){
    var m = porId[estado.mod];
    if (!m){ tabs.innerHTML = ''; document.body.classList.remove('v2-aba-ativa'); return; }
    var lista = abasVisiveis(m);
    // módulo com uma só página (Hoje): não precisa de barra
    if (lista.length < 2){ tabs.innerHTML = ''; document.body.classList.remove('v2-aba-ativa'); return; }
    tabs.innerHTML = lista.map(function(a){
      return '<button type="button" class="v2-tab" role="tab" data-aba="' + a.id + '" aria-selected="' + (a.id === estado.aba ? 'true' : 'false') + '" tabindex="' + (a.id === estado.aba ? '0' : '-1') + '">' + a.rot + '</button>';
    }).join('');
    document.body.classList.add('v2-aba-ativa');
    Array.prototype.forEach.call(tabs.querySelectorAll('.v2-tab'), function(b){ b.addEventListener('click', function(){ selecionar(estado.mod, b.dataset.aba); }); });
    var at = tabs.querySelector('[aria-selected="true"]'); if (at && at.scrollIntoView) { try{ at.scrollIntoView({block: 'nearest', inline: 'nearest'}); }catch(e){} }
  }
  function abrirPagina(a){
    var html = '<div class="panel-head" style="margin-bottom:0;"><div></div><button class="close-x" aria-label="Fechar" onclick="closeOverlay()">✕</button></div><div id="v2Pagina"></div>';
    if (typeof openOverlay === 'function') openOverlay(html);
    var alvo = document.getElementById('v2Pagina');
    if (alvo) R.render(a.pag, alvo);
  }
  function abrirLegado(a){
    if (a.pdv){
      if (typeof openPdvPanel === 'function'){ openPdvPanel(a.pdv); return true; }   // abre a tela do PDV já na aba pedida
      var c = document.getElementById('btnPDV');
      if (c){ try{ pdvAba = a.pdv; }catch(e){} c.click(); return true; }
      return false;
    }
    if (a.fn){
      var f = window[a.fn];
      if (typeof f === 'function'){ f(); return true; }
      return false;
    }
    var el = a.alvo && document.querySelector(a.alvo);
    if (el){ el.click(); return true; }
    return false;
  }
  function selecionar(modId, abaId){
    var m = porId[modId]; if (!m) return;
    var a = m.abas.filter(function(x){ return x.id === abaId; })[0] || m.abas[0];
    fecharMenuMovel();
    estado.armado = true; setTimeout(function(){ estado.armado = false; }, 60);
    var anterior = {mod: estado.mod, aba: estado.aba};
    estado.mod = modId; estado.aba = a.id;
    var ok = true;
    if (a.pag) abrirPagina(a); else ok = abrirLegado(a);
    if (!ok){
      estado.mod = anterior.mod; estado.aba = anterior.aba;
      toast('Esta página ainda não carregou. Tente de novo em instantes.');
      return;
    }
    marcarNav(modId); desenharTabs();
  }
  R.irPara = selecionar;

  /* ---------- a barra de abas acompanha a tela interna: fecha com ela; some se a tela foi aberta por outro caminho ---------- */
  var ov = document.getElementById('overlay');
  if (ov) new MutationObserver(function(){
    var aberto = ov.classList.contains('open');
    if (!aberto){ estado.mod = null; estado.aba = null; marcarNav(null); desenharTabs(); if (R.limparGraficos) R.limparGraficos(); return; }
    if (!estado.armado && estado.mod){ estado.mod = null; estado.aba = null; marcarNav(null); desenharTabs(); }
  }).observe(ov, {attributes: true, attributeFilter: ['class']});

  /* ---------- selo de pendências no item "Hoje" (títulos vencidos a pagar) ---------- */
  function atualizarSelos(){
    try{
      if (typeof DATA === 'undefined' || !DATA || !DATA.contasPagar) return;
      var n = DATA.contasPagar.filter(function(x){ return typeof emAtraso === 'function' && emAtraso(x, 'pagar'); }).length;
      var el = nav.querySelector('[data-v2-badge="hoje"]');
      if (el){ el.textContent = n; el.style.display = n ? '' : 'none'; el.setAttribute('aria-label', n + ' título(s) vencido(s)'); }
    }catch(e){}
  }
  atualizarSelos(); setInterval(atualizarSelos, 6000);

  /* atalho de diagnóstico (testes): quais abas ficaram sem alvo */
  window.__menuV2Diagnostico = function(){
    var out = [];
    MODULOS.forEach(function(g){ g.itens.forEach(function(m){ abasVisiveis(m).forEach(function(a){
      var ok = a.pag ? !!R.paginas[a.pag] : a.pdv ? !!document.getElementById('btnPDV') : a.fn ? typeof window[a.fn] === 'function' : !!document.querySelector(a.alvo);
      out.push(m.id + '.' + a.id + ':' + (ok ? 'ok' : 'SEM_ALVO'));
    }); }); });
    return out;
  };
})();
