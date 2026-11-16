/* Entrada administrativa do Grupo Super. Não altera cadastro, dados ou sessão do Financeiro. */
(()=>{
 'use strict';
 const JURIDICO_ORIGIN='https://dssj-juridico-grupo-super.onrender.com';
 let child=null;
 addEventListener('message',event=>{
  if(event.origin!==JURIDICO_ORIGIN||!child||event.source!==child||event.data?.type!=='dssj-juridico-ready'||!/^[a-f0-9]{64}$/.test(event.data.challenge||''))return;
  const token=localStorage.getItem('portalAdminToken')||localStorage.getItem('portalToken');
  if(!token)return;
  child.postMessage({type:'dssj-juridico-session',challenge:event.data.challenge,token},JURIDICO_ORIGIN);
 });
 function enhance(){
  const list=document.getElementById('listaClientesAdmin');if(!list||document.getElementById('grupo-super-juridico-entry'))return;
  if(typeof USUARIO==='undefined'||USUARIO?.papel!=='escritorio')return;
  // A lista existente continua pertencendo ao Financeiro; esta entrada abre somente o módulo Jurídico.
  if(!list.querySelector('button'))return;
  const row=document.createElement('div');row.id='grupo-super-juridico-entry';row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)';
  const name=document.createElement('div');name.textContent='Grupo Super';const label=document.createElement('small');label.textContent='Portal Jurídico';label.style.cssText='display:block;font-size:11px;color:var(--ink-soft);margin-top:4px';name.append(label);
  const button=document.createElement('button');button.className='btn';button.type='button';button.textContent='Entrar';button.setAttribute('aria-label','Entrar no Portal Jurídico do Grupo Super');button.onclick=()=>{child=window.open(JURIDICO_ORIGIN+'/conectar','dssj-grupo-super');if(!child)alert('Permita abrir a janela do Jurídico para continuar.');};row.append(name,button);list.append(row);
 }
 new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
})();
