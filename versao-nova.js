/* Convite para a NOVA VERSÃO do portal (pasta /novo) — acréscimo opcional e reversível da versão vigente.
   Não altera dados, não chama a API e não muda nada enquanto estiver desligado.
   - habilitado:false  -> a cliente NÃO vê o botão (a equipe do escritório vê, como pré-visualização).
   - habilitado:true   -> todos veem o botão "Conhecer a nova versão"; quem escolher ficará na nova versão neste navegador.
   - ?novaversao=ver / ?novaversao=ocultar -> mostra/oculta o botão só neste navegador (para apresentar à cliente).
   - ?versao=atual  -> volta à versão vigente e lembra a escolha neste navegador.
   Para desfazer tudo: habilitado:false (ou remover este arquivo e a linha <script src="versao-nova.js"> do index.html). */
(function(){
  'use strict';
  var CFG = { habilitado: false, destino: '/novo/' };

  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} return null; }
  var qs = null; try{ qs = new URLSearchParams(location.search); }catch(e){}
  var vers = qs && qs.get('versao');
  var ver = qs && qs.get('novaversao');
  if(vers === 'atual') ls('versaoPreferida', 'atual');
  if(ver === 'ver') ls('versaoNovaVisivel', '1');
  if(ver === 'ocultar') ls('versaoNovaVisivel', null);

  // Quem escolheu a nova versão volta direto para ela, mas só enquanto o convite estiver habilitado (chave geral de desligar).
  if(CFG.habilitado && ls('versaoPreferida') === 'nova' && vers !== 'atual'){
    location.replace(CFG.destino + (location.hash || ''));
    return;
  }

  function ehEscritorio(){ try{ return typeof USUARIO !== 'undefined' && !!USUARIO && USUARIO.papel === 'escritorio'; }catch(e){ return false; } }
  function visivel(){ return CFG.habilitado || ls('versaoNovaVisivel') === '1' || ehEscritorio(); }

  var css = document.createElement('style');
  css.textContent =
    '.vn-bloco{margin:0 12px 6px;padding:12px 14px;border:1px solid var(--nav-line,rgba(255,255,255,.14));border-radius:12px;background:rgba(0,0,0,.12);font-size:11.5px;line-height:1.45;}' +
    '.vn-bloco[hidden]{display:none;}' +
    '.vn-t{font-weight:600;font-size:12.5px;margin-bottom:3px;}' +
    '.vn-p{color:var(--nav-ink-soft,rgba(255,255,255,.7));}' +
    '.vn-p.vn-previa{margin-top:6px;font-style:italic;}' +
    '.vn-btn{display:block;margin-top:9px;padding:8px 10px;border-radius:9px;background:var(--nav-ink,#fff);color:var(--nav-bg,#333);text-align:center;font-weight:600;text-decoration:none;font-size:12px;}' +
    '.vn-btn:hover{opacity:.92;}.vn-btn:focus-visible{outline:2px solid var(--nav-accent,#fff);outline-offset:2px;}';
  document.head.appendChild(css);

  var bloco = null;
  function montar(){
    var nav = document.getElementById('navLateral');
    var marca = nav && nav.querySelector('.nav-brand');
    if(!marca || bloco) return;
    bloco = document.createElement('div');
    bloco.className = 'vn-bloco';
    bloco.hidden = true;
    bloco.innerHTML =
      '<div class="vn-t">Nova versão do portal</div>' +
      '<div class="vn-p">Visual renovado e novidades. Os dados são os mesmos. Você escolhe o momento e pode voltar à versão atual quando quiser.</div>' +
      '<div class="vn-p vn-previa" hidden>Pré-visualização da equipe: a cliente ainda não vê este botão.</div>' +
      '<a class="vn-btn" href="' + CFG.destino + '">Conhecer a nova versão</a>';
    bloco.querySelector('.vn-btn').addEventListener('click', function(){ ls('versaoPreferida', 'nova'); });
    nav.insertBefore(bloco, marca.nextSibling);
    atualizar();
  }
  function atualizar(){
    if(!bloco) return;
    bloco.hidden = !visivel();
    var previa = bloco.querySelector('.vn-previa');
    if(previa) previa.hidden = !!(CFG.habilitado || ls('versaoNovaVisivel') === '1');
  }

  function iniciar(){
    try{
      montar();
      new MutationObserver(function(){ montar(); atualizar(); }).observe(document.body, {childList:true, attributes:true, attributeFilter:['class']});
    }catch(e){ /* nunca atrapalha o portal */ }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
