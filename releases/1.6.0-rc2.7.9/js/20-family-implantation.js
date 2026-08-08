/* Escola Piaget — RC2.7
   Meu Piaget, famílias, conta financeira compartilhada e marco de implantação.
   Camada aditiva: preserva os fluxos operacionais validados e troca apenas
   identidade/acesso/conta familiar quando a base oficial 2026 estiver preparada. */
(function(){
'use strict';
const VERSION='1.6.0-rc2.7.9';
const FAMILY_STUDENT_KEY='vp_parent_student';
let LEGACY_FAMILY_SESSION_V176='';try{LEGACY_FAMILY_SESSION_V176=localStorage.getItem('vp_family_session')||'';localStorage.removeItem('vp_family_session')}catch(_){} /* migração única: sessão passa a HttpOnly */
const BASE_RENDER_PARENT=window.renderParentPortal;
const BASE_RENDER_CONFIG=window.renderConfig;
const BASE_LOGOUT=window.logoutProfile;
const BASE_GET_ALL=window.getAll;

function activeFamilyModeV167(){
 const mode=String(window.PIAGET_ENTRY_MODE||'').toLowerCase();
 if(mode==='family')return true;
 if(mode==='team')return false;
 const qs=new URLSearchParams(location.search);
 return location.pathname.endsWith('/meu-piaget.html')||qs.get('modo')==='pai'||qs.has('resetFamilia');
}
function familyModelEnabledV167(){return Boolean(state?.config?.baseOficial2026Preparada&&state?.config?.modeloContaFinanceira==='responsavel')}
function studentV167(id){return (state.students||[]).find(x=>x.id===id)||null}
function familyResponsibleIdV167(studentOrId){const a=typeof studentOrId==='string'?studentV167(studentOrId):studentOrId;return a?.contaFinanceiraId||a?.responsavelFinanceiroId||null}
function linkedStudentsV167(responsavelId){return (state.students||[]).filter(a=>a.ativo!==false&&familyResponsibleIdV167(a)===responsavelId).sort((a,b)=>Number(a.ordemTurma||999)-Number(b.ordemTurma||999)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'))}

window.financialAccountRefV167=function(alunoId){
 const rid=familyModelEnabledV167()?familyResponsibleIdV167(alunoId):null;
 return rid?db.collection('contas_responsaveis').doc(String(rid)):db.collection('contas_alunos').doc(String(alunoId));
};
window.financialAccountsSnapshotV167=async function(){
 if(!familyModelEnabledV167())return db.collection('contas_alunos').get();
 const snap=await db.collection('contas_responsaveis').get();
 const docs=snap.docs.map(d=>{
   const children=linkedStudentsV167(d.id),primary=children[0];
   const data={...d.data(),responsavelId:d.id,alunosIds:children.map(a=>a.id),alunoPrincipalId:primary?.id||null,quantidadeAlunosAtivos:children.length};
   return {id:primary?.id||d.id,ref:d.ref,exists:true,data:()=>data};
 });
 return {docs,size:docs.length,empty:!docs.length};
};
window.financialAccountsRowsV167=async function(){const s=await financialAccountsSnapshotV167();return s.docs.map(d=>({id:d.id,...d.data()}))};

/* A leitura canônica passa a usar a conta da família quando a base já foi preparada. */
window.getAccount=getAccount=async function(alunoId){
 const ref=financialAccountRefV167(alunoId),snap=await ref.get();
 const student=studentV167(alunoId),base=snap.exists?snap.data():{};
 const net=typeof accountNetV141==='function'?accountNetV141(base):Number(base.saldoContaCentavos??(Number(base.saldoCreditoCentavos||0)-Number(base.dividaCentavos||0)));
 const familyCount=student?.responsavelFinanceiroId?linkedStudentsV167(student.responsavelFinanceiroId).length:1;
 const defaultMax=Number(state.config?.limiteMaximoFiadoCentavos||5000)*Math.max(1,familyCount);
 return {alunoId,responsavelId:familyResponsibleIdV167(student),saldoCreditoCentavos:Math.max(0,net),dividaCentavos:Math.max(0,-net),saldoContaCentavos:net,autorizadoSemSaldo:false,limiteFiadoCentavos:0,limiteMaximoFamiliaCentavos:defaultMax,bloqueioManual:false,bloqueadoPorLimite:false,bloqueioSaldoSemanal:false,...base};
};

/* O carregador operacional antigo usa getAll('contas_alunos'). Esta ponte devolve
   uma linha por família, evitando dupla contagem de irmãos em Cobranças/KPIs. */
if(typeof BASE_GET_ALL==='function'){
 window.getAll=getAll=async function(name){if(name==='contas_alunos')return financialAccountsRowsV167();return BASE_GET_ALL(name)};
}

function setFamilyHeaderV167(){
 const title=document.querySelector('.brand h1'),sub=document.querySelector('.brand small');
 if(title)title.textContent=activeFamilyModeV167()?'Meu Piaget':'Escola Piaget';
 if(sub)sub.textContent=activeFamilyModeV167()?'O espaço da família':'Equipe Piaget · operação interna';
 document.title=activeFamilyModeV167()?'Meu Piaget — Escola Piaget':'Equipe Piaget — Escola Piaget';
}
function formatCpfInputV167(v){const d=String(v||'').replace(/\D/g,'').slice(0,11);return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')}
/* RC2.7.6 — a sessão familiar deixa de ficar no localStorage.
   O servidor mantém um cookie HttpOnly e entrega um Firebase Custom Token
   temporário apenas para autorizar as leituras/escritas permitidas pelas Rules. */
const BASE_FETCH_V167=window.fetch.bind(window);
window.fetch=async function(input,init={}){
 try{
   const raw=typeof input==='string'?input:(input?.url||''),url=new URL(raw,location.href);
   if(url.origin===location.origin&&url.pathname.startsWith('/api/')){
     const headers=new Headers(init.headers||(typeof input!=='string'?input?.headers:undefined)||{});
     if(!activeFamilyModeV167()){
       const current=typeof authObjV130==='function'?authObjV130()?.currentUser:null;
       if(current){try{const staffToken=await current.getIdToken();if(staffToken)headers.set('Authorization',`Bearer ${staffToken}`)}catch(_){}}
     }
     init={...init,headers,credentials:'same-origin'};
   }
 }catch(_){}
 return BASE_FETCH_V167(input,init);
};
async function familyApiV167(acao,data={}){
 const r=await fetch('/api/acesso-meu-piaget',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,...data})}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível concluir agora.');return j;
}
async function familySecurityApiV176(acao,data={}){
 const r=await fetch('/api/familias?modulo=security',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,...data})}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível validar a segurança do acesso.');return j;
}
async function staffApiV167(path,data={}){
 const user=authObjV130()?.currentUser;if(!user)throw new Error('Entre novamente no acesso da equipe.');const token=await user.getIdToken();const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(data)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível concluir a operação.');return j;
}
async function activateFamilyFirebaseV176(payload){
 const a=authObjV130();if(!a||!payload?.firebaseToken)throw new Error('Não foi possível validar a sessão segura do Meu Piaget.');
 try{await a.setPersistence(firebase.auth.Auth.Persistence.NONE)}catch(_){}
 await a.signInWithCustomToken(payload.firebaseToken);
}
function familyStudentsV167(){return state.parentFamily?.alunos||[]}
function resolveFamilyStudentV167(apiStudent){return studentV167(apiStudent?.id)||apiStudent||null}
async function applyFamilyPayloadV167(payload){
 await activateFamilyFirebaseV176(payload);
 state.parentFamily={responsavelId:payload.responsavelId,alunos:payload.alunos||[],conta:payload.conta||{}};
 /* No Meu Piaget a lista global contém somente os alunos desta família. */
 state.students=(payload.alunos||[]).map(a=>({...a,ativo:true,contaFinanceiraId:a.contaFinanceiraId||a.responsavelFinanceiroId||payload.responsavelId}));
 const saved=localStorage.getItem(FAMILY_STUDENT_KEY),apiStudent=state.students.find(a=>a.id===saved)||state.students[0];
 state.user=null;state.parentStudent=apiStudent||null;state.parentChallenge=null;
 if(state.parentStudent)localStorage.setItem(FAMILY_STUDENT_KEY,state.parentStudent.id);
}

async function loadFamilyCoreV167(){
 const [cfg,ps,ss,ms,ds,cs,is]=await Promise.all([
   db.collection('configuracoes').doc('sistema').get(),
   db.collection('produtos').get().catch(()=>({docs:[]})),
   db.collection('estoques').get().catch(()=>({docs:[]})),
   db.collection('modelos_farda').get().catch(()=>({docs:[]})),
   db.collection('disponibilidade_salgados').doc(dateKey()).get().catch(()=>({exists:false,data:()=>({})})),
   db.collection('catalogo_categorias').get().catch(()=>({docs:[]})),
   db.collection('catalogo_itens').get().catch(()=>({docs:[]}))
 ]);
 if(!cfg.exists)throw new Error('O Meu Piaget ainda não está disponível.');
 state.config=cfg.data()||{};state.products=ps.docs.map(d=>({id:d.id,...d.data()}));state.inventory=ss.docs.map(d=>({id:d.id,...d.data()}));state.uniformModels=ms.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false);state.catalogCategories=cs.docs.map(d=>({id:d.id,...d.data()}));state.catalogItems=is.docs.map(d=>({id:d.id,...d.data()}));
 state.dailyCapacity=ds.exists?ds.data():{dataChave:dateKey(),quantidadePlanejada:Number(state.config?.quantidadePadraoSalgados||30),vendidoDinheiro:0,vendidoAvulso:0,consumoConta:0,pedidosConfirmados:0,reservas:{}};
 if(!state.config.baseOficial2026Preparada||!state.config.meuPiagetAtivo)throw new Error('O Meu Piaget ainda está sendo preparado pela escola.');
}

