/* Casca da NOVA VERSÃO: marca DSSJ, seletor Jurídico ⇄ Financeiro e "Voltar à versão anterior".
   Só existe em /novo. Não altera dados nem chamadas à API. */
(function(){
  'use strict';
  var CFG = window.DSSJ_CONFIG || {};
  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} return null; }

  function toast(txt){
    var el = document.getElementById('dssjToast');
    if(!el){ el = document.createElement('div'); el.id = 'dssjToast'; el.className = 'dssj-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = txt; el.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(function(){ el.style.display = 'none'; }, 5000);
  }

  function montar(nav){
    if(nav.getAttribute('data-dssj') === '1') return;
    nav.setAttribute('data-dssj', '1');
    var brand = nav.querySelector('.nav-brand');
    if(brand){
      var marca = document.createElement('div');
      marca.className = 'dssj-marca';
      marca.innerHTML = '<img src="assets/DS-principal.svg" alt="" width="30" height="37">' +
        '<div><div class="dssj-nome">Danielle Sacchettin</div><div class="dssj-sub">Soluções Jurídicas para Negócios</div></div>';
      brand.insertBefore(marca, brand.firstChild);

      var troca = document.createElement('div');
      troca.className = 'dssj-troca';
      troca.setAttribute('role', 'group');
      troca.setAttribute('aria-label', 'Trocar de ambiente');
      troca.innerHTML =
        '<button type="button" class="dssj-op ativo" data-amb="financeiro" aria-current="page"><span class="dssj-op-t"></span><span class="dssj-op-s"></span></button>' +
        '<button type="button" class="dssj-op" data-amb="juridico"><span class="dssj-op-t"></span><span class="dssj-op-s"></span></button>';
      var ops = troca.querySelectorAll('.dssj-op');
      ops[0].querySelector('.dssj-op-t').textContent = CFG.rotuloFinanceiro || 'Financeiro';
      ops[0].querySelector('.dssj-op-s').textContent = CFG.subFinanceiro || '';
      ops[1].querySelector('.dssj-op-t').textContent = CFG.rotuloJuridico || 'Jurídico';
      ops[1].querySelector('.dssj-op-s').textContent = CFG.subJuridico || '';
      ops[1].addEventListener('click', function(){
        if(CFG.juridicoUrl){ window.location.href = CFG.juridicoUrl; }
        else toast('O Portal Jurídico ainda não foi ligado a este seletor. Informe o endereço em novo/config.js (juridicoUrl).');
      });
      brand.insertBefore(troca, marca.nextSibling);
    }
    var rodape = nav.querySelector('.nav-rodape');
    if(rodape){
      var selo = document.createElement('span');
      selo.className = 'dssj-selo'; selo.textContent = 'Nova versão';
      rodape.insertBefore(selo, rodape.firstChild);
      rodape.appendChild(document.createElement('br'));
      var a = document.createElement('a');
      a.className = 'dssj-voltar'; a.href = '/?versao=atual';
      a.textContent = '← Voltar à versão anterior';
      a.addEventListener('click', function(){ ls('versaoPreferida', 'atual'); });
      rodape.appendChild(a);
    }
  }

  function procurar(){
    var nav = document.getElementById('navLateral');
    if(nav) montar(nav);
    return !!nav;
  }
  if(!procurar()){
    var mo = new MutationObserver(function(){ if(procurar()) mo.disconnect(); });
    mo.observe(document.body || document.documentElement, {childList:true, subtree:false});
    document.addEventListener('DOMContentLoaded', function(){ procurar(); });
  }
})();
