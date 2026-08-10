const {initFirebase,json,parseBody,nowIso,audit,accountNet,lunchDayInfo}=require('../server/_utils');
const {verifyStaff}=require('../server/_family-utils');

const cents=v=>Math.max(0,Math.round(Number(v||0)));
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const uniqDates=arr=>[...new Set((Array.isArray(arr)?arr:[]).map(String).filter(validDate))].sort();

async function saveLunchPlanning(db,body,actor){
  const dates=uniqDates(body.datas||[body.dataChave]);
  if(!dates.length)throw Object.assign(new Error('Informe ao menos uma data válida.'),{status:400});
  if(dates.length>100)throw Object.assign(new Error('Planeje no máximo 100 datas por operação.'),{status:400});
  const hasActive=typeof body.vendaAtiva==='boolean';
  const hasPlanned=body.quantidadePlanejada!==undefined&&body.quantidadePlanejada!==null&&body.quantidadePlanejada!=='';
  const hasReceived=body.quantidadeRecebida!==undefined;
  if(!hasActive&&!hasPlanned&&!hasReceived)throw Object.assign(new Error('Nenhuma alteração foi informada.'),{status:400});
  const planned=hasPlanned?cents(body.quantidadePlanejada):null;
  const received=hasReceived?(body.quantidadeRecebida===null||body.quantidadeRecebida===''?null:cents(body.quantidadeRecebida)):undefined;
  const onlyUndefined=body.somenteNaoDefinidos===true;
  const now=nowIso(),refs=dates.map(d=>db.collection('disponibilidade_salgados').doc(d));
  const [snaps,cfgSnap]=await Promise.all([Promise.all(refs.map(r=>r.get())),db.collection('configuracoes').doc('sistema').get()]);
  const cfg=cfgSnap.exists?(cfgSnap.data()||{}):{quantidadePadraoSalgados:Number(body.quantidadePadraoSalgados||30)};
  const batch=db.batch(),warnings=[];let changed=0,skipped=0;
  snaps.forEach((snap,i)=>{
    const day=dates[i],current=snap.exists?(snap.data()||{}):{};
    if(onlyUndefined&&current.planejamentoDefinido===true){skipped++;return}
    const patch={dataChave:day,atualizadoEm:now,planejamentoAlteradoPorId:actor.id||null,planejamentoAlteradoPorNome:actor.nome||'',planejamentoAlteradoPorPerfil:actor.perfil||''};
    if(hasActive){patch.vendaAtiva=body.vendaAtiva;patch.vendaAtivaDefinida=true}
    if(hasPlanned){patch.quantidadePlanejada=planned;patch.planejamentoDefinido=true}
    if(hasReceived){patch.quantidadeRecebida=received;patch.recebimentoRegistradoEm=received===null?null:now;patch.recebimentoRegistradoPorId=received===null?null:(actor.id||null);patch.recebimentoRegistradoPorNome=received===null?null:(actor.nome||'')}
    const merged={...current,...patch},info=lunchDayInfo(day,merged,cfg);
    if(info.used>0&&hasActive&&body.vendaAtiva===false)warnings.push(`${day}: ${info.used} salgado(s) já comprometido(s); os pedidos existentes foram preservados.`);
    if(info.deficit>0)warnings.push(`${day}: déficit de ${info.deficit} salgado(s) após o ajuste.`);
    batch.set(refs[i],patch,{merge:true});changed++;
  });
  if(changed)await batch.commit();
  await audit(db,'planejamento_lanches_atualizado',{datas:dates,quantidadeDatas:dates.length,alteradas:changed,ignoradas:skipped,vendaAtiva:hasActive?body.vendaAtiva:null,quantidadePlanejada:planned,quantidadeRecebida:hasReceived?received:undefined,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,descricaoHumana:`${actor.nome||'Usuário'} atualizou o planejamento de lanches de ${changed} dia(s).`});
  return{ok:true,alteradas:changed,ignoradas:skipped,warnings};
}

