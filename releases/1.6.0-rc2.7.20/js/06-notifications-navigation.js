
/* =========================================================
   Escola Piaget — Patch V1.3.4
   Central de notificações + auditoria humanizada
   ========================================================= */
const V134_VERSION='1.3.4-dev';
const NOTIFICATIONS_V134='notificacoes';
const _auditBeforeV134 = window.audit;
const _requestParentResetBeforeV134 = window.requestParentResetV130;
const _generateParentResetLinkBeforeV134 = window.generateParentResetLinkV130;
const _buildSidebarBeforeV134 = window.buildSidebar;
const _navigateBeforeV134 = window.navigate;
const _basePermissionsBeforeV134 = window.basePermissionsV130;
const _canPageBeforeV134 = window.canPageV130;

function roleRecipientsV134(type){
  const map={
    responsavel_reset_solicitado:['admin','gestao','secretaria'],
    responsavel_reset_link_gerado:['admin','gestao','secretaria'],
    caixa_divergencia:['admin','gestao'],
    caixa_fechado:['admin','gestao'],
    retorno_cantina_pendente:['admin','gestao','secretaria'],
    aluno_limite_atingido:['admin','gestao','secretaria'],
    farda_pendente:['admin','gestao','secretaria'],
    pedido_farda_confirmado:['admin','gestao','secretaria'],
    pedido_cantina_confirmado:['cantina','secretaria','admin','gestao'],
    pedido_cantina_revisao:['secretaria','admin','gestao'],
    pedido_entregue:['cantina','secretaria','admin','gestao'],
    pedido_nao_entregue:['cantina','secretaria','admin','gestao'],
    programacao_lanche_remarcada:['cantina','secretaria','admin','gestao'],
    programacao_lanche_cancelada:['cantina','secretaria','admin','gestao'],
    venda_online_confirmada:['secretaria','admin','gestao'],
    venda_online_revisao:['secretaria','admin','gestao'],
    checkout_pagamento_confirmado:['secretaria','admin','gestao'],
    estoque_critico:['admin','gestao','secretaria','cantina'],
    alteracao_sensivel:['admin','gestao']
  };
  return map[type]||['admin','gestao'];
}
function currentActorV134(){return {id:state.user?.id||'responsavel',nome:state.user?.nome||state.parentStudent?.responsavelFinanceiro||'Responsável',perfil:state.user?.perfil||'responsavel'}}
function findStudentV134(id){return state.students?.find(x=>x.id===id)||null}
function moneySignedV134(v){return fmt(Number(v||0)).replace(/\u00a0/g,' ')}
function normalizedActionV134(action){return String(action||'').trim()}
function auditDescriptorV134(action,data={},row={}){
  if(row.tituloHumano||row.descricaoHumana)return {title:row.tituloHumano||row.acao||action,desc:row.descricaoHumana||'',category:row.categoria||'Sistema',severity:row.severidade||'info',icon:row.icone||'📌'};
  const a=normalizedActionV134(action),actor=row.usuarioNome||state.user?.nome||state.parentStudent?.responsavelFinanceiro||'Sistema',st=findStudentV134(data.alunoId),student=st?.nome||data.alunoNome||data.alunoId||'aluno';
  const d=(title,desc,category='Sistema',severity='info',icon='📌')=>({title,desc,category,severity,icon});
  switch(a){
    case 'login_interno': return d(`${actor} entrou no sistema`,`Login interno realizado com perfil de acesso da equipe.`, 'Acesso','success','🔐');
    case 'perfil_acesso_salvo': return d(`${actor} salvou um perfil de acesso`,`Um usuário interno teve perfil, turno ou permissões cadastradas/alteradas.`, 'Usuários','info','👤');
    case 'senha_responsavel_criada': return d(`Responsável criou senha de acesso`,`A conta do responsável de ${student} passou a exigir matrícula e senha nos próximos acessos.`, 'Responsável','success','🔑');
    case 'login_responsavel_senha': return d(`Responsável acessou com senha`,`O responsável de ${student} entrou no portal usando matrícula e senha.`, 'Responsável','success','🔑');
    case 'login_responsavel_validacao': return d(`Responsável acessou por validação inicial`,`O responsável de ${student} entrou usando matrícula e confirmação inicial.`, 'Responsável','info','✅');
    case 'primeiro_acesso_responsavel_bloqueado_senha_existente':
    case 'validacao_responsavel_bloqueada_senha_existente': return d(`Tentativa de validação inicial bloqueada`,`A matrícula de ${student} já possui senha criada. O sistema bloqueou a entrada por data de nascimento ou iniciais.`, 'Responsável','warn','🛡️');
    case 'solicitacao_reset_responsavel': return d(`Responsável solicitou redefinição de senha`,`Foi registrada uma solicitação de novo acesso para o responsável de ${student}. A secretaria/gestão precisa confirmar e gerar um link temporário.`, 'Responsável','warn','🔔');
    case 'link_reset_responsavel_gerado': return d(`${actor} gerou link temporário`,`Foi gerado um link de redefinição de senha para o responsável de ${student}. O link é temporário e de uso único.`, 'Responsável','warn','🔗');
    case 'senha_responsavel_redefinida_link': return d(`Senha do responsável redefinida`,`O responsável de ${student} criou nova senha usando link temporário liberado pela escola.`, 'Responsável','success','🔑');
    case 'acesso_responsavel_bloqueado': return d(`${actor} bloqueou acesso do responsável`,`O acesso do responsável de ${student} foi bloqueado pela equipe.`, 'Responsável','danger','⛔');
    case 'abertura_sessao_caixa': return d(`${actor} abriu uma sessão de caixa`,`${data.ponto?String(data.ponto).toUpperCase(): 'Caixa'} · ${data.turno||'-'} · sessão #${String(data.numeroSessao||'').padStart(3,'0')} aberta com ${moneySignedV134(data.valorInicialCentavos)}.`, 'Caixa','success','💵');
    case 'fechamento_sessao_caixa':
    case 'fechamento_caixa': return d(`${actor} fechou uma sessão de caixa`,`${data.diferencaCentavos?`Fechamento com divergência de ${moneySignedV134(data.diferencaCentavos)}.`:'Fechamento sem divergência.'} Esperado: ${moneySignedV134(data.esperadoCentavos||data.valorEsperadoCentavos)} · contado: ${moneySignedV134(data.contadoCentavos)}${data.justificativa?` · justificativa: ${data.justificativa}`:''}`, 'Caixa',Number(data.diferencaCentavos||0)!==0?'danger':'success','🧾');
    case 'retornos_cantina_recebidos': return d(`Retorno da cantina recebido`,`Retornos pendentes da cantina foram vinculados à sessão de caixa da secretaria.`, 'Caixa','success','🔁');
    case 'venda_composta_secretaria': return d(`${actor} registrou uma venda na secretaria`,`Venda composta no valor de ${moneySignedV134(data.valorCentavos)}. Formas: ${(data.formas||[]).join(', ')||'-'}.`, 'Vendas','success','🧾');
    case 'venda_dinheiro_cantina': return d(`${actor} registrou venda em dinheiro na cantina`,`Venda de cantina registrada no valor de ${moneySignedV134(data.valorCentavos)}.`, 'Vendas','success','🍽️');
    case 'consumo_conta': return d(`${actor} lançou consumo na conta do aluno`,`Consumo registrado para ${student}.`, 'Conta do aluno','info','🍽️');
    case 'pagamento_manual': return d(`${actor} registrou pagamento manual`,`Pagamento manual vinculado à conta de ${student}.`, 'Conta do aluno','success','💳');
    case 'autorizacao_responsavel': return d(`Responsável alterou autorização de compra sem saldo`,`A autorização de compra sem saldo de ${student} foi alterada.`, 'Responsável','warn','📝');
    case 'limite_responsavel': return d(`Responsável alterou limite de consumo`,`O limite de compra sem saldo de ${student} foi atualizado.`, 'Responsável','warn','📝');
    case 'pedido_farda_criado': return d(`${actor} criou pedido de farda`,`Pedido de farda registrado para ${student}.`, 'Farda','info','👕');
    case 'pedido_farda_estado': return d(`${actor} alterou estado de pedido de farda`,`O pedido de farda foi atualizado para: ${statusLabelV120?.(data.status)||data.status||'-'}.`, 'Farda','info','👕');
    case 'produto_criado': return d(`${actor} criou um produto`,`Novo produto cadastrado no catálogo.`, 'Produtos','info','🛒');
    case 'produto_editado': return d(`${actor} editou um produto`,`Dados de um produto foram alterados.`, 'Produtos','warn','🛒');
    case 'preco_produto': return d(`${actor} alterou preço de produto`,`Preço atualizado no catálogo.`, 'Produtos','warn','💲');
    case 'movimento_estoque': return d(`${actor} registrou movimento de estoque`,`Movimento de estoque registrado no sistema.`, 'Estoque','info','📦');
    default: return d(statusLabelV120?statusLabelV120(a.replaceAll('_',' ')):a,`Ação registrada pelo sistema.`, 'Sistema','info','📌');
  }
}
function notificationActionableV165(n){
  if(typeof n?.acionavel==='boolean')return n.acionavel;
  return ['responsavel_reset_solicitado','caixa_divergencia','retorno_cantina_pendente','pedido_cantina_revisao','venda_online_revisao','estoque_critico'].includes(String(n?.tipo||''));
}
function notificationEffectiveStatusV165(n){
  if((n?.status||'')==='resolvida')return'resolvida';
  return notificationActionableV165(n)?'pendente':'informativa';
}
function notificationOriginLabelV165(n){
  const v=String(n?.origem||n?.canal||n?.criadoPorPerfil||'').toLowerCase();
  return({secretaria:'Secretaria',responsavel:'Responsável',portal_responsavel:'Responsável',cantina:'Cantina',gestao:'Gestão',admin:'Gestão',online:'Venda online',secretaria_online:'Venda online da Secretaria',venda_online_secretaria:'Venda online da Secretaria',secretaria_presencial:'Secretaria presencial',infinitepay:'Pagamento online',operacao_interna:'Operação interna',sistema:'Sistema'}[v]||String(n?.origemLabel||n?.origem||n?.canal||'')).trim();
}
async function createNotificationV134(payload){
  try{
    const actor=currentActorV134(),now=nowIso(),type=payload.tipo||payload.type||'geral',student=findStudentV134(payload.alunoId),actionable=typeof payload.acionavel==='boolean'?payload.acionavel:notificationActionableV165({tipo:type});
    const ref=db.collection(NOTIFICATIONS_V134).doc();
    await ref.set({id:ref.id,tipo:type,titulo:payload.titulo||'Notificação do sistema',mensagem:payload.mensagem||'',prioridade:payload.prioridade||'normal',status:payload.status||(actionable?'pendente':'informativa'),acionavel:actionable,destinatariosPerfis:payload.destinatariosPerfis||roleRecipientsV134(type),destinatariosUsuarios:payload.destinatariosUsuarios||[],destinatariosAlunos:Array.isArray(payload.destinatariosAlunos)?payload.destinatariosAlunos:[],alunoId:payload.alunoId||null,alunoNome:payload.alunoNome||student?.nome||null,turma:payload.turma||student?.turma||null,matricula:payload.matricula||student?.matricula||null,origem:payload.origem||payload.canal||actor.perfil||null,canal:payload.canal||null,caixaId:payload.caixaId||payload.sessaoCaixaId||null,vendaId:payload.vendaId||null,pedidoId:payload.pedidoId||null,ocorrenciaId:payload.ocorrenciaId||null,movimentacaoId:payload.movimentacaoId||null,pagamentoId:payload.pagamentoId||null,resetId:payload.resetId||null,requestId:payload.requestId||null,acaoPrincipal:payload.acaoPrincipal||null,acaoLabel:payload.acaoLabel||null,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,lidoPor:[],resolvidoEm:null,resolvidoPorId:null,resolvidoPorNome:null});
    refreshNotificationBadgeV134?.();
    return ref.id;
  }catch(e){console.warn('createNotificationV134',e);return null}
}
async function resolveRelatedNotificationsV134(match,extra={}){
  try{
    const snap=await db.collection(NOTIFICATIONS_V134).orderBy('criadoEm','desc').limit(150).get();
    const actor=currentActorV134(),batch=db.batch(),now=nowIso();let n=0;
    snap.docs.forEach(d=>{const x=d.data()||{};let ok=(x.status||'pendente')==='pendente';Object.entries(match||{}).forEach(([k,v])=>{if(v!=null&&x[k]!==v)ok=false});if(ok){batch.set(d.ref,{status:'resolvida',resolvidoEm:now,resolvidoPorId:actor.id,resolvidoPorNome:actor.nome,...extra},{merge:true});n++}});
    if(n)await batch.commit();
    refreshNotificationBadgeV134?.();
    return n;
  }catch(e){console.warn('resolveRelatedNotificationsV134',e);return 0}
}
window.notificationOriginLabelV165=notificationOriginLabelV165;
function notificationFromAuditV134(action,data={},desc=null){
  const a=normalizedActionV134(action),st=findStudentV134(data.alunoId),student=st?.nome||data.alunoNome||'aluno';
  if(a==='solicitacao_reset_responsavel')return {tipo:'responsavel_reset_solicitado',titulo:'Responsável solicitou novo acesso',mensagem:`${student} · matrícula ${data.matricula||st?.matricula||'-'}. A secretaria/gestão deve confirmar e gerar link temporário.`,prioridade:'alta',alunoId:data.alunoId,alunoNome:student,matricula:data.matricula||st?.matricula||null,requestId:data.requestId||null,acaoPrincipal:'gerar_link_reset',acaoLabel:'Gerar link'};
  if(a==='link_reset_responsavel_gerado')return {tipo:'responsavel_reset_link_gerado',titulo:'Link de reset gerado',mensagem:`${currentActorV134().nome} gerou um link temporário para ${student}.`,prioridade:'normal',alunoId:data.alunoId,alunoNome:student,resetId:data.resetId||null,acaoPrincipal:'abrir_acesso_responsavel',acaoLabel:'Ver acesso'};
  if((a==='fechamento_sessao_caixa'||a==='fechamento_caixa') && Number(data.diferencaCentavos||0)!==0)return {tipo:'caixa_divergencia',titulo:'Caixa fechado com divergência',mensagem:`Diferença de ${moneySignedV134(data.diferencaCentavos)}. ${data.justificativa?`Justificativa: ${data.justificativa}`:'Justificativa registrada no fechamento.'}`,prioridade:'urgente',caixaId:data.sessaoCaixaId||data.caixaId||null,acaoPrincipal:'abrir_caixa',acaoLabel:'Ver caixas'};
  if(a==='pedido_farda_criado')return {tipo:'farda_pendente',titulo:'Novo pedido de farda',mensagem:`Pedido de farda registrado para ${student}.`,prioridade:'normal',alunoId:data.alunoId,alunoNome:student,pedidoId:data.pedidoId||null,acaoPrincipal:'abrir_fardas',acaoLabel:'Ver fardas'};
  if(a==='preco_produto'||a==='produto_editado'||a==='perfil_acesso_salvo')return {tipo:'alteracao_sensivel',titulo:desc?.title||'Alteração sensível no sistema',mensagem:desc?.desc||'Uma configuração importante foi alterada.',prioridade:'normal',acaoPrincipal:a==='perfil_acesso_salvo'?'abrir_usuarios':'abrir_config',acaoLabel:'Ver'};
  return null;
}
async function auditV134(action,data){
  try{
    const actor=currentActorV134(),desc=auditDescriptorV134(action,data||{}),now=nowIso();
    const localStudent=data?.alunoId?findStudentV134(data.alunoId):null,localResponsible=data?.responsavelId||data?.responsavelFinanceiroId||localStudent?.responsavelFinanceiroId||localStudent?.contaFinanceiraId||state.parentFamily?.responsavelId||null;
    await db.collection('historico_auditoria').add({acao:action,acaoTecnica:action,dados:data||{},tituloHumano:desc.title,descricaoHumana:desc.desc,categoria:desc.category,severidade:desc.severity,icone:desc.icon,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,alunoId:data?.alunoId||null,responsavelId:localResponsible,caixaId:data?.sessaoCaixaId||data?.caixaId||null,vendaId:data?.vendaId||null,pedidoId:data?.pedidoId||null,resetId:data?.resetId||null,entidadeTipo:data?.vendaId?'venda':data?.pedidoId?'pedido':localResponsible?'conta_familiar':data?.alunoId?'aluno':null,entidadeId:data?.vendaId||data?.pedidoId||localResponsible||data?.alunoId||null,retencao:'permanente',criadoEm:now,versao:'1.6.0-rc2.7.20'});
    const notif=notificationFromAuditV134(action,data||{},desc);
    if(notif)await createNotificationV134(notif);
  }catch(e){console.warn('auditV134',e);try{await _auditBeforeV134?.(action,data)}catch(_){}}
}
window.audit=audit=auditV134;