window.renderMeuPiagetLoginV167=function(message=''){
 setFamilyHeaderV167();show('parentScreen');$('#connectionPill')?.classList.add('hidden');$('#userPill')?.classList.add('hidden');$('#switchUserBtn')?.classList.add('hidden');
 $('#parentScreen').innerHTML=`<div class="parent-wrap v167-login-wrap"><div class="parent-hero"><img src="${BRAND_V122?.dark||BRAND_V120.icon}" class="v122-parent-icon" alt="Escola Piaget"><h2>Meu Piaget</h2><p>Compras, pedidos e informações dos alunos em um só lugar.</p></div><div class="card"><div class="card-body">${message?`<div class="alert" style="margin-bottom:12px">${esc(message)}</div>`:''}<div class="login-tabs-v130"><button class="btn btn-primary" onclick="renderFamilyPasswordLoginV167()">Entrar</button><button class="btn btn-outline" onclick="renderFamilyFirstAccessV167()">Primeiro acesso</button></div><div id="familyLoginHostV167"></div></div></div></div>`;
 renderFamilyPasswordLoginV167();applyBrandingV122?.();
};
window.renderFamilyPasswordLoginV167=function(){const h=$('#familyLoginHostV167');if(!h)return;h.innerHTML=`<div class="fg"><label>CPF</label><input id="familyCpfV167" class="fi" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00" oninput="this.value=formatCpfInputV167(this.value)"></div><div class="fg"><label>Senha</label><input id="familyPassV167" class="fi" type="password" autocomplete="current-password" placeholder="Sua senha"></div><button id="familyLoginBtnV178" class="btn btn-orange" style="width:100%" onclick="familyPasswordLoginV167()">Entrar no Meu Piaget</button><button class="btn btn-light" style="width:100%;margin-top:8px" onclick="renderFamilyForgotV167()">Esqueci minha senha</button><div id="familyLoginMsgV167"></div>`;enhancePasswordFieldsV156?.()};
window.renderFamilyFirstAccessV167=function(){const h=$('#familyLoginHostV167');if(!h)return;h.innerHTML=`<div class="alert"><strong>Primeiro acesso</strong><br>Informe o CPF do responsável financeiro e a matrícula de qualquer aluno vinculado.</div><div class="fg" style="margin-top:12px"><label>CPF</label><input id="familyFirstCpfV167" class="fi" inputmode="numeric" placeholder="000.000.000-00" oninput="this.value=formatCpfInputV167(this.value)"></div><div class="fg"><label>Matrícula do aluno</label><input id="familyFirstMatV167" class="fi" inputmode="numeric" placeholder="Matrícula"></div><button class="btn btn-orange" style="width:100%" onclick="validateFamilyFirstAccessV167()">Continuar</button><div id="familyLoginMsgV167"></div>`};
window.renderFamilyForgotV167=function(){const h=$('#familyLoginHostV167');if(!h)return;h.innerHTML=`<div class="alert"><strong>Redefinição de senha</strong><br>A Secretaria libera um link temporário e pode enviá-lo pelo WhatsApp.</div><div class="fg" style="margin-top:12px"><label>CPF</label><input id="familyForgotCpfV167" class="fi" inputmode="numeric" placeholder="000.000.000-00" oninput="this.value=formatCpfInputV167(this.value)"></div><button class="btn btn-primary" style="width:100%" onclick="requestFamilyResetV167()">Solicitar redefinição</button><button class="btn btn-light" style="width:100%;margin-top:8px" onclick="renderFamilyPasswordLoginV167()">Voltar</button><div id="familyLoginMsgV167"></div>`};
window.formatCpfInputV167=formatCpfInputV167;
window.familyPasswordLoginV167=async function(){const host=$('#familyLoginMsgV167'),btn=$('#familyLoginBtnV178'),old=btn?.innerHTML;try{if(btn){btn.disabled=true;btn.innerHTML='<span class="v178-login-spinner" aria-hidden="true"></span> Entrando…'}if(host)host.innerHTML='<div class="v151-inline-loader">Preparando seu Meu Piaget...</div>';const d=await familyApiV167('login',{cpf:$('#familyCpfV167')?.value||'',senha:$('#familyPassV167')?.value||''});await applyFamilyPayloadV167(d);await loadFamilyCoreV167();await renderParentPortal()}catch(e){if(host)host.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.innerHTML=old||'Entrar no Meu Piaget'}}};
window.validateFamilyFirstAccessV167=async function(){const host=$('#familyLoginMsgV167');try{if(host)host.innerHTML='<div class="v151-inline-loader">Validando cadastro...</div>';const d=await familyApiV167('validar_primeiro_acesso',{cpf:$('#familyFirstCpfV167')?.value||'',matricula:$('#familyFirstMatV167')?.value||''});state.familyActivationV167=d;const h=$('#familyLoginHostV167');h.innerHTML=`<div class="alert"><strong>Cadastro localizado.</strong><br>${Number(d.quantidadeAlunos||1)>1?`${d.quantidadeAlunos} alunos estão vinculados a este acesso.`:'Aluno localizado.'} Crie sua senha.</div><div class="fg" style="margin-top:12px"><label>Nova senha</label><input id="familyNewPass1V167" class="fi" type="password" autocomplete="new-password"></div><div class="fg"><label>Confirmar senha</label><input id="familyNewPass2V167" class="fi" type="password" autocomplete="new-password"></div><button class="btn btn-orange" style="width:100%" onclick="createFamilyPasswordV167()">Criar senha e entrar</button><div id="familyLoginMsgV167"></div>`;enhancePasswordFieldsV156?.()}catch(e){if(host)host.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}};
window.createFamilyPasswordV167=async function(){const a=state.familyActivationV167,p1=$('#familyNewPass1V167')?.value||'',p2=$('#familyNewPass2V167')?.value||'',host=$('#familyLoginMsgV167');if(p1!==p2)return host.innerHTML='<div class="alert danger">As senhas não coincidem.</div>';try{const d=await familyApiV167('criar_senha',{activationId:a?.activationId,activationToken:a?.activationToken,senha:p1});await applyFamilyPayloadV167(d);await loadFamilyCoreV167();await renderParentPortal()}catch(e){host.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}};
window.requestFamilyResetV167=async function(){const host=$('#familyLoginMsgV167');try{const d=await familyApiV167('solicitar_reset',{cpf:$('#familyForgotCpfV167')?.value||''});host.innerHTML=`<div class="alert warn"><strong>Solicitação registrada.</strong><br>${esc(d.mensagem||'Entre em contato com a Secretaria.')}</div>`}catch(e){host.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}};

