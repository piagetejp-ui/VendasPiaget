
/* Escola Piaget — V1.5.0-rc1-portal-responsavel
   Inicialização única. Nenhuma função histórica é redirecionada após o login. */
const APP_VERSION_CLEAN='1.5.0-rc1-portal-responsavel';
let appBootedClean=false;


/* Atualização nativa do sistema
   - consulta version.json sem cache;
   - recarrega automaticamente quando a tela está ociosa;
   - preserva operações em preenchimento e mostra um aviso para atualização manual. */
let versionCheckTimerClean=null;
let updateDetectedClean=false;

function hasWorkInProgressClean(){
  try{
    const modal=document.getElementById('modalBack');
    if(modal&&modal.classList.contains('open'))return true;
    const active=document.activeElement;
    if(active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName))return true;
    if(Array.isArray(state?.cart)&&state.cart.length)return true;
    if(state?.secretariaSale){
      const sale=state.secretariaSale;
      if((sale.cart||[]).length||(sale.payments||[]).length)return true;
    }
  }catch(e){}
  return false;
}

function reloadToPublishedVersionClean(version){
  if(updateDetectedClean)return;
  updateDetectedClean=true;
  try{
    const url=new URL(location.href);
    url.searchParams.set('app_version',version);
    url.searchParams.set('_atualizado',Date.now());
    location.replace(url.toString());
  }catch(e){ location.reload(); }
}

function showUpdateNoticeClean(version){
  if(document.getElementById('piagetUpdateNotice'))return;
  const box=document.createElement('div');
  box.id='piagetUpdateNotice';
  box.className='piaget-update-notice';
  box.innerHTML=`<div><strong>Nova versão disponível</strong><span>Conclua o que estiver fazendo e atualize o sistema.</span></div><button type="button">Atualizar agora</button>`;
  box.querySelector('button').addEventListener('click',()=>reloadToPublishedVersionClean(version));
  document.body.appendChild(box);
}

async function checkPublishedVersionClean({forceReload=false}={}){
  try{
    const response=await fetch(`/version.json?t=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(!response.ok)return;
    const published=await response.json();
    const version=String(published.version||'').trim();
    if(!version||version===APP_VERSION_CLEAN)return;
    if(forceReload||!hasWorkInProgressClean())reloadToPublishedVersionClean(version);
    else showUpdateNoticeClean(version);
  }catch(e){ console.warn('version-check',e?.message||e); }
}

function installVersionWatcherClean(){
  const pill=document.getElementById('appVersionPill');
  if(pill)pill.textContent=`v${APP_VERSION_CLEAN}`;
  checkPublishedVersionClean({forceReload:true});
  window.addEventListener('focus',()=>checkPublishedVersionClean());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkPublishedVersionClean();});
  clearInterval(versionCheckTimerClean);
  versionCheckTimerClean=setInterval(()=>checkPublishedVersionClean(),60000);
}

async function renderParentFromQueryClean(){
  const qs=new URLSearchParams(location.search);
  const wantsParent=qs.get('modo')==='pai'||qs.get('retornoCheckout')==='1'||qs.get('retorno')==='checkout';
  if(!wantsParent)return false;
  const saved=localStorage.getItem('vp_parent_student')||'';
  const student=(state.students||[]).find(x=>x.id===saved);
  if(student){
    state.user=null;state.parentStudent=student;state.parentChallenge=null;
    await renderParentPortal();return true;
  }
  enterParent();return true;
}

function installRuntimeGuardClean(){
  window.addEventListener('error',event=>{
    console.error('runtime-clean',event.error||event.message);
    const boot=document.getElementById('bootScreen');
    if(boot&&!boot.classList.contains('hidden')){
      const host=document.getElementById('bootError');host?.classList.remove('hidden');
      if(host)host.innerHTML='<strong>O sistema encontrou um erro ao iniciar.</strong><br>'+esc(event.message||'Erro inesperado.');
      document.getElementById('retryBtn')?.classList.remove('hidden');
    }
  });
}

async function startApplicationClean(){
  if(appBootedClean)return;appBootedClean=true;installRuntimeGuardClean();installVersionWatcherClean();
  try{applyBrandingV122?.();ensureMobileMenuV151?.();}catch(e){console.warn('branding',e)}
  await boot();
  // boot pode ter aberto redefinição de senha, usuário interno ou tela de implantação.
  if(!document.getElementById('bootScreen')?.classList.contains('hidden'))return;
  const qs=new URLSearchParams(location.search);
  if(qs.get('resetAluno')&&qs.get('resetToken'))return;
  if(state.user)return;
  if(await renderParentFromQueryClean())return;
  // Sessão do responsável também pode ser restaurada sem parâmetros após um reload comum.
  const saved=localStorage.getItem('vp_parent_student')||'';
  const student=(state.students||[]).find(x=>x.id===saved);
  if(student&&document.getElementById('roleScreen')&&!document.getElementById('roleScreen').classList.contains('hidden')){
    state.parentStudent=student;await renderParentPortal();
  }
}

window.renderParentFromQuery=renderParentFromQueryClean;
window.checkPublishedVersionClean=checkPublishedVersionClean;
window.startApplicationClean=startApplicationClean;
window.addEventListener('pageshow',event=>{if(event.persisted)checkPublishedVersionClean({forceReload:true});});
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',startApplicationClean,{once:true});
else startApplicationClean();