function notificationActorIdV156(){return state.user?.id||(state.parentFamily?.responsavelId?`responsavel:${state.parentFamily.responsavelId}`:(state.parentStudent?`responsavel:${state.parentStudent.id}`:''))}
function notificationVisibleV134(n){
  if(state.parentStudent&&!state.user){const ids=(state.parentFamily?.alunos||[state.parentStudent]).map(a=>String(a.id));const addressed=(n.destinatariosAlunos||[]).some(id=>ids.includes(String(id))),profile=(n.destinatariosPerfis||[]).includes('responsavel')&&ids.includes(String(n.alunoId||''));return addressed||profile}
  if(!state.user)return false;const p=state.user.perfil,id=state.user.id;
  return (n.destinatariosUsuarios||[]).includes(id)||(n.destinatariosPerfis||[]).includes(p);
}
const NOTIF_CACHE_TTL_V218=60*1000;
function notificationCacheKeyV218(){return `${state.user?'staff':'family'}:${notificationActorIdV156()||''}`}
function invalidateNotificationCacheV218(){state.v218NotificationCache=null;state.v218NotificationBadgeAt=0}
async function loadNotificationsForUserV134(limit=120,force=false){
  try{
    const cap=Math.max(1,Math.min(Number(limit||120),state.user?150:80)),key=notificationCacheKeyV218(),cached=state.v218NotificationCache;
    if(!force&&cached&&cached.key===key&&Date.now()-Number(cached.at||0)<NOTIF_CACHE_TTL_V218&&Number(cached.cap||0)>=cap)return cached.rows.slice(0,cap);
    let rows=[];
    if(state.parentStudent&&!state.user){
      const ids=(state.parentFamily?.alunos||[state.parentStudent]).map(a=>String(a.id)),perQuery=Math.max(20,Math.min(50,Math.ceil(cap/Math.max(1,ids.length))));
      const packs=await Promise.all(ids.flatMap(id=>[
        db.collection(NOTIFICATIONS_V134).where('destinatariosAlunos','array-contains',id).limit(perQuery).get().catch(()=>({docs:[]})),
        db.collection(NOTIFICATIONS_V134).where('alunoId','==',id).limit(perQuery).get().catch(()=>({docs:[]}))
      ]));
      const map=new Map();for(const snap of packs)for(const d of snap.docs)map.set(d.id,{id:d.id,...d.data()});rows=[...map.values()].filter(notificationVisibleV134).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))).slice(0,cap);
    }else{
      const snap=await db.collection(NOTIFICATIONS_V134).orderBy('criadoEm','desc').limit(cap).get();rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(notificationVisibleV134);
    }
    state.v218NotificationCache={key,at:Date.now(),cap,rows};return rows.slice(0,cap);
  }catch(e){console.warn('loadNotificationsForUserV134',e);return []}
}
async function refreshNotificationBadgeV134(force=false){
  const bell=$('#notifBellV134'),countEl=$('#notifCountV134'),uid=notificationActorIdV156();if(!bell||!countEl||!uid)return;
  if(!force&&Date.now()-Number(state.v218NotificationBadgeAt||0)<NOTIF_CACHE_TTL_V218)return;
  const rows=await loadNotificationsForUserV134(50,force),unread=rows.filter(n=>!(n.lidoPor||[]).includes(uid)).length,pending=rows.filter(n=>notificationEffectiveStatusV165(n)==='pendente').length;
  state.v218NotificationBadgeAt=Date.now();countEl.textContent=unread>=50?'50+':String(unread);countEl.classList.toggle('on',unread>0);bell.title=unread?`${unread>=50?'50 ou mais':unread} notificação(ões) não lida(s)${pending?` · ${pending} pendência(s) na amostra recente`:''}`:'Sem notificações novas na amostra recente';
}
function ensureNotificationBellV134(){
  if(!state.user&&!state.parentStudent)return;const actions=document.querySelector('.top-actions');if(!actions||$('#notifBellV134'))return;
  const b=document.createElement('button');b.type='button';b.id='notifBellV134';b.className='notif-bell-v134';b.onclick=()=>openNotificationsPanelV134();b.innerHTML=`🔔<span id="notifCountV134" class="notif-count-v134">0</span>`;
  const pill=$('#userPill');if(pill)actions.insertBefore(b,pill);else actions.prepend(b);
  setTimeout(refreshNotificationBadgeV134,250);
}
function priorityBadgeV134(p){const c=p==='urgente'||p==='alta'?'b-red':p==='normal'?'b-yellow':'b-blue';return `<span class="badge ${c}">${esc(p||'normal')}</span>`}
function notificationActionButtonV134(n){
  const label=esc(n.acaoLabel||'Abrir');
  if(n.acaoPrincipal==='gerar_link_reset'||n.acaoPrincipal==='abrir_acesso_responsavel')return `<button class="btn btn-primary" onclick="openResponsibleAccessManagerV130('${esc(n.alunoId||'')}')">${label}</button>`;
  if(n.acaoPrincipal==='abrir_caixa')return `<button class="btn btn-light" onclick="navigate('caixa')">${label}</button>`;
  if(n.acaoPrincipal==='abrir_fardas')return `<button class="btn btn-light" onclick="navigate('fardas')">${label}</button>`;
  if(n.acaoPrincipal==='abrir_usuarios')return `<button class="btn btn-light" onclick="navigate('usuarios')">${label}</button>`;
  if(n.acaoPrincipal==='abrir_config')return `<button class="btn btn-light" onclick="navigate('config')">${label}</button>`;
  return '';
}
function parentNotificationActionV156(n){
  if(n.acaoPrincipal==='regularizar_saldo')return `<button class="btn btn-primary" onclick="closeModal();openParentPaymentV151()">${esc(n.acaoLabel||'Regularizar agora')}</button>`;
  if(n.acaoPrincipal==='abrir_movimentacoes')return `<button class="btn btn-primary" onclick="closeModal();openParentMovementsV151()">${esc(n.acaoLabel||'Ver extrato')}</button>`;
  if(!state.parentStudent||state.user)return notificationActionButtonV134(n);
  if(n.pedidoId)return `<button class="btn btn-primary" onclick="closeModal();if(window.openFamilyNotificationOrderV167)openFamilyNotificationOrderV167('${esc(n.alunoId||'')}','${esc(n.pedidoId)}');else openParentOrdersV151('${esc(n.pedidoId)}')">Ver pedido</button>`;
  if(n.pagamentoId||String(n.tipo||'').includes('pagamento'))return `<button class="btn btn-primary" onclick="closeModal();openParentMovementsV151()">Ver movimentações</button>`;
  return '';
}
function parentNotificationPresentationV158(n){
  if(!(state.parentStudent&&!state.user))return n;
  if(n.tipo==='pedido_cantina_confirmado')return {...n,titulo:'Pedido de cantina confirmado',mensagem:'O pedido foi confirmado e está aguardando a entrega programada.',acaoLabel:'Ver pedido'};
  if(n.tipo==='pedido_farda_confirmado')return {...n,titulo:'Pedido de fardamento confirmado',mensagem:'O pagamento foi confirmado. Acompanhe neste pedido a reserva, produção ou retirada.',acaoLabel:'Ver pedido'};
  if(n.tipo==='checkout_pagamento_confirmado')return {...n,titulo:'Pagamento confirmado',mensagem:n.mensagem||'O pagamento foi confirmado e lançado na conta do aluno.'};
  return n;
}
function notificationHtmlV134(n,compact=false){
  n=parentNotificationPresentationV158(n);const uid=notificationActorIdV156(),unread=!(n.lidoPor||[]).includes(uid),urgent=(n.prioridade==='urgente'||n.prioridade==='alta'),status=notificationEffectiveStatusV165(n),origin=notificationOriginLabelV165(n),context=[n.alunoNome,n.turma,origin].filter(Boolean);
  const contextual=window.notificationContextActionsV165?.(n)||parentNotificationActionV156(n);
  return `<div class="notif-card-v134 ${unread?'unread':''} ${urgent?'urgent':''}"><div><div class="notif-title-v134">${esc(n.titulo||'Notificação')}</div>${context.length?`<div class="v165-notif-context">${context.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="notif-msg-v134">${esc(n.mensagem||'')}</div><div class="notif-meta-v134">${humanDate(n.criadoEm)} · ${status==='pendente'?'Requer ação':status==='resolvida'?'Concluída':'Informativa'}</div></div><div class="notif-actions-v134">${contextual}${(n.alunoId||n.pedidoId||n.vendaId||n.caixaId||n.ocorrenciaId||n.movimentacaoId)?`<button class="btn btn-light" onclick="openNotificationDetailV165('${n.id}')">Detalhar</button>`:''}${unread?`<button class="btn btn-outline" onclick="markNotificationReadV134('${n.id}')">Marcar como lida</button>`:''}${state.user&&status==='pendente'?`<button class="btn btn-primary" onclick="resolveNotificationV134('${n.id}')">Resolver</button>`:''}</div></div>`;
}
async function openNotificationsPanelV134(){const rows=(await loadNotificationsForUserV134(80)).slice(0,20),parent=Boolean(state.parentStudent&&!state.user);openModal('Notificações',`${rows.length?`<div class="actions" style="margin-bottom:12px"><button class="btn btn-outline" onclick="markAllNotificationsReadV134()">Marcar todas como lidas</button></div>`:''}<div class="notif-wrap-v134">${rows.length?rows.map(n=>notificationHtmlV134(n,true)).join(''):'<div class="empty-soft">Nenhuma notificação nova.</div>'}</div>`)}
async function markNotificationReadV134(id){
  const uid=notificationActorIdV156();if(!uid)return;await db.collection(NOTIFICATIONS_V134).doc(id).set({lidoPor:FIELD.arrayUnion(uid),lidoEm:nowIso()},{merge:true});invalidateNotificationCacheV218();await refreshNotificationBadgeV134(true);if(state.currentPage==='notificacoes'&&state.user)return renderNotificacoesV134();if(document.querySelector('#modalBack.open .notif-wrap-v134'))return openNotificationsPanelV134();
}
async function markAllNotificationsReadV134(){const uid=notificationActorIdV156();if(!uid)return;const rows=await loadNotificationsForUserV134(150),batch=db.batch();rows.forEach(n=>batch.set(db.collection(NOTIFICATIONS_V134).doc(n.id),{lidoPor:FIELD.arrayUnion(uid),lidoEm:nowIso()},{merge:true}));await batch.commit();closeModal();invalidateNotificationCacheV218();refreshNotificationBadgeV134(true);if(state.currentPage==='notificacoes'&&state.user)renderNotificacoesV134();}
async function resolveNotificationV134(id){
  if(!state.user)return;const snap=await db.collection(NOTIFICATIONS_V134).doc(id).get();if(!snap.exists)return;const current={id:snap.id,...snap.data()};if(!notificationActionableV165(current))return appMessage('Esta notificação é apenas informativa e não possui uma pendência para resolver.');const actor=currentActorV134();await db.collection(NOTIFICATIONS_V134).doc(id).set({status:'resolvida',resolvidoEm:nowIso(),resolvidoPorId:actor.id,resolvidoPorNome:actor.nome,lidoPor:FIELD.arrayUnion(actor.id)},{merge:true});await auditV134('notificacao_resolvida',{notificacaoId:id});toast('Pendência marcada como resolvida.');invalidateNotificationCacheV218();await refreshNotificationBadgeV134(true);if(state.currentPage==='notificacoes')return renderNotificacoesV134();if(document.querySelector('#modalBack.open .notif-wrap-v134'))return openNotificationsPanelV134();
}
async function renderNotificacoesV134(){
  const rows=await loadNotificationsForUserV134(250),status=$('#notifStatusFilterV134')?.value||'todas',prio=$('#notifPriorityFilterV134')?.value||'',q=String($('#notifSearchV134')?.value||'').toLowerCase(),uid=notificationActorIdV156();
  const filtered=rows.filter(n=>(status==='todas'||(status==='nao_lidas'&&!(n.lidoPor||[]).includes(uid))||notificationEffectiveStatusV165(n)===status)&&(!prio||n.prioridade===prio)&&(!q||`${n.titulo} ${n.mensagem} ${n.alunoNome} ${n.turma} ${n.matricula} ${n.origem}`.toLowerCase().includes(q)));
  const pend=rows.filter(n=>notificationEffectiveStatusV165(n)==='pendente').length,urgent=rows.filter(n=>notificationEffectiveStatusV165(n)==='pendente'&&['alta','urgente'].includes(n.prioridade)).length,unread=rows.filter(n=>!(n.lidoPor||[]).includes(uid)).length;
  $('#mainContent').innerHTML=pageHeader('Notificações','Avisos e pendências direcionados ao seu perfil.',`<button class="btn btn-outline" onclick="markAllNotificationsReadV134()">Marcar todas como lidas</button>`)+`<div class="grid g3"><div class="kpi red"><div class="kpi-label">Urgentes</div><div class="kpi-value">${urgent}</div></div><div class="kpi orange"><div class="kpi-label">Pendências reais</div><div class="kpi-value">${pend}</div></div><div class="kpi"><div class="kpi-label">Não lidas</div><div class="kpi-value">${unread}</div></div></div><div class="card" style="margin-top:14px"><div class="card-body"><div class="notif-filter-v134"><div class="fg"><label>Exibir</label><select id="notifStatusFilterV134" class="fi" onchange="renderNotificacoesV134()"><option value="todas" ${status==='todas'?'selected':''}>Todas</option><option value="nao_lidas" ${status==='nao_lidas'?'selected':''}>Não lidas</option><option value="pendente" ${status==='pendente'?'selected':''}>Pendências</option><option value="informativa" ${status==='informativa'?'selected':''}>Informativas</option><option value="resolvida" ${status==='resolvida'?'selected':''}>Resolvidas</option></select></div><div class="fg"><label>Prioridade</label><select id="notifPriorityFilterV134" class="fi" onchange="renderNotificacoesV134()"><option value="">Todas</option><option value="urgente" ${prio==='urgente'?'selected':''}>Urgente</option><option value="alta" ${prio==='alta'?'selected':''}>Alta</option><option value="normal" ${prio==='normal'?'selected':''}>Normal</option><option value="baixa" ${prio==='baixa'?'selected':''}>Baixa</option></select></div><div class="fg" style="flex:1;min-width:220px"><label>Buscar</label><input id="notifSearchV134" class="fi" value="${esc(q)}" oninput="renderNotificacoesV134()" placeholder="Aluno, turma, matrícula, mensagem..."></div></div><div class="notif-wrap-v134">${filtered.length?filtered.map(n=>notificationHtmlV134(n)).join(''):'<div class="empty-soft">Nenhuma notificação encontrada para este filtro.</div>'}</div></div></div>`;
  refreshNotificationBadgeV134();
}
window.renderNotificacoesV134=renderNotificacoesV134;
window.openNotificationsPanelV134=openNotificationsPanelV134;window.markNotificationReadV134=markNotificationReadV134;window.markAllNotificationsReadV134=markAllNotificationsReadV134;window.resolveNotificationV134=resolveNotificationV134;

async function requestParentResetV130(){
  const mat=normalizeMatriculaV131?.($('#parentMatricula')?.value||'')||String($('#parentMatricula')?.value||'').trim();
  if(!mat)return appMessage('Informe a matrícula.');
  const candidates=(typeof findStudentsByMatriculaV131==='function'?findStudentsByMatriculaV131(mat):(state.students||[]).filter(a=>a.matricula===mat));
  if(!candidates.length)return appMessage('Matrícula não encontrada.');
  const a=candidates[0],now=nowIso();
  const ref=await db.collection(PARENT_RESET_REQUESTS_V130).add({alunoId:a.id,alunoNome:a.nome,matricula:a.matricula,turma:a.turma,status:'aberto',origem:'portal_responsavel',criadoEm:now,atualizadoEm:now});
  await audit('solicitacao_reset_responsavel',{alunoId:a.id,alunoNome:a.nome,matricula:a.matricula,requestId:ref.id});
  const msg=$('#parentMsg')||$('#parentPasswordMsgV130');
  if(msg)msg.innerHTML='<div class="alert warn" style="margin-top:12px"><strong>Solicitação registrada.</strong><br>Para proteger a conta do aluno, a nova senha precisa ser liberada pela secretaria. Entre em contato com a escola e solicite o link temporário de redefinição.</div>';
}
window.requestParentResetV130=requestParentResetV130;

async function generateParentResetLinkV130(alunoId){
  const a=state.students.find(x=>x.id===alunoId);if(!a)return appMessage('Aluno não encontrado.');
  const token=await randomTokenV130(24),tokenHash=await sha256V130(token),ref=db.collection(PARENT_RESET_V130).doc(),expires=new Date(Date.now()+2*60*60*1000).toISOString(),now=nowIso();
  await ref.set({id:ref.id,alunoId,alunoNome:a.nome,matricula:a.matricula,tokenHash,status:'ativo',usoUnico:true,criadoPorId:state.user?.id||'sistema',criadoPorNome:state.user?.nome||'Sistema',criadoEm:now,expiraEm:expires,versao:'v1.3.4'});
  const reqs=await db.collection(PARENT_RESET_REQUESTS_V130).where('alunoId','==',alunoId).get().catch(()=>({docs:[]}));
  const batch=db.batch();reqs.docs.forEach(d=>{const r=d.data()||{};if((r.status||'aberto')==='aberto')batch.set(d.ref,{status:'link_gerado',linkGeradoEm:now,resetId:ref.id,atualizadoEm:now},{merge:true})});await batch.commit().catch(()=>{});
  await resolveRelatedNotificationsV134({tipo:'responsavel_reset_solicitado',alunoId});
  await audit('link_reset_responsavel_gerado',{alunoId,resetId:ref.id,expiraEm:expires});
  const url=`${location.origin}${location.pathname}?resetId=${encodeURIComponent(ref.id)}&resetAluno=${encodeURIComponent(alunoId)}&resetToken=${encodeURIComponent(token)}`;
  const host=$('#parentResetLinkHostV130');if(host)host.innerHTML=`<div class="reset-link-box-v130">${esc(url)}</div><div class="actions" style="margin-top:8px"><button class="btn btn-light" onclick="navigator.clipboard.writeText('${esc(url)}');toast('Link copiado.')">Copiar link</button></div><div class="tiny-v130" style="margin-top:8px">Válido por 2 horas e uso único. Envie apenas ao responsável confirmado.</div>`;
  toast('Link temporário gerado. A notificação foi marcada como resolvida.');
}
window.generateParentResetLinkV130=generateParentResetLinkV130;

function basePermissionsV130(perfil){const all=['dashboard','atendimento','entregas','caixa','consulta','alunos','vendas','cobrancas','pedidos','fardas','produtos','config','auditoria','usuarios','notificacoes'];if(perfil==='admin')return all;if(perfil==='gestao')return all;if(perfil==='secretaria')return ['dashboard','alunos','vendas','cobrancas','pedidos','caixa','fardas','produtos','consulta','notificacoes'];if(perfil==='cantina')return ['dashboard','atendimento','entregas','caixa','consulta','notificacoes'];return []}
window.basePermissionsV130=basePermissionsV130;
function canPageV130(page){if(page==='notificacoes')return !!state.user;if(!state.user)return false;const p=state.user.perfil;if(page==='usuarios')return ['admin','gestao'].includes(p);if(p==='admin')return true;const perms=state.user.permissoes||basePermissionsV130(p);return perms.includes(page)}
window.canPageV130=canPageV130;
function buildSidebar(){
  const p=state.user?.perfil;let items=[];
  if(p==='cantina')items=[['dashboard','home','Resumo'],['notificacoes','bell','Notificações'],['atendimento','food','Atendimento'],['entregas','orders','Pedidos do dia'],['caixa','cash','Caixa cantina'],['consulta','search','Consultar aluno']];
  if(p==='secretaria')items=[['dashboard','home','Resumo'],['notificacoes','bell','Notificações'],['alunos','students','Alunos e contas'],['vendas','sales','Vendas da secretaria'],['cobrancas','billing','Cobranças'],['pedidos','orders','Pedidos'],['caixa','cash','Caixa secretaria'],['fardas','uniform','Fardas'],['produtos','products','Catálogo de vendas']];
  if(p==='gestao'||p==='admin')items=[['dashboard','home','Visão geral'],['notificacoes','bell','Notificações'],['atendimento','food','Cantina'],['alunos','students','Alunos e contas'],['vendas','sales','Vendas'],['cobrancas','billing','Cobranças'],['pedidos','orders','Pedidos'],['caixa','cash','Caixas'],['fardas','uniform','Fardas'],['produtos','products','Catálogo de vendas'],['usuarios','settings','Usuários e acessos'],['config','settings','Configurações'],['auditoria','audit','Auditoria']];
  items=items.filter(i=>canPageV130(i[0]));
  $('#sidebar').innerHTML=`<div class="nav-label">Operação</div>${items.map(i=>`<button class="nav-btn" data-page="${i[0]}" onclick="navigate('${i[0]}')">${iconV120(i[1])}<span>${i[2]}</span></button>`).join('')}<div class="nav-foot"><strong>${esc(state.user?.nome||'-')}</strong><br>${roleLabelV130(state.user?.perfil)}<br><br>Acesso autenticado.<br><span class="system-version-clean">Versão ${esc(document.querySelector('meta[name=application-version]')?.content||'')}</span></div>`;
  document.getElementById('v151MenuBtn')?.classList.remove('hidden');
  ensureNotificationBellV134();
}
window.buildSidebar=buildSidebar;
function navigate(page){document.getElementById('v151MenuBtn')?.classList.remove('hidden');try{closeMobileMenuV151?.()}catch(e){}if(!state.user){renderAccessLandingV130();show('roleScreen');return}if(!canPageV130(page)){toast('Seu perfil não tem permissão para esta área.');page='dashboard'}state.currentPage=page;$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const map={dashboard:renderDashboard,notificacoes:renderNotificacoesV134,atendimento:renderAtendimento,entregas:renderEntregas,caixa:renderCaixa,consulta:renderConsulta,alunos:renderAlunos,vendas:renderVendas,cobrancas:renderCobrancas,pedidos:renderPedidos,fardas:renderFardas,produtos:renderProdutos,config:renderConfig,auditoria:renderAuditoria,usuarios:renderUsuariosAcessosV130};(map[page]||renderDashboard)();ensureNotificationBellV134();setTimeout(refreshNotificationBadgeV134,300)}
window.navigate=navigate;

async function renderAuditoria(){
  const snap=await db.collection('historico_auditoria').orderBy('criadoEm','desc').limit(350).get().catch(()=>({docs:[]}));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  const cat=$('#auditCatV134')?.value||'',sev=$('#auditSevV134')?.value||'',q=String($('#auditSearchV134')?.value||'').toLowerCase();
  const enriched=rows.map(r=>({ ...r, _human:auditDescriptorV134(r.acao||r.acaoTecnica,r.dados||{},r)}));
  const filtered=enriched.filter(r=>(!cat||r._human.category===cat)&&(!sev||r._human.severity===sev)&&(!q||`${r._human.title} ${r._human.desc} ${r.usuarioNome} ${JSON.stringify(r.dados||{})}`.toLowerCase().includes(q)));
  const cats=[...new Set(enriched.map(r=>r._human.category).filter(Boolean))].sort();
  $('#mainContent').innerHTML=pageHeader('Auditoria','Linha do tempo das operações e alterações realizadas no sistema.')+`<div class="card"><div class="card-body"><div class="notif-filter-v134"><div class="fg"><label>Categoria</label><select id="auditCatV134" class="fi" onchange="renderAuditoria()"><option value="">Todas</option>${cats.map(c=>`<option value="${esc(c)}" ${cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="fg"><label>Severidade</label><select id="auditSevV134" class="fi" onchange="renderAuditoria()"><option value="">Todas</option><option value="success" ${sev==='success'?'selected':''}>Sucesso</option><option value="info" ${sev==='info'?'selected':''}>Informação</option><option value="warn" ${sev==='warn'?'selected':''}>Atenção</option><option value="danger" ${sev==='danger'?'selected':''}>Crítica</option></select></div><div class="fg" style="flex:1;min-width:220px"><label>Buscar</label><input id="auditSearchV134" class="fi" value="${esc(q)}" oninput="renderAuditoria()" placeholder="Aluno, usuário, venda, caixa..."></div></div><div class="audit-list-v134">${filtered.length?filtered.map(r=>auditCardHtmlV134(r)).join(''):'<div class="empty-soft">Nenhum registro encontrado.</div>'}</div></div></div>`;
}
function auditCardHtmlV134(r){const h=r._human||auditDescriptorV134(r.acao,r.dados,r),cls=h.severity==='danger'?'danger':h.severity==='warn'?'warn':h.severity==='success'?'success':'';return `<div class="audit-card-v134 ${cls}"><div class="audit-icon-v134">${esc(h.icon||'📌')}</div><div><div class="audit-title-v134">${esc(h.title)}</div><div class="audit-desc-v134">${esc(h.desc)}</div><div class="audit-meta-v134">${esc(h.category||'Sistema')} · ${humanDate(r.criadoEm)} · ${esc(r.usuarioNome||'-')} ${r.usuarioPerfil?`· ${esc(roleLabelV130(r.usuarioPerfil))}`:''}</div></div><div><button class="btn btn-light" onclick="showAuditDetailsV134('${r.id}')">Detalhes</button></div></div>`}
async function showAuditDetailsV134(id){const snap=await db.collection('historico_auditoria').doc(id).get();if(!snap.exists)return;const r={id:snap.id,...snap.data()},h=auditDescriptorV134(r.acao||r.acaoTecnica,r.dados||{},r);openModal('Detalhes da auditoria',`<div class="audit-detail-grid-v134"><div class="box"><small>Ação</small><strong>${esc(h.title)}</strong><br><span class="muted">${esc(h.desc)}</span></div><div class="box"><small>Quando</small><strong>${humanDate(r.criadoEm)}</strong></div><div class="box"><small>Responsável</small><strong>${esc(r.usuarioNome||'-')}</strong><br><span class="muted">${esc(roleLabelV130(r.usuarioPerfil||''))}</span></div><div class="box"><small>Categoria</small><strong>${esc(h.category)}</strong></div></div>`) }
window.renderAuditoria=renderAuditoria;window.showAuditDetailsV134=showAuditDetailsV134;

/* atualização de versão herdada removida pela V1.5.0-dev2 */
