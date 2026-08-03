
/* =========================================================
   Escola Piaget — V1.3.0
   Acesso interno com Firebase Auth + perfis/permissões
   Responsável: primeiro acesso por matrícula + validação, senha opcional,
   reset somente por secretaria/gestão com link temporário.
   ========================================================= */
const V130_VERSION='1.3.0-dev';
const ACCESS_USERS_V130='usuarios_acesso';
const ACCESS_AUTH_V130='usuarios_auth';
const PARENT_ACCESS_V130='responsaveis_acesso';
const PARENT_RESET_V130='reset_senha_responsavel';
const PARENT_RESET_REQUESTS_V130='solicitacoes_reset_responsavel';

function authObjV130(){return (typeof auth!=='undefined'&&auth)?auth:(firebase.auth?firebase.auth():null)}
function normalizeEmailV130(v){return String(v||'').trim().toLowerCase()}
function roleLabelV130(p){return p==='admin'?'Administrador':p==='gestao'?'Gestão':p==='secretaria'?'Secretaria':p==='cantina'?'Cantina':p==='responsavel'?'Responsável':String(p||'-')}
function roleClassV130(p){return ['admin','gestao','secretaria','cantina'].includes(p)?p:'off'}
function initialAccessUsersV130(){return [
  {id:'lucas',nome:'Lucas Viana',email:'',perfil:'admin',turnos:['manha','tarde'],ativo:true,permissoes:basePermissionsV130('admin'),observacao:'Administrador do sistema'},
  {id:'daniele',nome:'Daniele',email:'',perfil:'secretaria',turnos:['manha'],ativo:true,permissoes:basePermissionsV130('secretaria'),observacao:'Secretaria manhã'},
  {id:'evanda',nome:'Evanda',email:'',perfil:'secretaria',turnos:['tarde'],ativo:true,permissoes:basePermissionsV130('secretaria'),observacao:'Secretaria tarde'},
  {id:'ruan',nome:'Ruan de Jesus',email:'',perfil:'cantina',turnos:['manha','tarde'],ativo:true,permissoes:basePermissionsV130('cantina'),observacao:'Cantina manhã e tarde'}
]}
async function migrateV130Access(){
  const cfgRef=db.collection('configuracoes').doc('sistema'),cfg=await cfgRef.get().catch(()=>null);if(cfg?.data()?.v130Migrado)return;
  const existing=await db.collection(ACCESS_USERS_V130).get().catch(()=>({docs:[]}));const ids=new Set(existing.docs.map(d=>d.id));const batch=db.batch(),now=nowIso();
  for(const u of initialAccessUsersV130()){if(!ids.has(u.id))batch.set(db.collection(ACCESS_USERS_V130).doc(u.id),{...u,authUid:null,criadoEm:now,atualizadoEm:now})}
  batch.set(cfgRef,{versao:V130_VERSION,v130Migrado:true,acessoInterno:'firebase_email_senha',responsavelSenha:true,resetResponsavel:'link_temporario_secretaria',acessoImplantacaoAtivo:true,atualizadoEm:now},{merge:true});
  await batch.commit().catch(e=>console.warn('migrateV130Access',e));
}
function waitAuthReadyV130(){const a=authObjV130();return new Promise(resolve=>{if(!a)return resolve(null);const off=a.onAuthStateChanged(u=>{off();resolve(u)})})}
async function boot(){
  show('bootScreen');$('#bootError').classList.add('hidden');$('#retryBtn').classList.add('hidden');$('#bootText').textContent='Conectando ao Firestore e preparando acessos...';$('#bootProgress').style.width='25%';
  try{
    const cfg=await db.collection('configuracoes').doc('sistema').get();setConnection('Firestore online',true);$('#bootProgress').style.width='55%';
    if(!cfg.exists){show('setupScreen');return}
    state.config=cfg.data();await loadCore();await migrateV130Access();$('#bootProgress').style.width='78%';
    if(await renderParentResetFromQueryV130())return;
    const authUser=await waitAuthReadyV130();$('#bootProgress').style.width='100%';
    if(authUser){const ok=await enterAuthenticatedInternalV130(authUser,{silent:true});if(ok)return}
    renderAccessLandingV130();show('roleScreen')
  }catch(e){console.error(e);setConnection('Sem acesso ao Firestore',false);$('#bootText').textContent='Não foi possível acessar o Firestore.';$('#bootError').classList.remove('hidden');$('#bootError').innerHTML=`${esc(e.message)}<br><br>Durante a transição para acesso seguro, mantenha as regras de desenvolvimento até cadastrar os usuários internos e validar o login.`;$('#retryBtn').classList.remove('hidden')}
}
function renderAccessLandingV130(msg=''){
  const canBootstrap=state.config?.acessoImplantacaoAtivo!==false;
  $('#roleScreen').innerHTML=`<div class="role-box"><div class="access-logo-v130"><img src="${BRAND_V122?.light||BRAND_V120.icon}" alt="Símbolo Escola Piaget"><div><strong>Escola Piaget</strong><span>Vendas, cantina e atendimento</span></div></div>${msg?`<div class="alert ${msg.includes('erro')||msg.includes('não')?'danger':''}" style="margin-bottom:12px">${esc(msg)}</div>`:''}<div class="access-v130"><div class="access-panel-v130"><h3>Acesso da equipe</h3><p>Use o e-mail e a senha cadastrados no Firebase Authentication. O perfil e as permissões são definidos na tela Usuários e acessos.</p><div class="fg"><label>E-mail</label><input id="loginEmailV130" class="fi" type="email" autocomplete="username" placeholder="nome@escolapiaget.com.br"></div><div class="fg"><label>Senha</label><input id="loginPassV130" class="fi" type="password" autocomplete="current-password" placeholder="Senha de acesso"></div><button class="btn btn-primary" style="width:100%" onclick="loginInternalV130()">Entrar no sistema</button><div class="actions" style="margin-top:10px"><button class="btn btn-outline" onclick="sendInternalPasswordResetV130()">Enviar redefinição de senha</button>${canBootstrap?`<button class="btn btn-light" onclick="enterBootstrapAdminV130()">Implantação: entrar como Lucas</button>`:''}</div>${canBootstrap?`<div class="auth-warning-v130"><strong>Modo implantação ativo.</strong> Use apenas para configurar os e-mails e testar a transição. Depois, desative em Usuários e acessos.</div>`:''}</div><div class="access-panel-v130"><h3>Portal do responsável</h3><p>O responsável pode entrar pelo primeiro acesso com matrícula e validação, ou pela senha criada dentro da conta do aluno.</p><button class="btn btn-orange" style="width:100%" onclick="enterParent()">Acessar conta do aluno</button><div class="perm-grid-v130"><div class="perm-chip-v130 ok">Primeiro acesso por matrícula</div><div class="perm-chip-v130 ok">Senha opcional</div><div class="perm-chip-v130 ok">Reset só pela secretaria</div><div class="perm-chip-v130 ok">Link temporário de uso único</div></div></div></div></div>`;
  applyBrandingV122?.();
}
async function loginInternalV130(){
  const email=normalizeEmailV130($('#loginEmailV130')?.value),pass=$('#loginPassV130')?.value||'';if(!email||!pass)return alert('Informe e-mail e senha.');
  try{const cred=await authObjV130().signInWithEmailAndPassword(email,pass);await enterAuthenticatedInternalV130(cred.user)}catch(e){console.error(e);renderAccessLandingV130('Não foi possível entrar. Verifique se o e-mail/senha existem no Firebase Authentication e se o perfil está cadastrado em Usuários e acessos.')}
}
async function sendInternalPasswordResetV130(){const email=normalizeEmailV130($('#loginEmailV130')?.value);if(!email)return alert('Informe o e-mail para enviar a redefinição.');try{await authObjV130().sendPasswordResetEmail(email);toast('E-mail de redefinição enviado.')}catch(e){alert('Não foi possível enviar a redefinição: '+e.message)}}
async function enterAuthenticatedInternalV130(firebaseUser,{silent=false}={}){
  const email=normalizeEmailV130(firebaseUser.email);let profile=null,profileRef=null;
  const byUid=await db.collection(ACCESS_USERS_V130).where('authUid','==',firebaseUser.uid).limit(1).get().catch(()=>({docs:[]}));
  if(byUid.docs.length){profile={id:byUid.docs[0].id,...byUid.docs[0].data()};profileRef=byUid.docs[0].ref}else{
    const byEmail=await db.collection(ACCESS_USERS_V130).where('email','==',email).limit(1).get().catch(()=>({docs:[]}));
    if(byEmail.docs.length){profile={id:byEmail.docs[0].id,...byEmail.docs[0].data()};profileRef=byEmail.docs[0].ref;await profileRef.set({authUid:firebaseUser.uid,vinculadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});profile.authUid=firebaseUser.uid}
  }
  if(!profile||profile.ativo===false){if(!silent)alert('Este e-mail autenticou no Firebase, mas não há perfil ativo no sistema.');await authObjV130().signOut().catch(()=>{});return false}
  await db.collection(ACCESS_AUTH_V130).doc(firebaseUser.uid).set({uid:firebaseUser.uid,usuarioAcessoId:profile.id,nome:profile.nome,email,perfil:profile.perfil,turnos:profile.turnos||[],permissoes:profile.permissoes||basePermissionsV130(profile.perfil),ativo:profile.ativo!==false,atualizadoEm:nowIso()},{merge:true}).catch(()=>{});
  state.user={...profile,id:profile.id,nome:profile.nome,email,authUid:firebaseUser.uid,authEmail:email,perfil:profile.perfil,turnos:profile.turnos||[],permissoes:profile.permissoes||basePermissionsV130(profile.perfil),authMode:'firebase'};
  $('#userPill').textContent=`${state.user.nome} · ${roleLabelV130(state.user.perfil)}`;$('#userPill').classList.remove('hidden');$('#switchUserBtn').textContent='Sair';$('#switchUserBtn').classList.remove('hidden');show('appShell');buildSidebar();navigate('dashboard');await audit('login_interno',{usuarioAcessoId:profile.id,authUid:firebaseUser.uid,email});return true
}
async function enterBootstrapAdminV130(){const u=initialAccessUsersV130()[0];state.user={...u,authMode:'implantacao'};$('#userPill').textContent='Lucas · implantação';$('#userPill').classList.remove('hidden');$('#switchUserBtn').textContent='Sair';$('#switchUserBtn').classList.remove('hidden');show('appShell');buildSidebar();navigate('usuarios');await audit('entrada_implantacao',{aviso:'Acesso provisório usado para configurar usuários.'})}
function selectProfile(id){if(id==='lucas')return enterBootstrapAdminV130();renderAccessLandingV130('O acesso provisório por cartões foi substituído. Entre com e-mail/senha ou use implantação como Lucas para configurar os usuários.');show('roleScreen')}