async function saveSystemConfig(db,body,actor){
  if(!['admin','gestao'].includes(actor.perfil))throw Object.assign(new Error('Somente Gestão/Admin pode alterar os parâmetros financeiros e o padrão geral.'),{status:403});
  const cfgRef=db.collection('configuracoes').doc('sistema'),cfgSnap=await cfgRef.get(),oldCfg=cfgSnap.exists?(cfgSnap.data()||{}):{};
  const baseLimit=body.limiteMaximoFiadoCentavos!==undefined?cents(body.limiteMaximoFiadoCentavos):cents(oldCfg.limiteMaximoFiadoCentavos||5000);
  const minCredit=body.valorMinimoCheckoutPositivoCentavos!==undefined?cents(body.valorMinimoCheckoutPositivoCentavos):cents(oldCfg.valorMinimoCheckoutPositivoCentavos||100);
  const defaultSnacks=body.quantidadePadraoSalgados!==undefined?cents(body.quantidadePadraoSalgados):cents(oldCfg.quantidadePadraoSalgados||30);
  const weekly=body.bloqueioSemanalSaldoAtivo!==undefined?Boolean(body.bloqueioSemanalSaldoAtivo):oldCfg.bloqueioSemanalSaldoAtivo!==false;
  const accountsSnap=await db.collection('contas_responsaveis').limit(400).get();
  // quantidadeAlunosAtivos já é mantida na conta familiar; não varremos toda a coleção de alunos a cada ajuste.
  const activeCounts=new Map(accountsSnap.docs.map(d=>[String(d.data()?.responsavelId||d.id),Math.max(1,Number(d.data()?.quantidadeAlunosAtivos||1))]));
  const now=nowIso(),ops=[];let reduced=0,blockedChanged=0;
  accountsSnap.docs.forEach(d=>{const acc=d.data()||{},family=String(acc.responsavelId||d.id),count=Math.max(1,activeCounts.get(family)||Number(acc.quantidadeAlunosAtivos||0)||1),max=baseLimit*count,current=Math.max(0,Math.round(Number(acc.limiteFiadoCentavos||0))),next=Math.min(current,max),net=accountNet(acc),blocked=Boolean(net<0&&next>0&&Math.abs(net)>=next);if(next<current)reduced++;if(blocked!==Boolean(acc.bloqueadoPorLimite))blockedChanged++;ops.push({ref:d.ref,data:{quantidadeAlunosAtivos:count,limiteBasePorAlunoCentavos:baseLimit,limiteMaximoFamiliaCentavos:max,limiteFiadoCentavos:next,bloqueadoPorLimite:blocked,atualizadoEm:now}})});
  const cfgPatch={limiteMaximoFiadoCentavos:baseLimit,valorMinimoCheckoutPositivoCentavos:minCredit,quantidadePadraoSalgados:defaultSnacks,bloqueioSemanalSaldoAtivo:weekly,diaBloqueioSemanalSaldo:'sexta',versao:'1.6.0-rc2.7.18',atualizadoEm:now};
  // O volume atual cabe em um batch. Mantemos fallback em blocos para crescimento futuro.
  const all=[{ref:cfgRef,data:cfgPatch},...ops];
  for(let i=0;i<all.length;i+=400){const batch=db.batch();all.slice(i,i+400).forEach(x=>batch.set(x.ref,x.data,{merge:true}));await batch.commit()}
  await audit(db,'configuracao_financeira_atualizada',{limiteBasePorAlunoCentavos:baseLimit,valorMinimoCheckoutPositivoCentavos:minCredit,quantidadePadraoSalgados:defaultSnacks,contasReconciliadas:ops.length,limitesReduzidos:reduced,bloqueiosRecalculados:blockedChanged,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,descricaoHumana:`${actor.nome||'Gestão'} atualizou os parâmetros operacionais e reconciliou ${ops.length} conta(s) familiares.`});
  return{ok:true,contasReconciliadas:ops.length,limitesReduzidos:reduced,bloqueiosRecalculados:blockedChanged,config:cfgPatch};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase(),body=parseBody(req),action=String(body.acao||''),actor=await verifyStaff(db,req,['admin','gestao','secretaria','cantina']);
    if(action==='salvar_planejamento_lanches')return json(res,200,await saveLunchPlanning(db,body,actor));
    if(action==='salvar_configuracao_sistema')return json(res,200,await saveSystemConfig(db,body,actor));
    return json(res,400,{ok:false,error:'Ação inválida.'});
  }catch(e){console.error('configuracao-operacional:',e);return json(res,e.status||500,{ok:false,error:e.message||'Não foi possível salvar a configuração.'})}
};
