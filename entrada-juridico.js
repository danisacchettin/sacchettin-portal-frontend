/* Entrada administrativa do Grupo Super. Não altera cadastro, dados ou sessão do Financeiro. */
(()=>{
 'use strict';
 const JURIDICO_ORIGIN='https://dssj-juridico-grupo-super.onrender.com';
 let child=null;
 async function administrativeSession(){
  // Só uma sessão original, ativa e da Danielle pode sair deste administrador.
  // A conta e a empresa originais são conferidas no servidor atual antes da transmissão.
  if(typeof USUARIO==='undefined'||USUARIO?.papel!=='escritorio'||typeof apiFetch!=='function')return null;
  const users=await apiFetch('/api/admin/usuarios');
  if(!Array.isArray(users))return null;
  for(const token of [localStorage.getItem('portalAdminToken'),localStorage.getItem('portalToken')]){
   if(!token||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))continue;
   let claims;try{const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');claims=JSON.parse(atob(raw));}catch{continue;}
   if(claims.papel!=='escritorio'||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now())continue;
   const original=users.find(u=>String(u.id)===String(claims.sub)&&String(u.empresa_id)===String(claims.empresaId)&&u.ativo===true&&u.papel==='escritorio'&&String(u.email||'').toLowerCase()==='danielle@daniellesacchettin.com.br');
   if(original)return token;
  }
  return null;
 }
 addEventListener('message',async event=>{
  if(event.origin!==JURIDICO_ORIGIN||!child||event.source!==child||event.data?.type!=='dssj-juridico-ready'||!/^[a-f0-9]{64}$/.test(event.data.challenge||''))return;
  let token;try{token=await administrativeSession();}catch{return;}
  if(!token)return;
  child.postMessage({type:'dssj-juridico-session',challenge:event.data.challenge,token},JURIDICO_ORIGIN);
 });
 function enhance(){
  for(const id of ['listaClientesAdmin','listaClientesTab']){ const list=document.getElementById(id);if(!list||list.querySelector('[data-juridico-entry]'))continue;
  if(typeof USUARIO==='undefined'||USUARIO?.papel!=='escritorio')return;
  // A lista existente continua pertencendo ao Financeiro; esta entrada abre somente o módulo Jurídico.
  if(!list.querySelector('button,.cliente-tab-item'))continue;
  const row=document.createElement('div');row.id='grupo-super-juridico-entry-'+id;row.dataset.juridicoEntry='true';row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)';
  const name=document.createElement('div');name.textContent='Grupo Super';const label=document.createElement('small');label.textContent='Portal Jurídico';label.style.cssText='display:block;font-size:11px;color:var(--ink-soft);margin-top:4px';name.append(label);
  const button=document.createElement('button');button.className='btn';button.type='button';button.textContent='Entrar';button.setAttribute('aria-label','Entrar no Portal Jurídico do Grupo Super');button.onclick=()=>{child=window.open(JURIDICO_ORIGIN+'/conectar','dssj-grupo-super');if(!child)alert('Permita abrir a janela do Jurídico para continuar.');};row.append(name,button);list.append(row);}
 }
 new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
})();