/* Sidebar e navegação por perfil */

/* Usuários e acessos */
async function renderUsuariosAcessosV130(){
  const [us,rs]=await Promise.all([db.collection(ACCESS_USERS_V130).get().catch(()=>({docs:[]})),db.collection(PARENT_RESET_REQUESTS_V130).orderBy('criadoEm','desc').limit(20).get().catch(()=>({docs:[]}))]);
  const users=us.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.nome.localeCompare(b.nome)),reqs=rs.docs.map(d=>({id:d.id,...d.data()}));
  $('#mainContent').innerHTML=pageHeader('Usuários e acessos','Perfis internos, permissões e reset de acesso dos responsáveis.',`<button class="btn btn-primary" onclick="openUserProfileV130()">Novo perfil</button>`)+`<div class="grid g2"><div class="card"><div class="card-head"><div class="card-title">Equipe interna</div></div><div class="card-body"><div class="alert warn"><strong>Etapa necessária:</strong> crie os e-mails também em Firebase Authentication → Sign-in method → Email/senha. No primeiro login, o sistema vincula automaticamente o UID ao perfil pelo e-mail.</div><div style="margin-top:12px">${users.map(u=>userRowHtmlV130(u)).join('')||'<div class="empty">Nenhum usuário configurado.</div>'}</div></div></div><div class="card"><div class="card-head"><div class="card-title">Permissões por perfil</div></div><div class="card-body"><div class="perm-grid-v130">${['admin','gestao','secretaria','cantina'].map(p=>`<div class="perm-chip-v130"><strong>${roleLabelV130(p)}</strong><br>${basePermissionsV130(p).join(', ')}</div>`).join('')}</div><div class="auth-warning-v130"><strong>Modo implantação:</strong> ${state.config?.acessoImplantacaoAtivo!==false?'ativo':'desativado'}<br><button class="btn btn-outline" style="margin-top:8px" onclick="toggleBootstrapV130(${state.config?.acessoImplantacaoAtivo!==false?'false':'true'})">${state.config?.acessoImplantacaoAtivo!==false?'Desativar':'Ativar'} implantação</button></div></div></div></div><div class="card" style="margin-top:14px"><div class="card-head"><div class="card-title">Acesso dos responsáveis</div></div><div class="card-body"><div class="form-row"><div class="fg"><label>Buscar aluno</label><input id="parentAccessSearchV130" class="fi" placeholder="Nome, matrícula ou turma" oninput="renderResponsibleAccessSearchV130()"></div><div class="fg"><label>Reset solicitado</label><select id="resetFilterV130" class="fi" onchange="renderResetRequestsV130()"><option value="aberto">Abertos</option><option value="todos">Todos</option></select></div></div><div id="responsibleAccessResultsV130" class="search-results"></div><h4 style="margin:18px 0 8px">Solicitações recentes</h4><div id="resetRequestsV130">${reqs.length?reqs.map(r=>`<div class="student-row"><div><strong>${esc(r.alunoNome||'-')}</strong><div class="muted">${esc(r.matricula||'')} · ${esc(r.status||'aberto')} · ${humanDate(r.criadoEm)}</div></div><button class="btn btn-light" onclick="openResponsibleAccessManagerV130('${esc(r.alunoId)}')">Abrir</button></div>`).join(''):'<div class="empty-soft">Nenhuma solicitação recente.</div>'}</div></div></div>`;renderResponsibleAccessSearchV130()
}
function userRowHtmlV130(u){return `<div class="user-row-v130"><div><strong>${esc(u.nome)}</strong><div class="tiny-v130">${esc(u.observacao||'')}</div></div><div>${u.email?esc(u.email):'<span class="muted">E-mail não definido</span>'}<div class="tiny-v130">${u.authUid?'UID vinculado':'UID ainda não vinculado'}</div></div><div><span class="pill-v130 ${roleClassV130(u.perfil)}">${roleLabelV130(u.perfil)}</span></div><div>${u.ativo===false?'<span class="pill-v130 off">Inativo</span>':'<span class="badge b-green">Ativo</span>'}</div><div class="actions"><button class="btn btn-light" onclick="openUserProfileV130('${u.id}')">Editar</button></div></div>`}
async function openUserProfileV130(id=''){
  let u={id:'',nome:'',email:'',perfil:'secretaria',turnos:['manha'],ativo:true,permissoes:basePermissionsV130('secretaria'),observacao:''};if(id){const s=await db.collection(ACCESS_USERS_V130).doc(id).get();if(s.exists)u={id:s.id,...s.data()}}
  openModal(id?'Editar perfil de acesso':'Novo perfil de acesso',`<div class="form-row"><div class="fg"><label>ID interno</label><input id="accIdV130" class="fi" value="${esc(u.id)}" ${id?'disabled':''} placeholder="ex: daniele"></div><div class="fg"><label>Nome</label><input id="accNameV130" class="fi" value="${esc(u.nome)}"></div></div><div class="fg"><label>E-mail de login</label><input id="accEmailV130" class="fi" type="email" value="${esc(u.email||'')}" placeholder="email cadastrado no Firebase Auth"></div><div class="form-row"><div class="fg"><label>Perfil</label><select id="accPerfilV130" class="fi" onchange="accProfileChangedV130()"><option value="admin" ${u.perfil==='admin'?'selected':''}>Administrador</option><option value="gestao" ${u.perfil==='gestao'?'selected':''}>Gestão</option><option value="secretaria" ${u.perfil==='secretaria'?'selected':''}>Secretaria</option><option value="cantina" ${u.perfil==='cantina'?'selected':''}>Cantina</option></select></div><div class="fg"><label>Turnos</label><select id="accTurnosV130" class="fi" multiple><option value="manha" ${(u.turnos||[]).includes('manha')?'selected':''}>Manhã</option><option value="tarde" ${(u.turnos||[]).includes('tarde')?'selected':''}>Tarde</option></select></div></div><div class="fg"><label>Observação</label><input id="accObsV130" class="fi" value="${esc(u.observacao||'')}"></div><label class="switch-line"><span><strong>Usuário ativo</strong><small class="muted">Usuários inativos não entram no sistema.</small></span><input id="accActiveV130" type="checkbox" ${u.ativo!==false?'checked':''}></label><div class="alert warn" style="margin-top:12px">Este cadastro define perfil e permissão no sistema. A conta de autenticação precisa existir no Firebase Authentication com o mesmo e-mail.</div><button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="saveUserProfileV130('${esc(id)}')">Salvar perfil</button>`)
}
function accProfileChangedV130(){}
async function saveUserProfileV130(existingId=''){
  const id=existingId||sanitizeKeyV120($('#accIdV130').value);if(!id)return alert('Informe um ID interno.');const perfil=$('#accPerfilV130').value,turnos=[...$('#accTurnosV130').selectedOptions].map(o=>o.value);const data={id,nome:$('#accNameV130').value.trim(),email:normalizeEmailV130($('#accEmailV130').value),perfil,turnos,ativo:$('#accActiveV130').checked,permissoes:basePermissionsV130(perfil),observacao:$('#accObsV130').value.trim(),atualizadoEm:nowIso()};if(!data.nome)return alert('Informe o nome.');await db.collection(ACCESS_USERS_V130).doc(id).set(data,{merge:true});await audit('perfil_acesso_salvo',{usuarioAcessoId:id,perfil,email:data.email});closeModal();toast('Perfil salvo.');renderUsuariosAcessosV130()
}
async function toggleBootstrapV130(val){await db.collection('configuracoes').doc('sistema').set({acessoImplantacaoAtivo:!!val,atualizadoEm:nowIso()},{merge:true});state.config.acessoImplantacaoAtivo=!!val;await audit('modo_implantacao_alterado',{ativo:!!val});renderUsuariosAcessosV130()}