async function renderFamilyResetFromQueryV167(){const q=new URLSearchParams(location.search),resetId=q.get('resetFamilia'),token=q.get('resetToken');if(!resetId||!token)return false;show('parentScreen');setFamilyHeaderV167();$('#parentScreen').innerHTML=`<div class="parent-wrap"><div class="parent-hero"><img src="${BRAND_V122?.dark||BRAND_V120.icon}" class="v122-parent-icon" alt="Escola Piaget"><h2>Redefinir senha</h2><p>Meu Piaget</p></div><div class="card"><div class="card-body"><div class="alert">Este link foi liberado pela Secretaria e é temporário.</div><div class="fg" style="margin-top:12px"><label>Nova senha</label><input id="familyResetPass1V167" class="fi" type="password" autocomplete="new-password"></div><div class="fg"><label>Confirmar senha</label><input id="familyResetPass2V167" class="fi" type="password" autocomplete="new-password"></div><button class="btn btn-primary" style="width:100%" onclick="submitFamilyResetV167('${esc(resetId)}','${esc(token)}')">Salvar senha e entrar</button><div id="familyResetMsgV167"></div></div></div></div>`;enhancePasswordFieldsV156?.();return true}
window.submitFamilyResetV167=async function(resetId,token){const h=$('#familyResetMsgV167'),p1=$('#familyResetPass1V167')?.value||'',p2=$('#familyResetPass2V167')?.value||'';if(p1!==p2)return h.innerHTML='<div class="alert danger">As senhas não coincidem.</div>';try{const d=await familyApiV167('redefinir_senha',{resetId,resetToken:token,senha:p1});history.replaceState({},'',location.pathname);await applyFamilyPayloadV167(d);await loadFamilyCoreV167();await renderParentPortal()}catch(e){h.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}};

