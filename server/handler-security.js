const {admin,initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff,validateFamilySession,familySessionTokenFromReq}=require('./_family-utils');

module.exports=async function(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
  const db=initFirebase(),b=parseBody(req),acao=String(b.acao||'');
  try{
    if(acao==='staff_bootstrap'){
      const profile=await verifyStaff(db,req,['admin','gestao','secretaria','cantina']);
      const row={uid:profile.authUid,usuarioAcessoId:profile.id,nome:profile.nome||'',email:profile.authEmail||profile.email||'',perfil:profile.perfil,turnos:profile.turnos||[],permissoes:profile.permissoes||[],caixaPermissao:profile.caixaPermissao||null,ativo:profile.ativo!==false,atualizadoEm:nowIso()};
      await db.collection('usuarios_auth').doc(profile.authUid).set(row,{merge:true});
      const accessRef=db.collection('usuarios_acesso').doc(profile.id),access=await accessRef.get();
      if(access.exists&&access.data()?.authUid!==profile.authUid)await accessRef.set({authUid:profile.authUid,vinculadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
      return json(res,200,{ok:true,profile:{id:profile.id,nome:profile.nome,email:profile.authEmail||profile.email||'',perfil:profile.perfil,turnos:profile.turnos||[],permissoes:profile.permissoes||[],caixaPermissao:profile.caixaPermissao||null,ativo:true,authUid:profile.authUid}});
    }
    if(acao==='save_staff_profile'){
      const actor=await verifyStaff(db,req,['admin','gestao']);
      const id=String(b.id||'').trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
      if(!id)return json(res,400,{error:'Identificador do usuário inválido.'});
      const allowedProfiles=['admin','gestao','secretaria','cantina'],perfil=String(b.perfil||'secretaria');
      if(!allowedProfiles.includes(perfil))return json(res,400,{error:'Perfil inválido.'});
      const nome=String(b.nome||'').trim().slice(0,160),email=String(b.email||'').trim().toLowerCase().slice(0,200);
      if(!nome)return json(res,400,{error:'Informe o nome do usuário.'});
      const ref=db.collection('usuarios_acesso').doc(id),oldSnap=await ref.get(),old=oldSnap.exists?oldSnap.data():{};
      const row={id,nome,email,perfil,turnos:Array.isArray(b.turnos)?b.turnos.filter(x=>['manha','tarde'].includes(String(x))).slice(0,2):[],caixaPermissao:['nenhum','operador','gestor'].includes(String(b.caixaPermissao))?String(b.caixaPermissao):null,ativo:b.ativo!==false,permissoes:Array.isArray(b.permissoes)?b.permissoes.map(String).slice(0,40):[],observacao:String(b.observacao||'').trim().slice(0,300),atualizadoEm:nowIso()};
      if(!oldSnap.exists)row.criadoEm=nowIso();
      if(old.authUid)row.authUid=old.authUid;
      await ref.set(row,{merge:true});
      const uid=String(old.authUid||'');
      if(uid){
        await db.collection('usuarios_auth').doc(uid).set({uid,usuarioAcessoId:id,nome,email,perfil,turnos:row.turnos,permissoes:row.permissoes,caixaPermissao:row.caixaPermissao,ativo:row.ativo,atualizadoEm:nowIso(),sincronizadoPorId:actor.id||null},{merge:true});
      }
      return json(res,200,{ok:true,id,ativo:row.ativo,authUid:uid||null});
    }

    if(acao==='family_auth_probe'){
      const s=await validateFamilySession(db,familySessionTokenFromReq(req));if(!s)return json(res,401,{error:'A sessão do Meu Piaget não está ativa no servidor.'});
      const header=String(req.headers.authorization||''),token=header.startsWith('Bearer ')?header.slice(7).trim():'';if(!token)return json(res,401,{error:'A autenticação Firebase da família não foi recebida.'});
      let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){return json(res,401,{error:'O token Firebase da família não pôde ser validado.'})}
      if(String(decoded.role||'')!=='responsavel')return json(res,403,{error:'O token Firebase não possui o perfil de responsável.'});
      if(String(decoded.responsavelId||'')!==String(s.responsavelId||''))return json(res,403,{error:'A família da sessão e a família do token Firebase não correspondem.'});
      if(String(decoded.sessionId||'')!==String(s.id||''))return json(res,403,{error:'A sessão do token Firebase não corresponde à sessão ativa do Meu Piaget.'});
      const mirror=await db.collection('familias_auth').doc(String(decoded.sessionId||'')).get();if(!mirror.exists)return json(res,409,{error:'O espelho seguro da família ainda não foi criado. Publique o backend da RC2.7.15 e tente novamente.'});
      const m=mirror.data()||{},expiresMs=Number(m.expiraEmMs||0);if(m.ativo!==true||String(m.firebaseUid||'')!==String(decoded.uid||'')||String(m.responsavelId||'')!==String(decoded.responsavelId||'')||String(m.sessionId||'')!==String(decoded.sessionId||'')||!Number.isFinite(expiresMs)||expiresMs<=Date.now())return json(res,403,{error:'O espelho seguro da família está inativo, expirado ou não corresponde à sessão atual.'});
      return json(res,200,{ok:true,uid:decoded.uid,responsavelId:decoded.responsavelId,sessionId:decoded.sessionId,alunosIds:Array.isArray(decoded.alunosIds)?decoded.alunosIds:[],authSchema:decoded.authSchema||null,mirrorAtivo:true,expiraEm:m.expiraEm||s.expiraEm||null});
    }
    if(acao==='update_family_preferences'){
      const s=await validateFamilySession(db,familySessionTokenFromReq(req));if(!s)return json(res,401,{error:'Sessão encerrada.'});
      const cfgSnap=await db.collection('configuracoes').doc('sistema').get(),cfg=cfgSnap.exists?(cfgSnap.data()||{}):{};
      const students=await db.collection('alunos').where('responsavelFinanceiroId','==',s.responsavelId).get(),activeCount=Math.max(1,students.docs.filter(d=>d.data()?.ativo!==false).length);
      const baseMax=Math.max(0,Number(cfg.limiteMaximoFiadoCentavos||5000)),max=baseMax*activeCount;
      const requested=Math.max(0,Math.round(Number(b.limiteFiadoCentavos||0))),limit=Math.min(max,requested),authorized=Boolean(b.autorizadoSemSaldo);
      const ref=db.collection('contas_responsaveis').doc(s.responsavelId),snap=await ref.get(),acc=snap.exists?(snap.data()||{}):{};
      const net=Number(acc.saldoContaCentavos??(Number(acc.saldoCreditoCentavos||0)-Number(acc.dividaCentavos||0)));
      const blockedByLimit=Boolean(authorized&&limit>0&&net<0&&Math.abs(net)>=limit);
      await ref.set({autorizadoSemSaldo:authorized,limiteFiadoCentavos:limit,bloqueadoPorLimite:blockedByLimit,atualizadoEm:nowIso()},{merge:true});
      return json(res,200,{ok:true,autorizadoSemSaldo:authorized,limiteFiadoCentavos:limit,bloqueadoPorLimite:blockedByLimit,limiteMaximoFamiliaCentavos:max});
    }
    if(acao==='family_access_status'){
      const s=await validateFamilySession(db,familySessionTokenFromReq(req));if(!s)return json(res,401,{error:'Sessão encerrada.'});
      const snap=await db.collection('responsaveis_acesso').doc(s.responsavelId).get();const d=snap.exists?snap.data():{};
      return json(res,200,{ok:true,ativo:Boolean(snap.exists&&d.ativo!==false&&d.senhaHash),ultimoAcessoEm:d.ultimoAcessoEm||null});
    }
    if(acao==='family_audit'){
      const s=await validateFamilySession(db,familySessionTokenFromReq(req));if(!s)return json(res,401,{error:'Sessão encerrada.'});
      const action=String(b.action||'acao_responsavel').slice(0,80),raw=b.data&&typeof b.data==='object'?b.data:{};
      const safe={};for(const k of ['alunoId','pedidoId','pagamentoId','vendaId','ocorrenciaId','autorizado','limiteCentavos','versao','origem'])if(raw[k]!==undefined)safe[k]=raw[k];
      await db.collection('historico_auditoria').add({acao:action,dados:safe,usuarioId:`responsavel:${s.responsavelId}`,usuarioNome:'Responsável',usuarioPerfil:'responsavel',responsavelId:s.responsavelId,criadoEm:nowIso(),versao:'1.6.0-rc2.7.15'});
      return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Ação inválida.'});
  }catch(e){console.error('security',e);return json(res,e.status||500,{error:e.status?e.message:'Não foi possível validar o acesso.'})}
};