/* Acesso do responsável */
async function randomTokenV130(bytes=24){const arr=new Uint8Array(bytes);crypto.getRandomValues(arr);return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256V130(text){const enc=new TextEncoder().encode(String(text));const buf=await crypto.subtle.digest('SHA-256',enc);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hashParentPasswordV130(pass,salt){return sha256V130(`${salt}:${pass}`)}
function passwordOkV130(p){return String(p||'').length>=6}
async function requestParentResetV130(){const mat=$('#parentMatricula')?.value.trim();if(!mat)return alert('Informe a matrícula.');const candidates=state.students.filter(a=>a.matricula===mat);if(!candidates.length)return alert('Matrícula não encontrada.');const a=candidates[0];await db.collection(PARENT_RESET_REQUESTS_V130).add({alunoId:a.id,alunoNome:a.nome,matricula:a.matricula,turma:a.turma,status:'aberto',origem:'portal_responsavel',criadoEm:nowIso()});$('#parentMsg').innerHTML='<div class="alert warn" style="margin-top:12px"><strong>Solicitação registrada.</strong><br>Para proteger a conta do aluno, a nova senha precisa ser liberada pela secretaria. Entre em contato com a escola e solicite o link temporário de redefinição.</div>'}
async function injectParentAccessCardV130(){const a=state.parentStudent;if(!a)return;const snap=await db.collection(PARENT_ACCESS_V130).doc(a.id).get().catch(()=>null),ac=snap?.exists?snap.data():null;const target=document.querySelector('#parentScreen .grid.g2');if(!target||document.querySelector('#parentAccessCardV130'))return;target.insertAdjacentHTML('afterend',`<div id="parentAccessCardV130" class="card parent-access-v130"><div class="card-head"><div class="card-title">Senha de acesso do responsável</div>${ac?.ativo?'<span class="badge b-green">Senha ativa</span>':'<span class="badge b-yellow">Senha não criada</span>'}</div><div class="card-body"><p class="muted">A senha facilita os próximos acessos. Por segurança, se esquecer a senha, a redefinição precisa ser liberada pela secretaria.</p><button class="btn ${ac?.ativo?'btn-light':'btn-primary'}" onclick="openParentCreatePasswordV130()">${ac?.ativo?'Alterar minha senha':'Criar senha de acesso'}</button></div></div>`)}
function openParentCreatePasswordV130(){openModal('Senha do responsável',`<div class="alert">Use uma senha com pelo menos 6 caracteres. O sistema não guarda a senha em texto puro.</div><div class="fg" style="margin-top:12px"><label>Nova senha</label><input id="parentNewPassV130" type="password" class="fi" autocomplete="new-password"></div><div class="fg"><label>Confirmar senha</label><input id="parentNewPass2V130" type="password" class="fi" autocomplete="new-password"></div><button class="btn btn-primary" style="width:100%" onclick="saveParentPasswordV130()">Salvar senha</button>`)}
async function saveParentPasswordV130(){const p1=$('#parentNewPassV130')?.value||'',p2=$('#parentNewPass2V130')?.value||'';if(p1!==p2)return alert('As senhas não conferem.');if(!passwordOkV130(p1))return alert('A senha precisa ter pelo menos 6 caracteres.');const a=state.parentStudent,salt=await randomTokenV130(12),hash=await hashParentPasswordV130(p1,salt);await db.collection(PARENT_ACCESS_V130).doc(a.id).set({alunoId:a.id,alunoNome:a.nome,matricula:a.matricula,turma:a.turma,ativo:true,salt,senhaHash:hash,senhaCriadaEm:nowIso(),tentativasInvalidas:0,bloqueadoAte:null,atualizadoEm:nowIso()},{merge:true});await audit('senha_responsavel_criada',{alunoId:a.id});closeModal();toast('Senha salva.');renderParentPortal()}
function renderResponsibleAccessSearchV130(){const q=String($('#parentAccessSearchV130')?.value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const list=state.students.filter(a=>!q||[a.nome,a.matricula,a.turma,a.responsavelFinanceiro].some(v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q))).slice(0,30);const h=$('#responsibleAccessResultsV130');if(h)h.innerHTML=list.map(a=>`<div class="student-row"><div><strong>${esc(a.nome)}</strong><div class="muted">${esc(a.turma)} · Matrícula ${esc(a.matricula)} · Resp.: ${esc(a.responsavelFinanceiro||'-')}</div></div><button class="btn btn-light" onclick="openResponsibleAccessManagerV130('${a.id}')">Gerenciar acesso</button></div>`).join('')||'<div class="empty-soft">Busque por aluno, matrícula ou turma.</div>'}
async function clearParentPasswordV130(alunoId){if(!confirm('Resetar a senha e voltar o acesso para primeiro acesso por validação?'))return;await db.collection(PARENT_ACCESS_V130).doc(alunoId).set({ativo:false,senhaHash:null,salt:null,resetadoPorId:state.user.id,resetadoPorNome:state.user.nome,resetadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});await audit('senha_responsavel_resetada',{alunoId});closeModal();toast('Acesso resetado.')}
async function blockParentAccessV130(alunoId){if(!confirm('Bloquear o acesso com senha deste responsável?'))return;await db.collection(PARENT_ACCESS_V130).doc(alunoId).set({ativo:false,bloqueadoPorId:state.user.id,bloqueadoPorNome:state.user.nome,bloqueadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});await audit('acesso_responsavel_bloqueado',{alunoId});closeModal();toast('Acesso bloqueado.')}

/* Atualiza versão e prepara migração sem apagar histórico. */
/* atualização de versão herdada removida pela V1.5.0-dev2 */



/* =========================================================
   Escola Piaget — Patch V1.3.1
   Correção do acesso do responsável após redefinição de senha.
   ========================================================= */
const V131_VERSION='1.3.1-dev';

function normalizeMatriculaV131(v){return String(v||'').replace(/\D/g,'').trim()}
function findStudentsByMatriculaV131(mat){const m=normalizeMatriculaV131(mat);return (state.students||[]).filter(a=>normalizeMatriculaV131(a.matricula)===m)}
function parentAccessDocV131(alunoId){return db.collection(PARENT_ACCESS_V130).doc(alunoId)}

function setParentSessionV131(a){
  state.user=null;
  state.parentStudent=a;
  state.parentChallenge=null;
  localStorage.setItem('vp_parent_student',a.id);
  $('#userPill').textContent='Responsável · '+String(a.nome||'Aluno').split(' ')[0];
  $('#userPill').classList.remove('hidden');
  $('#switchUserBtn').textContent='Sair';
  $('#switchUserBtn').classList.remove('hidden');
  show('parentScreen');
}

function parentLogoutV131(){
  state.parentStudent=null;
  state.parentChallenge=null;
  localStorage.removeItem('vp_parent_student');
  renderParentLogin();
}

/* Reforça a tela de login do responsável para usar matrícula normalizada e mensagem clara. */
function renderParentLogin(){
  const qs=new URLSearchParams(location.search),mat=qs.get('matricula')||'';
  show('parentScreen');
  $('#parentScreen').innerHTML=`<div class="parent-wrap"><div class="parent-hero"><img src="${BRAND_V122?.dark||BRAND_V120.icon}" class="v122-parent-icon" alt="Símbolo Escola Piaget"><h2>Portal do responsável</h2><p>Pedidos, conta da cantina, autorização e pagamentos.</p></div><div class="card"><div class="card-body"><div class="login-tabs-v130"><button class="btn btn-primary" onclick="showParentPasswordLoginV130()">Entrar com senha</button><button class="btn btn-outline" onclick="showParentFirstAccessV130()">Primeiro acesso</button></div><div id="parentLoginBoxV130"></div><button class="btn btn-outline" style="width:100%;margin-top:8px" onclick="logoutProfile()">Voltar</button><div id="parentMsg"></div></div></div></div>`;
  showParentPasswordLoginV130(mat);
  applyBrandingV122?.();
}

function showParentPasswordLoginV130(mat=''){
  const box=$('#parentLoginBoxV130');
  if(!box)return;
  box.innerHTML=`<div class="fg"><label>Matrícula do aluno</label><input id="parentMatricula" class="fi" value="${esc(normalizeMatriculaV131(mat))}" inputmode="numeric" placeholder="Digite a matrícula"></div><div class="fg"><label>Senha criada pelo responsável</label><input id="parentPasswordV130" class="fi" type="password" autocomplete="current-password" placeholder="Senha"></div><button class="btn btn-orange" style="width:100%" onclick="parentPasswordLoginV130()">Entrar</button><button class="btn btn-light" style="width:100%;margin-top:8px" onclick="requestParentResetV130()">Esqueci minha senha</button><div class="tiny-v130" style="margin-top:9px">Depois que a senha é criada, a redefinição não é automática. A secretaria precisa liberar um novo acesso.</div>`;
}


/* Login por senha: busca por matrícula normalizada, lê o doc exato do aluno e informa melhor o motivo de falha. */

/* Link agora leva resetId + token. O resetId evita ambiguidade e dispensa consultas compostas. */
async function generateParentResetLinkV130(alunoId){
  const a=state.students.find(x=>x.id===alunoId);
  if(!a)return alert('Aluno não encontrado.');
  const token=await randomTokenV130(24),tokenHash=await sha256V130(token),ref=db.collection(PARENT_RESET_V130).doc(),expires=new Date(Date.now()+2*60*60*1000).toISOString(),now=nowIso();
  await ref.set({id:ref.id,alunoId,alunoNome:a.nome,matricula:a.matricula,tokenHash,status:'ativo',usoUnico:true,criadoPorId:state.user?.id||'sistema',criadoPorNome:state.user?.nome||'Sistema',criadoEm:now,expiraEm:expires,versao:'v1.3.1'});
  await audit('link_reset_responsavel_gerado',{alunoId,resetId:ref.id,expiraEm:expires});
  const url=`${location.origin}${location.pathname}?resetId=${encodeURIComponent(ref.id)}&resetAluno=${encodeURIComponent(alunoId)}&resetToken=${encodeURIComponent(token)}`;
  $('#parentResetLinkHostV130').innerHTML=`<div class="reset-link-box-v130">${esc(url)}</div><div class="actions" style="margin-top:8px"><button class="btn btn-light" onclick="navigator.clipboard.writeText('${esc(url)}');toast('Link copiado.')">Copiar link</button></div><div class="tiny-v130" style="margin-top:8px">Válido por 2 horas e uso único. Envie apenas ao responsável confirmado.</div>`;
}

async function findParentResetTokenV131(ctx){
  const tokenHash=await sha256V130(ctx.token);
  if(ctx.resetId){
    const snap=await db.collection(PARENT_RESET_V130).doc(ctx.resetId).get().catch(()=>null);
    if(snap?.exists){
      const x=snap.data()||{};
      if(x.alunoId===ctx.alunoId&&x.status==='ativo'&&x.tokenHash===tokenHash&&new Date(x.expiraEm)>new Date())return {id:snap.id,ref:snap.ref,...x};
    }
    return null;
  }
  /* Compatibilidade com links gerados na V1.3.0, que ainda não tinham resetId na URL. */
  const snaps=await db.collection(PARENT_RESET_V130).where('alunoId','==',ctx.alunoId).get().catch(()=>({docs:[]}));
  for(const d of snaps.docs){
    const x=d.data()||{};
    if(x.status==='ativo'&&x.tokenHash===tokenHash&&new Date(x.expiraEm)>new Date())return {id:d.id,ref:d.ref,...x};
  }
  return null;
}

async function renderParentResetFromQueryV130(){
  const qs=new URLSearchParams(location.search),resetId=qs.get('resetId'),alunoId=qs.get('resetAluno'),token=qs.get('resetToken');
  if(!alunoId||!token)return false;
  const a=state.students.find(x=>x.id===alunoId);
  show('parentScreen');
  if(!a){$('#parentScreen').innerHTML='<div class="parent-wrap"><div class="alert danger">Link inválido: aluno não encontrado.</div></div>';return true}
  state.user=null;
  state.pendingParentResetV130={resetId,alunoId,token};
  $('#parentScreen').innerHTML=`<div class="parent-wrap"><div class="parent-hero"><img src="${BRAND_V122?.dark||BRAND_V120.icon}" class="v122-parent-icon" alt="Símbolo Escola Piaget"><h2>Redefinir senha</h2><p>${esc(a.nome)} · Matrícula ${esc(a.matricula)}</p></div><div class="card"><div class="card-body"><div class="alert">Este link foi liberado pela secretaria. Ele é temporário, de uso único, e dará acesso imediato ao portal depois da troca da senha.</div><div class="fg" style="margin-top:12px"><label>Nova senha</label><input id="resetParentPass1V130" class="fi" type="password" autocomplete="new-password"></div><div class="fg"><label>Confirmar senha</label><input id="resetParentPass2V130" class="fi" type="password" autocomplete="new-password"></div><button id="submitResetParentBtnV131" class="btn btn-primary" style="width:100%" onclick="submitParentResetPasswordV130()">Criar nova senha e entrar</button><div id="resetParentMsgV131"></div></div></div></div>`;
  applyBrandingV122?.();
  return true;
}


/* Atualiza a versão do sistema sem mexer nas regras de negócio. */
/* atualização de versão herdada removida pela V1.5.0-dev2 */



/* =========================================================
   Escola Piaget — Patch V1.3.2
   Auditoria e correção definitiva do portal do responsável
   após criação/redefinição de senha.

   Causa encontrada na V1.3.1:
   o patch V1.3.0 declarava novamente renderParentPortal()
   no mesmo bloco em que tentava capturar window.renderParentPortal.
   Por hoisting, a captura podia apontar para a própria função,
   causando recursão e impedindo a renderização do portal.
   ========================================================= */
const V132_VERSION='1.3.2-dev';

function parentHeroLogoV132(){return (typeof BRAND_V122!=='undefined'&&BRAND_V122?.dark)||(typeof BRAND_V120!=='undefined'&&BRAND_V120.icon)||''}
function setParentSessionV132(a){
  state.user=null;
  state.parentStudent=a;
  state.parentChallenge=null;
  try{localStorage.setItem('vp_parent_student',a.id)}catch(e){}
  const pill=$('#userPill'),sw=$('#switchUserBtn');
  if(pill){pill.textContent='Responsável · '+String(a.nome||'Aluno').split(' ')[0];pill.classList.remove('hidden')}
  if(sw){sw.textContent='Sair';sw.classList.remove('hidden')}
  show('parentScreen');
}

async function parentAccessStatusCardV132(a){
  let ac=null;
  try{const snap=await parentAccessDocV131(a.id).get();ac=snap?.exists?snap.data():null}catch(e){console.warn('parentAccessStatusCardV132',e)}
  const ativa=!!(ac?.ativo&&ac?.senhaHash);
  return `<div id="parentAccessCardV130" class="card parent-access-v130"><div class="card-head"><div class="card-title">Senha de acesso do responsável</div>${ativa?'<span class="badge b-green">Senha ativa</span>':'<span class="badge b-yellow">Senha não criada</span>'}</div><div class="card-body"><p class="muted">A senha facilita os próximos acessos. Por segurança, se esquecer a senha, a redefinição precisa ser liberada pela secretaria.</p><button class="btn ${ativa?'btn-light':'btn-primary'}" onclick="openParentCreatePasswordV130()">${ativa?'Alterar minha senha':'Criar senha de acesso'}</button></div></div>`;
}

/* Renderização autônoma: não depende mais de wrappers/capturas anteriores. */
window.setParentSessionV131=setParentSessionV132;

function parentLogoutV132(){
  state.parentStudent=null;state.parentChallenge=null;
  try{localStorage.removeItem('vp_parent_student')}catch(e){}
  renderParentLogin();
}
window.parentLogoutV131=parentLogoutV132;

window.startParentChallenge=startParentChallenge;

window.answerParentChallenge=answerParentChallenge;

async function parentPasswordLoginV130(){
  const mat=normalizeMatriculaV131($('#parentMatricula')?.value),pass=$('#parentPasswordV130')?.value||'',msg=$('#parentMsg');
  if(!mat||!pass)return alert('Informe matrícula e senha.');
  const candidates=findStudentsByMatriculaV131(mat);
  if(!candidates.length){if(msg)msg.innerHTML='<div class="alert danger" style="margin-top:12px">Matrícula não encontrada.</div>';return}
  let hasPassword=false,blocked=false;
  for(const a of candidates){
    const ref=parentAccessDocV131(a.id),snap=await ref.get().catch(()=>null);if(!snap?.exists)continue;
    const ac=snap.data()||{};
    if(ac.bloqueadoAte&&new Date(ac.bloqueadoAte)>new Date()){blocked=true;continue}
    if(ac.ativo&&ac.senhaHash&&ac.salt){
      hasPassword=true;
      const h=await hashParentPasswordV130(pass,ac.salt);
      if(h===ac.senhaHash){
        await ref.set({tentativasInvalidas:0,bloqueadoAte:null,ultimoAcessoEm:nowIso(),ultimoAcessoMetodo:'senha',atualizadoEm:nowIso()},{merge:true});
        setParentSessionV132(a);
        await audit('login_responsavel_senha',{alunoId:a.id,matricula:a.matricula,origem:'portal_responsavel',versao:'v1.3.2'});
        return renderParentPortal();
      }
    }
  }
  if(blocked){if(msg)msg.innerHTML='<div class="alert danger" style="margin-top:12px">Acesso temporariamente bloqueado por tentativas inválidas. Fale com a secretaria.</div>';return}
  const now=nowIso();
  for(const a of candidates){
    const ref=parentAccessDocV131(a.id),snap=await ref.get().catch(()=>null),n=Number(snap?.data()?.tentativasInvalidas||0)+1;
    await ref.set({alunoId:a.id,alunoNome:a.nome,matricula:a.matricula,tentativasInvalidas:n,bloqueadoAte:n>=5?new Date(Date.now()+15*60*1000).toISOString():null,ultimaTentativaInvalidaEm:now,atualizadoEm:now},{merge:true}).catch(()=>{});
  }
  if(msg)msg.innerHTML=`<div class="alert danger" style="margin-top:12px">${hasPassword?'Senha incorreta.':'Ainda não há senha ativa para esta matrícula ou o acesso foi resetado.'}<br>Após muitas tentativas, o acesso é bloqueado temporariamente.</div>`;
}
window.parentPasswordLoginV130=parentPasswordLoginV130;

async function submitParentResetPasswordV130(){
  const p1=$('#resetParentPass1V130')?.value||'',p2=$('#resetParentPass2V130')?.value||'',ctx=state.pendingParentResetV130,msg=$('#resetParentMsgV131'),btn=$('#submitResetParentBtnV131');
  if(!ctx)return alert('Sessão de redefinição não encontrada. Abra novamente o link enviado pela secretaria.');
  if(p1!==p2)return alert('As senhas não conferem.');
  if(!passwordOkV130(p1))return alert('A senha precisa ter pelo menos 6 caracteres.');
  if(btn){btn.disabled=true;btn.textContent='Salvando senha...'}
  try{
    const found=await findParentResetTokenV131(ctx);
    if(!found){if(msg)msg.innerHTML='<div class="alert danger" style="margin-top:12px">Link inválido, expirado ou já utilizado. Solicite novo link à secretaria.</div>';return}
    const a=state.students.find(x=>x.id===ctx.alunoId);
    if(!a)throw new Error('Aluno não encontrado para este link.');
    const salt=await randomTokenV130(12),hash=await hashParentPasswordV130(p1,salt),now=nowIso(),batch=db.batch();
    batch.set(parentAccessDocV131(ctx.alunoId),{alunoId:ctx.alunoId,alunoNome:a.nome,matricula:a.matricula,turma:a.turma,ativo:true,salt,senhaHash:hash,senhaCriadaEm:now,senhaRedefinidaEm:now,ultimoAcessoEm:now,ultimoAcessoMetodo:'reset_link',tentativasInvalidas:0,bloqueadoAte:null,atualizadoEm:now},{merge:true});
    batch.set(found.ref,{status:'usado',usadoEm:now,usadoPorAlunoId:ctx.alunoId},{merge:true});
    const reqs=await db.collection(PARENT_RESET_REQUESTS_V130).where('alunoId','==',ctx.alunoId).get().catch(()=>({docs:[]}));
    for(const d of reqs.docs){const r=d.data()||{};if((r.status||'aberto')==='aberto')batch.set(d.ref,{status:'atendido',atendidoEm:now,resetId:found.id},{merge:true})}
    await batch.commit();
    setParentSessionV132(a);
    await audit('senha_responsavel_redefinida_link',{alunoId:a.id,resetId:found.id,versao:'v1.3.2'});
    history.replaceState({},'',location.pathname);
    toast('Senha redefinida. Acesso liberado.');
    await renderParentPortal();
  }catch(e){console.error(e);if(msg)msg.innerHTML=`<div class="alert danger" style="margin-top:12px">Não foi possível concluir o acesso: ${esc(e.message||e)}</div>`}
  finally{if(btn){btn.disabled=false;btn.textContent='Criar nova senha e entrar'}}
}
window.submitParentResetPasswordV130=submitParentResetPasswordV130;

/* atualização de versão herdada removida pela V1.5.0-dev2 */



/* =========================================================
   Escola Piaget — Patch V1.3.3
   Segurança do responsável: depois que a senha existe, a
   validação por data/iniciais deixa de abrir o portal.
   ========================================================= */
const V133_VERSION='1.3.3-dev';

async function parentHasActivePasswordV133(alunoId){
  if(!alunoId)return false;
  try{
    const snap=await parentAccessDocV131(alunoId).get();
    if(!snap?.exists)return false;
    const ac=snap.data()||{};
    return !!(ac.ativo && ac.senhaHash && ac.salt);
  }catch(e){
    console.warn('parentHasActivePasswordV133',e);
    return false;
  }
}

async function matriculaHasActivePasswordV133(mat){
  const candidates=findStudentsByMatriculaV131(mat);
  for(const a of candidates){
    if(await parentHasActivePasswordV133(a.id))return {has:true, aluno:a};
  }
  return {has:false, aluno:null};
}

function parentPasswordRequiredMessageV133(mat){
  return `<div class="alert warn" style="margin-top:12px"><strong>Esta conta já tem senha criada.</strong><br>Por segurança, o acesso por data de nascimento ou iniciais fica bloqueado depois que a senha é criada. Entre com matrícula e senha. Caso não lembre, fale com a secretaria para receber um link temporário de redefinição.</div><div class="actions" style="margin-top:10px"><button class="btn btn-orange" onclick="showParentPasswordLoginV130('${esc(normalizeMatriculaV131(mat))}')">Entrar com senha</button><button class="btn btn-light" onclick="requestParentResetV130()">Esqueci minha senha</button></div>`;
}

function showParentFirstAccessV130(){
  const mat=normalizeMatriculaV131($('#parentMatricula')?.value||'');
  const box=$('#parentLoginBoxV130');
  if(!box)return;
  box.innerHTML=`<div class="alert"><strong>Primeiro acesso</strong><br>Use esta opção somente se o responsável ainda não criou senha para esta matrícula. Depois que a senha é criada, o acesso por data de nascimento/iniciais deixa de valer.</div><div class="fg" style="margin-top:12px"><label>Matrícula do aluno</label><input id="parentMatricula" class="fi" value="${esc(mat)}" inputmode="numeric" placeholder="Digite a matrícula"></div><button class="btn btn-primary" style="width:100%" onclick="startParentChallenge()">Continuar com validação</button>`;
  const msg=$('#parentMsg');
  if(msg)msg.innerHTML='';
}
window.showParentFirstAccessV130=showParentFirstAccessV130;

async function startParentChallenge(){
  const mat=normalizeMatriculaV131($('#parentMatricula')?.value||''),candidates=findStudentsByMatriculaV131(mat);
  const msg=$('#parentMsg');
  if(!candidates.length){if(msg)msg.innerHTML='<div class="alert danger" style="margin-top:12px">Matrícula não encontrada.</div>';return}

  const active=await matriculaHasActivePasswordV133(mat);
  if(active.has){
    if(msg)msg.innerHTML=parentPasswordRequiredMessageV133(mat);
    await audit('primeiro_acesso_responsavel_bloqueado_senha_existente',{matricula:mat,alunoId:active.aluno?.id,versao:'v1.3.3'}).catch(()=>{});
    return;
  }

  const lock=Number(sessionStorage.getItem('vp_parent_lock')||0);
  if(Date.now()<lock){if(msg)msg.innerHTML='<div class="alert danger" style="margin-top:12px">Muitas tentativas. Aguarde alguns minutos.</div>';return}
  let type='birth';
  if(candidates.some(a=>!a.dataNascimento)||new Set(candidates.map(a=>a.dataNascimento)).size<candidates.length)type='initials';
  const correct=candidates.map(a=>type==='birth'?a.dataNascimento:initials(a.responsavelFinanceiro));
  const all=state.students.map(a=>type==='birth'?a.dataNascimento:initials(a.responsavelFinanceiro));
  const opts=[...new Set([...correct,...randomUnique(all,4-correct.length,correct)])].sort(()=>Math.random()-.5).slice(0,4);
  state.parentChallenge={mat,candidates,type,attempts:0};
  $('#parentScreen').innerHTML=`<div class="parent-wrap"><div class="parent-hero"><img src="${parentHeroLogoV132()}" class="v122-parent-icon" alt="Símbolo Escola Piaget"><h2>Confirmação rápida</h2><p>${type==='birth'?'Qual é a data de nascimento do aluno?':'Quais são as iniciais do responsável financeiro?'}</p></div><div class="card"><div class="card-body"><div class="choice-grid">${opts.map(o=>`<button class="choice" onclick="answerParentChallenge('${esc(o)}')">${esc(o)}</button>`).join('')}</div><div id="challengeMsg"></div></div></div></div>`;
  applyBrandingV122?.();
}
window.startParentChallenge=startParentChallenge;

async function answerParentChallenge(answer){
  const c=state.parentChallenge;if(!c)return renderParentLogin();
  const active=await matriculaHasActivePasswordV133(c.mat);
  if(active.has){
    state.parentChallenge=null;
    renderParentLogin();
    const msg=$('#parentMsg');
    if(msg)msg.innerHTML=parentPasswordRequiredMessageV133(c.mat);
    await audit('validacao_responsavel_bloqueada_senha_existente',{matricula:c.mat,alunoId:active.aluno?.id,versao:'v1.3.3'}).catch(()=>{});
    return;
  }
  const found=c.candidates.find(a=>(c.type==='birth'?a.dataNascimento:initials(a.responsavelFinanceiro))===answer);
  if(found){setParentSessionV132(found);await audit('login_responsavel_validacao',{alunoId:found.id,tipo:c.type,versao:'v1.3.3'}).catch(()=>{});return renderParentPortal()}
  c.attempts++;
  if(c.attempts>=3){sessionStorage.setItem('vp_parent_lock',String(Date.now()+5*60*1000));renderParentLogin();return}
  $('#challengeMsg').innerHTML=`<div class="alert danger" style="margin-top:12px">Resposta incorreta. Restam ${3-c.attempts} tentativa(s).</div>`;
}
window.answerParentChallenge=answerParentChallenge;

async function openResponsibleAccessManagerV130(alunoId){
  const a=state.students.find(x=>x.id===alunoId);if(!a)return;
  const [ac,reqs,links]=await Promise.all([
    db.collection(PARENT_ACCESS_V130).doc(alunoId).get().catch(()=>null),
    db.collection(PARENT_RESET_REQUESTS_V130).where('alunoId','==',alunoId).get().catch(()=>({docs:[]})),
    db.collection(PARENT_RESET_V130).where('alunoId','==',alunoId).get().catch(()=>({docs:[]}))
  ]);
  const data=ac?.exists?ac.data():null, ativa=!!(data?.ativo&&data?.senhaHash&&data?.salt);
  openModal('Acesso do responsável',`<div class="mini-breakdown"><span><span>Aluno</span><strong>${esc(a.nome)}</strong></span><span><span>Matrícula</span><strong>${esc(a.matricula)}</strong></span><span><span>Status</span><strong>${ativa?'Senha ativa':'Sem senha ativa'}</strong></span>${data?.ultimoAcessoEm?`<span><span>Último acesso</span><strong>${humanDate(data.ultimoAcessoEm)}</strong></span>`:''}</div><div class="alert warn" style="margin-top:12px"><strong>Regra de segurança:</strong> depois que uma senha existe, matrícula + data de nascimento/iniciais não abrem mais o portal. A redefinição deve ser liberada pela secretaria/gestão com link temporário.</div><div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="generateParentResetLinkV130('${alunoId}')">Gerar link temporário</button><button class="btn btn-red" onclick="blockParentAccessV130('${alunoId}')">Bloquear acesso</button></div><div id="parentResetLinkHostV130" style="margin-top:14px"></div><h4>Histórico</h4><div class="tiny-v130">Solicitações: ${reqs.docs.length} · Links gerados: ${links.docs.length}</div><div class="tiny-v130" style="margin-top:8px">O botão de reset para primeiro acesso foi removido do fluxo normal para evitar que alguém com dados básicos do aluno assuma a conta.</div>`)
}
window.openResponsibleAccessManagerV130=openResponsibleAccessManagerV130;

/* atualização de versão herdada removida pela V1.5.0-dev2 */


/* V1.5.0-dev5.2-logo-sharp — logout canônico do botão superior. */
async function logoutProfile(){
  try{closeMobileMenuV151?.()}catch(e){}
  try{if(state.user?.authMode==='firebase'||authObjV130()?.currentUser)await authObjV130()?.signOut()}catch(e){console.warn('logout Firebase',e)}
  state.user=null;state.parentStudent=null;state.parentChallenge=null;state.selectedStudent=null;
  try{localStorage.removeItem('vp_profile');localStorage.removeItem('vp_parent_student');localStorage.removeItem('vp_parent_session');sessionStorage.removeItem('vp_parent_lock')}catch(e){}
  const pill=$('#userPill'),button=$('#switchUserBtn'),menu=$('#v151MenuBtn');
  pill?.classList.add('hidden');button?.classList.add('hidden');menu?.classList.add('hidden');
  if(button)button.textContent='Trocar acesso';
  try{history.replaceState({},'',location.pathname)}catch(e){}
  renderAccessLandingV130();show('roleScreen');
}
window.logoutProfile=logoutProfile;