window.bootFamilyV167=async function(){
 show('bootScreen');setFamilyHeaderV167();$('#bootError')?.classList.add('hidden');$('#retryBtn')?.classList.add('hidden');if($('#bootText'))$('#bootText').textContent='Preparando o Meu Piaget...';if($('#bootProgress'))$('#bootProgress').style.width='30%';
 try{state.students=[];if(await renderFamilyResetFromQueryV167())return;if($('#bootProgress'))$('#bootProgress').style.width='55%';try{let d;try{d=await familyApiV167('sessao')}catch(first){if(!LEGACY_FAMILY_SESSION_V176)throw first;d=await familyApiV167('sessao',{sessionToken:LEGACY_FAMILY_SESSION_V176});LEGACY_FAMILY_SESSION_V176=''}await applyFamilyPayloadV167(d);await loadFamilyCoreV167();if($('#bootProgress'))$('#bootProgress').style.width='100%';return renderParentPortal()}catch(_){try{await authObjV130()?.signOut()}catch(__){}if($('#bootProgress'))$('#bootProgress').style.width='100%';return renderMeuPiagetLoginV167()}}catch(e){console.error('bootFamily',e);if($('#bootText'))$('#bootText').textContent='Não foi possível abrir o Meu Piaget.';const h=$('#bootError');h?.classList.remove('hidden');if(h)h.innerHTML=esc(e.message||'Tente novamente em instantes.');const b=$('#retryBtn');b?.classList.remove('hidden');if(b)b.onclick=()=>bootFamilyV167()}
};

function familySwitcherHtmlV167(){const all=familyStudentsV167();if(all.length<2)return'';return `<div class="v167-family-switcher"><div><small>Aluno selecionado</small><strong>${esc(state.parentStudent?.nome||'')}</strong></div><select class="fi" aria-label="Trocar aluno" onchange="switchFamilyStudentV167(this.value)">${all.map(a=>`<option value="${esc(a.id)}" ${a.id===state.parentStudent?.id?'selected':''}>${esc(a.nome)} — ${esc(a.turma)}</option>`).join('')}</select></div>`}
window.switchFamilyStudentV167=async function(id){const allowed=familyStudentsV167().find(a=>a.id===id);if(!allowed)return;state.parentStudent=resolveFamilyStudentV167(allowed);localStorage.setItem(FAMILY_STUDENT_KEY,id);await renderParentPortal()};
window.openFamilyNotificationOrderV167=async function(alunoId,pedidoId){const allowed=familyStudentsV167().find(a=>a.id===alunoId);if(allowed){state.parentStudent=resolveFamilyStudentV167(allowed);localStorage.setItem(FAMILY_STUDENT_KEY,allowed.id)}await openParentOrdersV151(pedidoId)};
window.renderParentPortal=renderParentPortal=async function(){
 if(!state.parentStudent)return activeFamilyModeV167()?renderMeuPiagetLoginV167():renderParentLogin();
 await BASE_RENDER_PARENT();setFamilyHeaderV167();
 const wrap=$('#parentScreen .parent-wrap');if(!wrap)return;
 const old=$('#v167FamilyContext');old?.remove();
 const all=familyStudentsV167(),shared=all.length>1;
 const context=document.createElement('div');context.id='v167FamilyContext';context.innerHTML=`${familySwitcherHtmlV167()}${shared?`<div class="alert v167-family-account-note"><strong>Conta da família</strong><br>O saldo, a autorização e o limite são compartilhados entre ${all.length} alunos. Pedidos e entregas continuam vinculados individualmente ao aluno selecionado.</div>`:''}`;
 wrap.insertBefore(context,wrap.children[1]||null);
 if(shared){const small=document.querySelector('.v151-balance small');if(small)small.firstChild.textContent='Saldo da família ';}
};

