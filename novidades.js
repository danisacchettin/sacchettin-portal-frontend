/* ==========================================================================================
   Versão e "Novidades do sistema" (pedido da Dani, 14/10/2026).
   - No rodapé do menu lateral: "Versão X" + botão "Novidades" (com bolinha de quantas ainda não foram vistas).
   - O painel mostra SÓ o que a pessoa ainda não viu; ao abrir, tudo vira "visto" neste navegador.
   - NÃO usa a tela interna (#overlay): é uma janela própria, então não interfere em nenhum módulo aberto.
   TODO DEPLOY QUE A CLIENTE PERCEBE: acrescentar uma entrada NO TOPO de NOVIDADES (id único, texto simples, sem
   jargão, só o que ela enxerga) e subir PORTAL_VERSAO. Itens só do escritório não entram aqui.
   O "visto" fica em localStorage (por navegador e por usuário): em outro aparelho as novidades aparecem de novo.
   ========================================================================================== */
(function(){
  'use strict';
  var PORTAL_VERSAO = '4.1';

  // Mais recente primeiro. id = identificador estável (nunca reaproveitar). Texto: frases curtas e simples.
  var NOVIDADES = [
    { id:'2026-10-15-notas-busca-automatica', versao:'4.1', data:'15/10/2026',
      titulo:'Notas de entrada: busca automática',
      texto:'Quando a busca automática estiver ativada pelo escritório, o portal procura notas novas na SEFAZ a cada 30 minutos. Como a SEFAZ atende cerca de uma consulta por hora quando não há novidades, uma nota nova pode levar até cerca de 1 hora para aparecer. As notas chegam primeiro só com o resumo (emitente, valor e data).' },
    { id:'2026-10-14-menu-modulos', versao:'4.0', data:'14/10/2026',
      titulo:'Menu novo, em dois grupos',
      texto:'O menu lateral agora está dividido em Operacional (o dia a dia: Financeiro, Notas de entrada e Vendas) e Gestão (Resultado, Dívidas e contratos, Compras e custos, Pessoas e Importar planilha). Todas as telas de antes continuam disponíveis.' },
    { id:'2026-10-14-botoes-topo', versao:'4.0', data:'14/10/2026',
      titulo:'Assuntos de cada módulo em botões',
      texto:'Ao abrir um módulo, os assuntos dele aparecem como botões no alto da tela. Por exemplo, em Financeiro: A pagar, A receber, Caixa e bancos e Contas pagas. A tela agora fica aberta onde você clicou e não volta sozinha para o painel.' },
    { id:'2026-10-14-linha-clicavel', versao:'4.0', data:'14/10/2026',
      titulo:'Clique na linha para abrir',
      texto:'Em A pagar, A receber, Vencidos, Contas pagas, Contratos, Cheques e no extrato do dia (Fechamento de caixa), basta clicar na linha para ver os detalhes ou editar. Para dar baixa, abra a linha e use o botão Pagar ou Receber.' },
    { id:'2026-10-14-ajuda-interrogacao', versao:'4.0', data:'14/10/2026',
      titulo:'Explicações no ícone “?”',
      texto:'Os textos explicativos dos cartões foram para um ícone “?” ao lado do título. Passe o mouse (ou toque, no celular) para ler. Os valores continuam à vista.' },
    { id:'2026-10-14-pdv-datas', versao:'4.0', data:'14/10/2026',
      titulo:'PDV: escolha as datas',
      texto:'No PDV, o seletor de período foi retirado. Use apenas os campos De e Até e clique em Aplicar.' },
    { id:'2026-10-14-dav-baixa-lote', versao:'4.0', data:'14/10/2026',
      titulo:'DAV: dar baixa em vários pedidos de uma vez',
      texto:'Na tela DAV, filtre a coluna Situação (Vencidos, Pagos ou A vencer), marque os pedidos desejados e clique em “Dar baixa nos selecionados”.' },
    { id:'2026-10-14-notas-entrada', versao:'4.0', data:'14/10/2026',
      titulo:'Notas de entrada',
      texto:'Veja as notas fiscais emitidas contra a empresa, confirme o recebimento e autorize o lançamento no A pagar, que já vem preenchido para você conferir.' }
  ];

  var memVistas = {};   // se o navegador não deixar gravar, vale ao menos até recarregar a página
  function usuarioId(){
    try{ if(typeof USUARIO !== 'undefined' && USUARIO) return String(USUARIO.id || USUARIO.email || 'u'); }catch(e){}
    return null;
  }
  function chave(){ var u = usuarioId(); return u ? 'portalNovidadesVistas:' + u : null; }
  function lerVistas(){
    var k = chave(); if(!k) return null;
    var v = memVistas[k] || [];
    try{ var raw = localStorage.getItem(k); if(raw){ var a = JSON.parse(raw); if(Array.isArray(a)) v = v.concat(a); } }catch(e){}
    return v;
  }
  function gravarVistas(ids){
    var k = chave(); if(!k) return;
    memVistas[k] = ids;
    try{ localStorage.setItem(k, JSON.stringify(ids)); }catch(e){}
  }
  function naoVistas(){
    var v = lerVistas(); if(v === null) return [];
    return NOVIDADES.filter(function(n){ return v.indexOf(n.id) === -1; });
  }
  function marcarTodasVistas(){
    var v = lerVistas(); if(v === null) return;
    NOVIDADES.forEach(function(n){ if(v.indexOf(n.id) === -1) v.push(n.id); });
    gravarVistas(v);
  }

  // ---------- estilo ----------
  var st = document.createElement('style');
  st.textContent =
    '.nav-ver{display:flex; align-items:center; justify-content:space-between; gap:8px; margin:10px -4px 0; padding:6px 0 14px;}' +
    '.nav-ver .nav-versao{font-size:11px; color:var(--nav-ink-soft); white-space:nowrap;}' +
    '.nav-novidades{appearance:none; display:inline-flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--nav-line); border-radius:999px; padding:5px 10px; white-space:nowrap; color:var(--nav-ink); font-family:inherit; font-size:11px; font-weight:600; line-height:1; cursor:pointer; transition:background-color .15s ease, border-color .15s ease;}' +
    '.nav-novidades:hover{background:var(--nav-hover); border-color:var(--nav-accent);}' +
    '.nav-novidades:focus-visible{outline:2px solid var(--nav-accent); outline-offset:2px;}' +
    '.nav-novidades .nov-n{display:none; min-width:16px; padding:2px 5px; border-radius:9px; background:var(--nav-accent); color:var(--nav-bg); font-size:10px; font-weight:700; text-align:center;}' +
    '.nav-novidades.tem-novas .nov-n{display:inline-block;}' +
    '#novidadesFundo{position:fixed; inset:0; z-index:90; display:none; align-items:center; justify-content:center; padding:16px; background:rgba(20,16,18,.48);}' +
    '#novidadesFundo.aberto{display:flex;}' +
    '#novidadesCaixa{width:100%; max-width:560px; max-height:min(84vh,720px); display:flex; flex-direction:column; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.35);}' +
    '#novidadesCaixa header{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px 22px 12px;}' +
    '#novidadesCaixa h2{margin:0; font-size:19px; line-height:1.25;}' +
    '#novidadesCaixa header p{margin:4px 0 0; font-size:12px; color:var(--ink-soft);}' +
    '#novidadesCaixa .nov-x{appearance:none; flex:none; width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:transparent; color:var(--ink-soft); font-size:15px; cursor:pointer;}' +
    '#novidadesCaixa .nov-x:hover{background:var(--gold-wash); color:var(--ink);}' +
    '#novidadesCaixa .nov-lista{overflow:auto; padding:4px 22px 8px; display:flex; flex-direction:column; gap:10px;}' +
    '#novidadesCaixa .nov-item{border:1px solid var(--border); border-left:3px solid var(--gold); border-radius:10px; padding:12px 14px; background:var(--paper-2, transparent);}' +
    '#novidadesCaixa .nov-item h3{margin:0 0 4px; font-size:14px;}' +
    '#novidadesCaixa .nov-item p{margin:0; font-size:13px; line-height:1.5; color:var(--ink-soft);}' +
    '#novidadesCaixa .nov-meta{font-size:10.5px; letter-spacing:.6px; text-transform:uppercase; color:var(--ink-faint); margin-bottom:4px;}' +
    '#novidadesCaixa .nov-vazio{padding:26px 8px; text-align:center; font-size:13.5px; color:var(--ink-soft); line-height:1.6;}' +
    '#novidadesCaixa footer{padding:12px 22px 18px; display:flex; justify-content:flex-end;}' +
    '@media print{ #novidadesFundo{display:none !important;} }';
  document.head.appendChild(st);

  // ---------- botão no rodapé do menu ----------
  var botao = null, verEl = null;
  function montarRodape(){
    var rodape = document.querySelector('#navLateral .nav-rodape');
    if(!rodape || document.getElementById('navNovidades')) return;
    var linha = document.createElement('div'); linha.className = 'nav-ver';
    verEl = document.createElement('span'); verEl.className = 'nav-versao'; verEl.textContent = 'v' + PORTAL_VERSAO; verEl.title = 'Versão ' + PORTAL_VERSAO; verEl.setAttribute('aria-label', 'Versão ' + PORTAL_VERSAO);
    botao = document.createElement('button'); botao.type = 'button'; botao.id = 'navNovidades'; botao.className = 'nav-novidades';
    botao.innerHTML = '<span>Novidades do sistema</span><span class="nov-n" aria-hidden="true"></span>';
    botao.addEventListener('click', abrir);
    linha.appendChild(verEl); linha.appendChild(botao);
    rodape.appendChild(linha);
    atualizarSelo();
  }
  function atualizarSelo(){
    if(!botao) return;
    var n = naoVistas().length;
    var s = botao.querySelector('.nov-n');
    s.textContent = n > 9 ? '9+' : String(n);
    botao.classList.toggle('tem-novas', n > 0);
    botao.setAttribute('aria-label', n > 0 ? 'Novidades do sistema: ' + n + (n === 1 ? ' nova' : ' novas') : 'Novidades do sistema: nenhuma nova');
  }

  // ---------- janela ----------
  var fundo = null, caixa = null, ultimoFoco = null;
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function montarJanela(){
    fundo = document.createElement('div'); fundo.id = 'novidadesFundo';
    fundo.innerHTML = '<div id="novidadesCaixa" role="dialog" aria-modal="true" aria-labelledby="novidadesTitulo" tabindex="-1">' +
      '<header><div><h2 id="novidadesTitulo">Novidades do sistema</h2><p id="novidadesSub"></p></div><button type="button" class="nov-x" aria-label="Fechar">✕</button></header>' +
      '<div class="nov-lista" id="novidadesLista"></div>' +
      '<footer><button type="button" class="btn gold" id="novidadesOk">Entendi</button></footer></div>';
    document.body.appendChild(fundo);
    caixa = fundo.firstChild;
    fundo.addEventListener('mousedown', function(e){ if(e.target === fundo) fechar(); });
    fundo.querySelector('.nov-x').addEventListener('click', fechar);
    fundo.querySelector('#novidadesOk').addEventListener('click', fechar);
    document.addEventListener('keydown', function(e){
      if(!fundo.classList.contains('aberto')) return;
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if(e.key === 'Tab'){ // mantém o foco dentro da janela
        var f = Array.prototype.slice.call(caixa.querySelectorAll('button')).filter(function(b){ return b.offsetParent !== null; });
        if(!f.length) return;
        var i = f.indexOf(document.activeElement);
        if(e.shiftKey && (i <= 0)){ f[f.length - 1].focus(); e.preventDefault(); }
        else if(!e.shiftKey && (i === -1 || i === f.length - 1)){ f[0].focus(); e.preventDefault(); }
      }
    }, true);
  }
  function abrir(){
    if(!fundo) montarJanela();
    var novas = naoVistas();
    var lista = document.getElementById('novidadesLista');
    document.getElementById('novidadesSub').textContent = novas.length
      ? (novas.length === 1 ? '1 novidade que você ainda não viu' : novas.length + ' novidades que você ainda não viu') + ' · Versão ' + PORTAL_VERSAO
      : 'Versão ' + PORTAL_VERSAO;
    lista.innerHTML = novas.length ? novas.map(function(n){
      return '<div class="nov-item"><div class="nov-meta">Versão ' + esc(n.versao) + ' · ' + esc(n.data) + '</div><h3>' + esc(n.titulo) + '</h3><p>' + esc(n.texto) + '</p></div>';
    }).join('') : '<div class="nov-vazio">Você já viu todas as novidades.<br>Quando houver algo novo no sistema, aparece aqui.</div>';
    ultimoFoco = document.activeElement;
    // no celular o menu é uma gaveta: fecha antes de mostrar a janela
    if(document.body.classList.contains('nav-aberto')){ var t = document.getElementById('navToggle'); if(t) t.click(); }
    fundo.classList.add('aberto');
    try{ caixa.focus({preventScroll:true}); }catch(e){}
    lista.scrollTop = 0;
    marcarTodasVistas(); atualizarSelo();     // abriu = viu (a lista na tela continua até fechar)
  }
  function fechar(){
    if(!fundo) return;
    fundo.classList.remove('aberto');
    var alvo = (ultimoFoco && document.contains(ultimoFoco) && ultimoFoco.offsetParent !== null) ? ultimoFoco : botao;
    try{ if(alvo) alvo.focus(); }catch(e){}
  }

  // ---------- liga ----------
  function iniciar(){
    montarRodape();
    // o usuário só existe depois do login: atualiza o selo quando ele chegar (sem mexer no código do login)
    if(typeof window.setUsuario === 'function' && !window.setUsuario.__novidades){
      var orig = window.setUsuario;
      window.setUsuario = function(){ var r = orig.apply(this, arguments); try{ atualizarSelo(); }catch(e){} return r; };
      window.setUsuario.__novidades = true;
    }
    atualizarSelo();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  window.__novidadesDiagnostico = function(){ return { versao:PORTAL_VERSAO, total:NOVIDADES.length, naoVistas:naoVistas().map(function(n){ return n.id; }) }; };
})();
