
/* Escola Piaget — V1.5.0-dev4-clean
   Inicialização única. Nenhuma função histórica é redirecionada após o login. */
const APP_VERSION_CLEAN='1.5.0-dev4-clean';
let appBootedClean=false;

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
  if(appBootedClean)return;appBootedClean=true;installRuntimeGuardClean();
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
window.addEventListener('DOMContentLoaded',startApplicationClean,{once:true});