/* Quando há irmãos, o saldo é único; o extrato também precisa explicar todos os
   movimentos que alteraram essa mesma conta, preservando o aluno de origem. */
window.openParentMovementsV151=openParentMovementsV151=async function(){
 const all=familyStudentsV167().length?familyStudentsV167():[state.parentStudent].filter(Boolean);openModal(all.length>1?'Movimentações da família':'Movimentações da conta','<div class="v151-inline-loader">Carregando movimentações...</div>');
 try{
   const packs=await Promise.all(all.map(async a=>{const [m,c]=await Promise.all([db.collection('movimentos_conta').where('alunoId','==',a.id).get().catch(()=>({docs:[]})),db.collection('pagamentos_checkout').where('alunoId','==',a.id).get().catch(()=>({docs:[]}))]);return{a,m,c}}));
   const checkouts=packs.flatMap(x=>x.c.docs.map(d=>({id:d.id,...d.data()}))),rows=packs.flatMap(x=>x.m.docs.map(d=>({id:d.id,...d.data(),_alunoNome:x.a.nome}))).sort((x,y)=>String(y.criadoEm||'').localeCompare(String(x.criadoEm||''))).slice(0,160);
   $('#modalBody').innerHTML=rows.length?`<div class="v151-list">${rows.map(m=>{const v=movementAmountV151(m),checkout=checkouts.find(c=>(m.orderNsu&&(c.orderNsu||c.id)===m.orderNsu)||(m.pedidoId&&c.pedidoId===m.pedidoId)),orderNsu=m.orderNsu||checkout?.orderNsu||checkout?.id||'';return`<div class="v151-ledger-card"><div><strong>${humanDate(m.criadoEm)}</strong><div class="muted" style="font-size:11px">${all.length>1?`${esc(m._alunoNome)} · `:''}${esc(methodLabelV151(m.formaPagamento||m.origem))}</div></div><div><strong>${esc(movementLabelV151(m))}</strong><div class="muted" style="font-size:12px;margin-top:3px">${movementDescriptionV151(m)}</div>${m.saldoDepoisCentavos!==undefined?`<div class="muted" style="font-size:11px;margin-top:4px">Saldo da família após: ${signedV151(m.saldoDepoisCentavos)}</div>`:''}${['confirmado','aplicado'].includes(String(m.status||'confirmado'))?`<button class="v156-receipt-link" onclick="openParentReceiptMenuV156('${m.id}','${esc(orderNsu)}')">Comprovante</button>`:''}</div><div class="amount ${v>=0?'in':'out'}">${signedV151(v)}</div></div>`}).join('')}</div>`:'<div class="empty">Nenhuma movimentação registrada.</div>';
 }catch(e){$('#modalBody').innerHTML='<div class="alert danger">Não foi possível carregar as movimentações.</div>'}
};

function familyMaxLimitV167(){const n=familyStudentsV167().length||1;return Number(state.parentFamily?.conta?.limiteMaximoFamiliaCentavos||Number(state.config?.limiteMaximoFiadoCentavos||5000)*n)}
window.openParentAuthorizationV151=openParentAuthorizationV151=async function(){const a=state.parentStudent,acc=await getAccount(a.id),max=familyMaxLimitV167(),shared=familyStudentsV167().length>1;openModal('Autorizações e limite',`<div class="v151-student-summary"><div class="big">${shared?'Conta da família':esc(a.nome)}</div><div>Saldo atual: <strong>${signedV151(netV151(acc))}</strong></div>${shared?`<div class="muted">Válido para ${familyStudentsV167().length} alunos vinculados.</div>`:''}</div><div class="switch-line" style="margin-top:12px"><div><strong>Permitir compra sem saldo</strong><div class="muted">As compras podem usar o limite financeiro compartilhado.</div></div><div id="v151AuthSwitch" class="switch ${acc.autorizadoSemSaldo?'on':''}" onclick="this.classList.toggle('on')"></div></div><div class="fg" style="margin-top:12px"><label>Limite — máximo ${fmt(max)}</label><input id="v151AuthLimit" class="fi" type="number" min="0" max="${max/100}" step="1" value="${Number(acc.limiteFiadoCentavos||0)/100}"></div><button class="btn btn-primary" style="width:100%" onclick="saveParentAuthorizationV151()">Salvar autorização</button>`)};
window.saveParentAuthorizationV151=saveParentAuthorizationV151=async function(){const a=state.parentStudent,max=familyMaxLimitV167(),on=$('#v151AuthSwitch').classList.contains('on'),limit=Math.max(0,Math.min(max,Math.round(Number($('#v151AuthLimit').value||0)*100)));const saved=await familySecurityApiV176('update_family_preferences',{autorizadoSemSaldo:on,limiteFiadoCentavos:limit});state.parentFamily.conta={...state.parentFamily.conta,autorizadoSemSaldo:Boolean(saved.autorizadoSemSaldo),limiteFiadoCentavos:Number(saved.limiteFiadoCentavos||0),bloqueadoPorLimite:Boolean(saved.bloqueadoPorLimite),limiteMaximoFamiliaCentavos:Number(saved.limiteMaximoFamiliaCentavos||max)};await audit('autorizacao_responsavel',{alunoId:a.id,responsavelId:familyResponsibleIdV167(a),autorizado:on,limiteCentavos:Number(saved.limiteFiadoCentavos||limit),versao:VERSION}).catch(()=>{});closeModal();toast('Autorização salva.');renderParentPortal()};

window.parentLogoutClean=parentLogoutClean=async function(){familyApiV167('sair').catch(()=>{});try{await authObjV130()?.signOut()}catch(_){}localStorage.removeItem(FAMILY_STUDENT_KEY);state.parentFamily=null;state.parentStudent=null;state.parentChallenge=null;state.students=[];$('#notifBellV134')?.remove();renderMeuPiagetLoginV167()};
window.logoutProfile=logoutProfile=async function(){if(state.parentFamily||activeFamilyModeV167())return parentLogoutClean();return BASE_LOGOUT()};
window.parentUrl=parentUrl=function(a){const url=new URL(typeof familyPublicUrlV178==='function'?familyPublicUrlV178('/'):'https://meupiaget.com.br/');if(a?.matricula)url.searchParams.set('matricula',a.matricula);return url.toString()};

/* Acesso dos responsáveis na equipe: o operador continua procurando pelo aluno,
   mas qualquer irmão leva para a mesma conta familiar. */
window.openResponsibleAccessManagerV130=openResponsibleAccessManagerV130=async function(alunoId){const a=studentV167(alunoId);if(!a)return;const rid=familyResponsibleIdV167(a);if(!rid)return appMessage('Prepare a base oficial de responsáveis antes de gerenciar este acesso.');const [ac,reqs,links]=await Promise.all([db.collection('responsaveis_acesso').doc(rid).get().catch(()=>null),db.collection('solicitacoes_reset_responsavel').where('responsavelId','==',rid).get().catch(()=>({docs:[]})),db.collection('reset_senha_responsavel').where('responsavelId','==',rid).get().catch(()=>({docs:[]}))]),data=ac?.exists?ac.data():null,children=linkedStudentsV167(rid),active=Boolean(data?.ativo&&data?.senhaHash);openModal('Acesso ao Meu Piaget',`<div class="mini-breakdown"><span><span>Família vinculada</span><strong>${children.length} aluno(s)</strong></span><span><span>Status</span><strong>${active?'Senha ativa':'Primeiro acesso pendente'}</strong></span>${data?.ultimoAcessoEm?`<span><span>Último acesso</span><strong>${humanDate(data.ultimoAcessoEm)}</strong></span>`:''}</div><div class="v167-linked-students">${children.map(x=>`<div class="student-row"><div><strong>${esc(x.nome)}</strong><div class="muted">${esc(x.turma)} · ${esc(x.matricula)}</div></div></div>`).join('')}</div><div class="alert" style="margin-top:12px">O login é único para a família. O comprador do pagamento continua podendo ser outra pessoa.</div><div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="generateParentResetLinkV130('${esc(alunoId)}')">Gerar link de redefinição</button><button class="btn btn-red" onclick="blockParentAccessV130('${esc(alunoId)}')">Bloquear acesso</button></div><div id="parentResetLinkHostV130" style="margin-top:14px"></div><div class="tiny-v130" style="margin-top:12px">Solicitações: ${reqs.docs.length} · Links gerados: ${links.docs.length}</div>`)};
window.generateParentResetLinkV130=generateParentResetLinkV130=async function(alunoId){const a=studentV167(alunoId),rid=familyResponsibleIdV167(a);if(!rid)return appMessage('Responsável financeiro não identificado.');try{const d=await staffApiV167('/api/gestao-familias',{acao:'gerar_reset',responsavelId:rid});const h=$('#parentResetLinkHostV130');if(h)h.innerHTML=`<div class="reset-link-box-v130">${esc(d.url)}</div><div class="actions" style="margin-top:8px"><button class="btn btn-light" onclick="navigator.clipboard.writeText(${JSON.stringify(d.url)});toast('Link copiado.')">Copiar link</button></div><div class="tiny-v130">Válido por 2 horas e uso único.</div>`}catch(e){appMessage(e.message)}};
window.blockParentAccessV130=blockParentAccessV130=async function(alunoId){const a=studentV167(alunoId),rid=familyResponsibleIdV167(a);if(!rid)return;if(!await appConfirm('Este acesso familiar deixará de aceitar a senha atual até nova redefinição.',{title:'Bloquear acesso?',confirmLabel:'Bloquear',cancelLabel:'Voltar',danger:true}))return;try{await staffApiV167('/api/gestao-familias',{acao:'bloquear_acesso',responsavelId:rid});closeModal();toast('Acesso bloqueado.')}catch(e){appMessage(e.message)}};

async function implantationStatusV167(){return staffApiV167('/api/implantacao',{acao:'status'})}
function operationalCountRowsV167(collections={}){const labels={vendas:'Vendas',pedidos:'Pedidos',pedidos_farda:'Pedidos de farda',pedidos_operacionais:'Pedidos operacionais',sessoes_caixa:'Sessões de caixa',periodos_responsabilidade_caixa:'Períodos de responsabilidade',movimentos_caixa:'Movimentos de caixa',movimentos_conta:'Movimentos financeiros',pagamentos:'Pagamentos',notificacoes:'Notificações'};return Object.entries(collections).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,n])=>`<div class="v167-reset-row"><span>${esc(labels[k]||String(k).replaceAll('_',' '))}</span><strong>${n}</strong></div>`).join('')}
window.renderImplantationPanelV167=async function(){const host=$('#v167ImplantationHost');if(!host)return;host.innerHTML='<div class="v151-inline-loader">Verificando implantação...</div>';try{const s=await implantationStatusV167();state.implantationV167=s;host.innerHTML=`<div class="v167-implant-grid"><div class="v167-implant-step ${s.preparada?'done':''}"><strong>1. Base oficial 2026</strong><span>${s.preparada?'Preparada':'Aguardando preparação'}</span><small>${s.base.alunos} alunos · ${s.base.responsaveis} responsáveis financeiros</small>${!s.preparada?`<button class="btn btn-primary" onclick="prepareOfficialBaseV167()">Preparar base oficial</button>`:''}</div><div class="v167-implant-step ${s.cpfPendentes.length?'warn':'done'}"><strong>2. Cadastros de acesso</strong><span>${s.cpfPendentes.length?`${s.cpfPendentes.length} CPF pendente`:'CPFs prontos para acesso'}</span>${s.cpfPendentes.map(r=>`<div class="v167-cpf-fix"><span>${esc(r.nome)}</span><button class="btn btn-light" onclick="openCpfCorrectionV167('${esc(r.id)}','${esc(r.nome)}')">Corrigir CPF</button></div>`).join('')}</div><div class="v167-implant-step ${s.operacaoOficial?'done':''}"><strong>3. Marco zero operacional</strong><span>${s.operacaoOficial?`Operação oficial iniciada em ${humanDate(s.marco?.inicioEm)}`:'Ainda não executado'}</span><small>O reset nunca acontece automaticamente no deploy.</small>${!s.operacaoOficial?`<button class="btn btn-orange" ${!s.preparada||s.cpfPendentes.length?'disabled':''} onclick="previewOfficialResetV167()">Revisar marco zero</button>`:''}</div></div>`}catch(e){host.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`}};
window.prepareOfficialBaseV167=async function(){if(!await appConfirm('A base oficial de 2026 será importada dos relatórios SIGA. Cadastros existentes serão atualizados por matrícula; históricos operacionais NÃO serão apagados.',{title:'Preparar base oficial?',confirmLabel:'Preparar base',cancelLabel:'Voltar'}))return;try{const d=await staffApiV167('/api/implantacao',{acao:'preparar_base'});toast(`Base preparada: ${d.alunos} alunos.`);await loadCore();await renderImplantationPanelV167()}catch(e){appMessage(e.message)}};
window.openCpfCorrectionV167=function(id,name){openModal('Corrigir CPF do responsável',`<div class="alert warn">O relatório de origem não trouxe um CPF completo para este cadastro. Informe o CPF correto antes de liberar o Meu Piaget.</div><div class="fg" style="margin-top:12px"><label>${esc(name)}</label><input id="v167CpfCorrection" class="fi" inputmode="numeric" placeholder="000.000.000-00" oninput="this.value=formatCpfInputV167(this.value)"></div><button class="btn btn-primary" style="width:100%" onclick="saveCpfCorrectionV167('${esc(id)}')">Salvar CPF</button>`)};
window.saveCpfCorrectionV167=async function(id){try{await staffApiV167('/api/gestao-familias',{acao:'corrigir_cpf',responsavelId:id,cpf:$('#v167CpfCorrection')?.value||''});closeModal();toast('CPF atualizado.');await renderImplantationPanelV167()}catch(e){appMessage(e.message)}};
window.previewOfficialResetV167=async function(){try{const d=await staffApiV167('/api/implantacao',{acao:'preview_reset'});openModal('Marco zero — revisão',`<div class="alert warn"><strong>Esta ação apaga os dados operacionais de teste.</strong><br>Antes da exclusão, o sistema cria um backup interno. Alunos, responsáveis, catálogo, preços, estoques, configurações e usuários da equipe serão preservados.</div><div class="v167-reset-summary"><div><small>Registros operacionais encontrados</small><strong>${d.totalDocumentos}</strong></div><div><small>Base preservada</small><strong>${d.baseOficial.alunos} alunos</strong></div></div><div class="v167-reset-list">${operationalCountRowsV167(d.colecoes)||'<div class="empty-soft">Não há dados de teste nas coleções monitoradas.</div>'}</div><div class="fg" style="margin-top:14px"><label>Para confirmar, digite exatamente:</label><div class="reset-link-box-v130">INICIAR OPERAÇÃO REAL</div><input id="v167ResetConfirmation" class="fi" autocomplete="off" placeholder="INICIAR OPERAÇÃO REAL"></div><button class="btn btn-red" style="width:100%" onclick="executeOfficialResetV167()">Criar backup e iniciar operação oficial</button>`)}catch(e){appMessage(e.message)}};
window.executeOfficialResetV167=async function(){const c=$('#v167ResetConfirmation')?.value||'';if(c!=='INICIAR OPERAÇÃO REAL')return appMessage('Digite exatamente INICIAR OPERAÇÃO REAL.');if(!await appConfirm('Depois deste passo, o histórico de testes sairá das telas operacionais. O backup ficará registrado internamente.',{title:'Confirmar início da operação?',confirmLabel:'Iniciar operação oficial',cancelLabel:'Cancelar',danger:true}))return;try{const d=await staffApiV167('/api/implantacao',{acao:'iniciar_operacao',confirmacao:c});closeModal();toast('Operação oficial iniciada.');await loadCore();navigate('config')}catch(e){appMessage(e.message)}};

/* Configurações ganham um bloco de implantação sem substituir os parâmetros atuais. */
window.renderConfig=renderConfig=async function(){await Promise.resolve(BASE_RENDER_CONFIG());const root=$('#mainContent');if(!root)return;const familyMaxBase=Number(state.config?.limiteMaximoFiadoCentavos||5000);root.insertAdjacentHTML('beforeend',`<div class="card" style="margin-top:16px"><div class="card-head"><div><div class="card-title">Meu Piaget e implantação</div><div class="muted">Base de famílias, acessos e marco zero operacional.</div></div></div><div class="card-body"><div class="grid g2"><div class="v167-info-box"><strong>Conta financeira familiar</strong><span>Limite-base por aluno: ${fmt(familyMaxBase)}. Famílias com irmãos recebem limite máximo proporcional ao número de alunos ativos.</span></div><div class="v167-info-box"><strong>Portais separados</strong><span>Equipe: <code>/equipe.html</code><br>Famílias: <code>/meu-piaget.html</code></span></div></div><div id="v167ImplantationHost" style="margin-top:14px"></div></div></div>`);if(['admin','gestao'].includes(state.user?.perfil))renderImplantationPanelV167();else $('#v167ImplantationHost').innerHTML='<div class="alert">O marco de implantação é administrado pela Gestão.</div>'};

/* Tela de detalhes explicita quando a conta é compartilhada, sem duplicar saldo. */
const BASE_STUDENT_DETAILS=window.openStudentDetails;
window.openStudentDetails=openStudentDetails=async function(id){await BASE_STUDENT_DETAILS(id);const a=studentV167(id),rid=familyResponsibleIdV167(a),siblings=rid?linkedStudentsV167(rid):[];if(siblings.length>1){const body=$('#modalBody');if(body)body.insertAdjacentHTML('afterbegin',`<div class="alert"><strong>Conta financeira compartilhada.</strong><br>Este responsável financeiro possui ${siblings.length} alunos ativos: ${siblings.map(x=>esc(x.nome)).join(', ')}. O saldo e o limite são únicos; os movimentos abaixo continuam identificando o aluno de origem.</div>`)}};

/* A tela pública antiga não oferece mais dois caminhos. */
window.renderAccessLandingV130=renderAccessLandingV130=function(msg=''){$('#roleScreen').innerHTML=`<div class="role-box"><div class="access-logo-v130"><img src="${BRAND_V122?.light||BRAND_V120.icon}" alt="Escola Piaget"><div><strong>Equipe Piaget</strong><span>Acesso interno</span></div></div>${msg?`<div class="alert danger" style="margin-bottom:12px">${esc(msg)}</div>`:''}<div class="access-v130"><div class="access-panel-v130"><h3>Acesso da equipe</h3><p>Secretaria, Gestão e Cantina.</p><div class="fg"><label>E-mail</label><input id="loginEmailV130" class="fi" type="email" autocomplete="username" placeholder="E-mail de acesso"></div><div class="fg"><label>Senha</label><input id="loginPassV130" class="fi" type="password" autocomplete="current-password" placeholder="Senha"></div><button class="btn btn-primary" style="width:100%" onclick="loginInternalV130()">Entrar na Equipe Piaget</button><button class="btn btn-outline" style="width:100%;margin-top:8px" onclick="sendInternalPasswordResetV130()">Redefinir senha da equipe</button></div></div></div>`;setFamilyHeaderV167();applyBrandingV122?.()};

/* CSS pequeno e isolado da camada RC2.7. */
const style=document.createElement('style');style.textContent=`
.v167-family-switcher{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,340px);gap:12px;align-items:center;background:#fff;border:1px solid rgba(44,56,150,.14);border-radius:16px;padding:12px 14px;margin:12px 0}.v167-family-switcher small{display:block;color:#6b7280}.v167-family-switcher strong{display:block;margin-top:2px}.v167-family-account-note{margin:10px 0 0}.v167-implant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.v167-implant-step{border:1px solid #e5e7eb;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}.v167-implant-step.done{border-color:#b7dfc5;background:#f7fff9}.v167-implant-step.warn{border-color:#ffd79d;background:#fffaf0}.v167-implant-step span,.v167-implant-step small{color:#667085}.v167-cpf-fix{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid rgba(0,0,0,.08);padding-top:8px}.v167-reset-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.v167-reset-summary>div,.v167-info-box{border:1px solid #e7e9f2;border-radius:12px;padding:12px}.v167-reset-summary small,.v167-info-box span{display:block;color:#667085;margin-top:4px}.v167-reset-summary strong{font-size:20px}.v167-reset-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee}.v167-linked-students{margin-top:12px;border:1px solid #eee;border-radius:12px;overflow:hidden}.v167-login-wrap{max-width:560px}.v167-info-box code{font-size:12px}@media(max-width:760px){.v167-family-switcher,.v167-implant-grid,.v167-reset-summary{grid-template-columns:1fr}.v167-family-switcher select{width:100%}}
`;document.head.appendChild(style);

setFamilyHeaderV167();

/* Auditoria do responsável passa pelo backend; nenhuma escrita de auditoria é liberada diretamente nas Rules. */
const BASE_AUDIT_V176=window.audit||((typeof audit==='function')?audit:null);
window.familyAuditV176=async function(action,data={}){try{return await familySecurityApiV176('family_audit',{action,data})}catch(e){console.warn('family-audit',e?.message||e)}};
if(activeFamilyModeV167())window.audit=async function(action,data={}){return window.familyAuditV176(action,data)};
window.PiagetFamilyV167={activeFamilyModeV167,familyModelEnabledV167,staffApiV167,familyApiV167,securityApiV176:familySecurityApiV176,renderFamilyResetFromQueryV167};

const styleV178=document.createElement('style');styleV178.id='v178-family-runtime-style';styleV178.textContent=`
.v178-login-spinner{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-2px;animation:v178spin .7s linear infinite}@keyframes v178spin{to{transform:rotate(360deg)}}
`;if(!document.getElementById(styleV178.id))document.head.appendChild(styleV178);
})();
