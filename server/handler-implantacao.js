const {initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff}=require('./_family-utils');

const VERSION='1.6.0-rc2.7.15';
const BASE_META={anoLetivo:2026,geradoDe:'SIGA 07/08/2026',alunos:214,responsaveis:187,vinculos:214};
const OPERATION_CUTOFF={
  dataLocal:'2026-08-10',
  inicioEm:'2026-08-10T03:00:00.000Z',
  timezone:'America/Fortaleza',
  rotulo:'10/08/2026'
};

/*
  O Marco Zero da RC2.7.12 não é mais um reset global.
  Ele arquiva somente registros seguramente anteriores ao corte de 10/08/2026.
  Tudo que aconteceu a partir do corte é tratado como dado da implantação piloto.
*/
const CUTOFF_COLLECTIONS=[
  'alertas','caixas','contas_alunos','dados_pagamento_responsavel','disponibilidade_salgados','eventos_checkout_infinitepay',
  'fechamentos_caixa','fechamentos_cantina','fechamentos_semanais','fechamentos_semanais_familias','fila_integracao','historico_auditoria',
  'itens_venda','lancamentos_manuais','movimentos_caixa','movimentos_conta','movimentos_estoque','notificacoes','ocorrencias_entrega',
  'pagamentos','pagamentos_checkout','pagamentos_venda','pedidos','pedidos_farda','pedidos_operacionais','sessoes_caixa',
  'periodos_responsabilidade_caixa','divergencias_caixa','ocorrencias_caixa','solicitacoes_correcao_pedido','taxas_pagamento',
  'tentativas_checkout','tentativas_confirmacao_saldo','transacoes_infinitepay','transferencias_caixa','vendas','vendas_online_links',
  'solicitacoes_reset_responsavel','reset_senha_responsavel','responsaveis_acesso','ativacoes_meu_piaget','sessoes_meu_piaget','seguranca_rate_limit'
];
const PRESERVED_LABELS=['alunos e matrículas','responsáveis e vínculos','catálogo','preços e estoques atuais','configurações','usuários da equipe','operações a partir de 10/08/2026'];
const DATE_FIELDS=[
  'criadoEm','registradoEm','recebidoEm','pagoEm','confirmadoEm','concluidoEm','abertoEm','inicioEm','fechadoEm','canceladoEm',
  'geradoEm','processadoEm','aplicadoEm','reservadoEm','usadoEm','atendidoEm','bloqueadoEm','reativadoEm','senhaCriadaEm','senhaRedefinidaEm',
  'encerradoEm','regularizadoEm','enviadoEm','dataOperacao','dataChave','data','ultimaTentativaEm','ultimoUsoEm','ultimoAcessoEm','atualizadoEm','janelaInicioMs'
];
const REF_KEY_RE=/(venda|pedido|checkout|moviment|sessao|periodo|caixa|fechamento|pagamento|taxa|transacao|transferencia|link|ocorrencia|tentativa|solicitacao|evento).*?(Id|Ids|Nsu)$/i;

function accountSplit(net){net=Math.round(Number(net||0));return{saldoContaCentavos:net,saldoCreditoCentavos:Math.max(0,net),dividaCentavos:Math.max(0,-net)}}
async function commitChunks(db,ops,max=420){for(let i=0;i<ops.length;i+=max){const batch=db.batch();for(const op of ops.slice(i,i+max)){if(op.kind==='set')batch.set(op.ref,op.data,op.options||{merge:true});else if(op.kind==='delete')batch.delete(op.ref)}await batch.commit()}}
async function actualBaseCounts(db){
 const [alunos,responsaveis,vinculos]=await Promise.all([
  db.collection('alunos').where('ativo','==',true).get().catch(()=>({size:0})),
  db.collection('responsaveis_financeiros').where('ativo','==',true).get().catch(()=>({size:0})),
  db.collection('vinculos_responsavel_aluno').where('ativo','==',true).get().catch(()=>({size:0}))
 ]);
 return{alunos:Number(alunos.size||0),responsaveis:Number(responsaveis.size||0),vinculos:Number(vinculos.size||0)}
}
async function prepareBase(db,staff){
 const cfg=await db.collection('configuracoes').doc('sistema').get();
 if(cfg.exists&&cfg.data()?.baseOficial2026Preparada){const atual=await actualBaseCounts(db);return{...atual,jaPreparada:true,fonte:'Firestore'}}
 throw Object.assign(new Error('A base oficial não é mais incorporada ao código-fonte por segurança. Faça a importação administrativa protegida antes de preparar uma base vazia.'),{status:409});
}
async function status(db){
 const [cfg,invalid,marco,atual]=await Promise.all([
  db.collection('configuracoes').doc('sistema').get(),
  db.collection('responsaveis_financeiros').where('cpfValido','==',false).get().catch(()=>({docs:[]})),
  db.collection('marcos_operacao').doc('operacao_oficial').get().catch(()=>null),
  actualBaseCounts(db)
 ]);
 return{
  base:{...BASE_META,...atual},
  preparada:Boolean(cfg.exists&&cfg.data()?.baseOficial2026Preparada),
  operacaoOficial:Boolean(marco?.exists),
  marco:marco?.exists?marco.data():null,
  corte:OPERATION_CUTOFF,
  cpfPendentes:invalid.docs.map(d=>({id:d.id,nome:d.data()?.nome||'Responsável',cpfFinal:d.data()?.cpfFinal||''}))
 };
}

function valueDateState(value){
 if(value==null||value==='')return null;
 if(value&&typeof value.toDate==='function'){
  const dt=value.toDate();if(!dt||!Number.isFinite(dt.getTime()))return null;return{ms:dt.getTime(),text:dt.toISOString()};
 }
 if(typeof value==='number'&&Number.isFinite(value)){
  const ms=value>1e12?value:value>1e9?value*1000:null;if(!ms)return null;const dt=new Date(ms);if(!Number.isFinite(dt.getTime()))return null;return{ms:dt.getTime(),text:dt.toISOString()};
 }
 const s=String(value).trim();if(!s)return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return{localKey:s,text:s};
 if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
  if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)){const ms=Date.parse(s);if(Number.isFinite(ms))return{ms,text:s}}
  return{localKey:s.slice(0,10),text:s};
 }
 const ms=Date.parse(s);if(Number.isFinite(ms))return{ms,text:s};
 return null;
}
function compareDateState(x){
 if(!x)return null;
 if(x.localKey)return x.localKey>=OPERATION_CUTOFF.dataLocal?'pos':'pre';
 return x.ms>=Date.parse(OPERATION_CUTOFF.inicioEm)?'pos':'pre';
}
function classifyDocumentDate(data={}){
 const found=[];
 for(const field of DATE_FIELDS){const state=valueDateState(data?.[field]);if(state)found.push({field,state,side:compareDateState(state)})}
 if(!found.length)return{classe:'sem_data',campo:null,valor:null};
 const pos=found.filter(x=>x.side==='pos');
 if(pos.length){const chosen=pos[pos.length-1];return{classe:'pos_corte',campo:chosen.field,valor:chosen.state.text}}
 const chosen=found[0];return{classe:'pre_corte',campo:chosen.field,valor:chosen.state.text};
}
function identityTokens(row){
 const d=row.data||{},out=new Set([String(row.id||'')]);
 for(const key of ['id','orderNsu','transactionNsu','nsu']){const v=d[key];if(v!=null&&v!=='')out.add(String(v))}
 return out;
}
function referenceTokens(data={}){
 const out=new Set();
 const visit=(obj,depth=0)=>{
  if(!obj||typeof obj!=='object'||depth>2)return;
  for(const [k,v] of Object.entries(obj)){
   if(v==null)continue;
   if(REF_KEY_RE.test(k)||/Nsu$/i.test(k)){
    if(Array.isArray(v))v.forEach(x=>{if(x!=null&&typeof x!=='object')out.add(String(x))});
    else if(typeof v!=='object')out.add(String(v));
   }
   if(depth<1&&typeof v==='object'&&!Array.isArray(v))visit(v,depth+1);
  }
 };
 visit(data);return out;
}
async function scanOperationalCutoff(db){
 const snaps=await Promise.all(CUTOFF_COLLECTIONS.map(async name=>[name,await db.collection(name).get().catch(()=>({docs:[]}))]));
 const rows=[];
 for(const [collection,snap] of snaps){for(const doc of snap.docs||[]){const data=doc.data()||{},date=classifyDocumentDate(data);rows.push({collection,id:doc.id,ref:doc.ref,data,dateClass:date.classe,dateField:date.campo,dateValue:date.valor,keep:date.classe!=='pre_corte',reason:date.classe})}}
 /* Proteção relacional: uma operação iniciada antes do corte mas concluída/referenciada depois dele não pode ser quebrada. */
 const protectedTokens=new Set();
 for(const row of rows.filter(r=>r.dateClass==='pos_corte')){for(const t of identityTokens(row))if(t)protectedTokens.add(t);for(const t of referenceTokens(row.data))if(t)protectedTokens.add(t)}
 let changed=true;
 while(changed){changed=false;for(const row of rows){if(row.keep)continue;const own=identityTokens(row),refs=referenceTokens(row.data);let linked=false;for(const t of own){if(protectedTokens.has(t)){linked=true;break}}if(!linked)for(const t of refs){if(protectedTokens.has(t)){linked=true;break}}if(!linked)continue;row.keep=true;row.reason='relacionado_pos_corte';changed=true;for(const t of own)if(t)protectedTokens.add(t);for(const t of refs)if(t)protectedTokens.add(t)}}
 const counts={};let arquivar=0,preservar=0,semData=0,relacionados=0;
 for(const name of CUTOFF_COLLECTIONS)counts[name]={total:0,arquivar:0,preservar:0,semData:0,relacionados:0};
 for(const row of rows){const c=counts[row.collection];c.total++;if(row.keep){c.preservar++;preservar++;if(row.dateClass==='sem_data'){c.semData++;semData++}if(row.reason==='relacionado_pos_corte'){c.relacionados++;relacionados++}}else{c.arquivar++;arquivar++}}
 return{rows,counts,resumo:{total:rows.length,arquivar,preservar,semData,relacionados}};
}
function movementImpact(m={}){
 if(m.impactoSaldoCentavos!=null&&Number.isFinite(Number(m.impactoSaldoCentavos)))return Math.round(Number(m.impactoSaldoCentavos));
 if(m.saldoDepoisCentavos!=null&&m.saldoAntesCentavos!=null&&Number.isFinite(Number(m.saldoDepoisCentavos))&&Number.isFinite(Number(m.saldoAntesCentavos)))return Math.round(Number(m.saldoDepoisCentavos)-Number(m.saldoAntesCentavos));
 let v=Math.round(Number(m.valorCentavos||0));if(v<0)return v;
 if(['compra','consumo','saida','compra_farda','venda_conta'].includes(String(m.tipo||'')))return-Math.abs(v);
 return v;
}
async function balancePlan(db,scan){
 const [studentsSnap,accountsSnap,responsiblesSnap,cfgSnap]=await Promise.all([
  db.collection('alunos').get().catch(()=>({docs:[]})),db.collection('contas_responsaveis').get().catch(()=>({docs:[]})),
  db.collection('responsaveis_financeiros').get().catch(()=>({docs:[]})),db.collection('configuracoes').doc('sistema').get().catch(()=>null)
 ]);
 const studentToResponsible=new Map();const activeByResponsible=new Map();
 for(const doc of studentsSnap.docs||[]){const d=doc.data()||{},rid=String(d.responsavelFinanceiroId||d.contaFinanceiraId||'');if(!rid)continue;studentToResponsible.set(String(doc.id),rid);if(d.ativo!==false)activeByResponsible.set(rid,(activeByResponsible.get(rid)||0)+1)}
 const impacts=new Map();let movimentosConsiderados=0,movimentosSemData=0,movimentosPreCorteProtegidos=0;
 for(const row of scan.rows.filter(r=>r.collection==='movimentos_conta')){
  if(row.dateClass==='sem_data'){movimentosSemData++;continue}
  if(row.dateClass!=='pos_corte'){if(row.keep)movimentosPreCorteProtegidos++;continue}
  const m=row.data||{},sid=String(m.alunoId||(Array.isArray(m.alunosIds)?m.alunosIds[0]:'')||(Array.isArray(m.itens)?m.itens.find(x=>x?.alunoId)?.alunoId:'')||''),rid=String(m.responsavelFinanceiroId||m.responsavelId||m.contaFinanceiraId||studentToResponsible.get(sid)||'');
  if(!rid)continue;impacts.set(rid,(impacts.get(rid)||0)+movementImpact(m));movimentosConsiderados++;
 }
 const accounts=new Map((accountsSnap.docs||[]).map(d=>[String(d.id),{id:d.id,...d.data()}]));
 const responsibles=(responsiblesSnap.docs||[]).map(d=>({id:d.id,...d.data()}));
 const currentTotal=[...accounts.values()].reduce((s,a)=>s+Number(a.saldoContaCentavos??(Number(a.saldoCreditoCentavos||0)-Number(a.dividaCentavos||0))),0);
 const projectedTotal=responsibles.reduce((s,r)=>s+Number(impacts.get(String(r.id))||0),0);
 return{
  accounts,responsibles,activeByResponsible,impacts,baseLimit:Number(cfgSnap?.data?.()?.limiteMaximoFiadoCentavos||5000),
  preview:{contas:accounts.size,saldoAtualCentavos:Math.round(currentTotal),saldoAposCorteCentavos:Math.round(projectedTotal),movimentosConsiderados,movimentosSemData,movimentosPreCorteProtegidos,familiasComMovimento:[...impacts.values()].filter(v=>v!==0).length}
 };
}
async function previewReset(db){
 const [scan,base]=await Promise.all([scanOperationalCutoff(db),actualBaseCounts(db)]),plan=await balancePlan(db,scan),important=new Set(['vendas','pagamentos','pagamentos_checkout','pagamentos_venda','movimentos_conta','vendas_online_links','transacoes_infinitepay','sessoes_caixa']);
 const amostrasPreservadas=scan.rows.filter(r=>r.keep&&r.dateClass==='pos_corte'&&important.has(r.collection)).sort((a,b)=>String(b.dateValue||'').localeCompare(String(a.dateValue||''))).slice(0,12).map(r=>({colecao:r.collection,id:r.id,data:r.dateValue||null,alunoNome:r.data?.alunoNome||null,descricao:r.data?.descricao||r.data?.tipo||r.data?.operacao||null,valorCentavos:Number(r.data?.valorBrutoCentavos??r.data?.totalCentavos??r.data?.valorCentavos??0)}));
 return{dataCorte:OPERATION_CUTOFF,colecoes:scan.counts,resumo:scan.resumo,totalDocumentos:scan.resumo.total,preservado:PRESERVED_LABELS,baseOficial:base,contas:plan.preview,amostrasPreservadas};
}
async function backupAndClear(db,staff,scan,plan){
 const backupId=`implantacao_${Date.now()}`,root=db.collection('backups_implantacao').doc(backupId),created=nowIso();
 await root.set({id:backupId,tipo:'corte_operacional_por_data',criadoEm:created,criadoPorId:staff.id,criadoPorNome:staff.nome,colecoes:CUTOFF_COLLECTIONS,corteInicioEm:OPERATION_CUTOFF.inicioEm,dataCorteLocal:OPERATION_CUTOFF.dataLocal,timezone:OPERATION_CUTOFF.timezone,status:'em_andamento',resumoPrevio:scan.resumo});
 let total=0,accountSnapshots=0;
 const accountOps=[];for(const [id,data] of plan.accounts){const safeId=`contas_responsaveis__${Buffer.from(id).toString('base64url')}`;accountOps.push({kind:'set',ref:root.collection('documentos').doc(safeId),data:{colecao:'contas_responsaveis',documentoId:id,dados:data,tipoRegistro:'snapshot_conta_antes_corte'},options:{merge:false}});accountSnapshots++}if(accountOps.length)await commitChunks(db,accountOps,380);
 const byCollection=new Map();for(const row of scan.rows.filter(r=>!r.keep)){if(!byCollection.has(row.collection))byCollection.set(row.collection,[]);byCollection.get(row.collection).push(row)}
 for(const [name,rows] of byCollection){const ops=[];for(const row of rows){const safeId=`${name}__${Buffer.from(row.id).toString('base64url')}`;ops.push({kind:'set',ref:root.collection('documentos').doc(safeId),data:{colecao:name,documentoId:row.id,dados:row.data,tipoRegistro:'arquivado_pre_corte',criterioData:{classe:row.dateClass,campo:row.dateField,valor:row.dateValue}},options:{merge:false}});ops.push({kind:'delete',ref:row.ref});total++}await commitChunks(db,ops,380)}
 await root.set({status:'arquivamento_concluido',documentosArquivados:total,snapshotsContas:accountSnapshots,arquivamentoConcluidoEm:nowIso()},{merge:true});
 return{backupId,totalArquivados:total,snapshotsContas:accountSnapshots};
}
function isPostCutoffValue(value){const s=valueDateState(value);return s?compareDateState(s)==='pos':false}
async function reconcileFamilyAccounts(db,plan){
 const now=nowIso(),ops=[],base=Math.max(0,Number(plan.baseLimit||5000));let changed=0,total=0;
 for(const r of plan.responsibles){const rid=String(r.id),old=plan.accounts.get(rid)||{},count=Math.max(1,Number(r.quantidadeAlunosAtivos||plan.activeByResponsible.get(rid)||0)),max=base*count,net=Math.round(Number(plan.impacts.get(rid)||0)),limit=Math.max(0,Math.min(max,Number(old.limiteFiadoCentavos||0))),weekly=net<0&&Boolean(old.bloqueioSaldoSemanal)&&isPostCutoffValue(old.bloqueioSemanalEm),patch={responsavelId:rid,quantidadeAlunosAtivos:Number(r.quantidadeAlunosAtivos||plan.activeByResponsible.get(rid)||0),limiteBasePorAlunoCentavos:base,limiteMaximoFamiliaCentavos:max,limiteFiadoCentavos:limit,autorizadoSemSaldo:Boolean(old.autorizadoSemSaldo),bloqueioManual:Boolean(old.bloqueioManual),bloqueadoPorLimite:net<0&&limit>0&&Math.abs(net)>=limit,bloqueioSaldoSemanal:weekly,...accountSplit(net),marcoOperacionalInicioEm:OPERATION_CUTOFF.inicioEm,marcoOperacionalSaldoRecalculadoEm:now,atualizadoEm:now};if(!weekly){patch.fechamentoSemanalId=null;patch.bloqueioSemanalEm=null}ops.push({kind:'set',ref:db.collection('contas_responsaveis').doc(rid),data:patch,options:{merge:true}});changed++;total+=net}
 if(ops.length)await commitChunks(db,ops);return{contasRecalculadas:changed,saldoConsolidadoCentavos:Math.round(total),movimentosConsiderados:plan.preview.movimentosConsiderados};
}

module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 const db=initFirebase(),b=parseBody(req);
 try{
  const staff=await verifyStaff(db,req,['admin','gestao']),acao=String(b.acao||'');
  if(acao==='status')return json(res,200,{ok:true,...await status(db)});
  if(acao==='preparar_base')return json(res,200,{ok:true,...await prepareBase(db,staff),...await status(db)});
  if(acao==='preview_reset')return json(res,200,{ok:true,...await previewReset(db)});
  if(acao==='iniciar_operacao'){
   if(String(b.confirmacao||'').trim()!=='INICIAR OPERAÇÃO REAL')return json(res,400,{error:'Digite exatamente INICIAR OPERAÇÃO REAL para confirmar.'});
   const current=await status(db);
   if(!current.preparada)return json(res,409,{error:'Prepare a base oficial de alunos e responsáveis antes do marco zero.'});
   if(current.cpfPendentes.length)return json(res,409,{error:'Existe responsável com CPF pendente. Corrija antes de iniciar a operação oficial.',cpfPendentes:current.cpfPendentes});
   if(current.operacaoOficial)return json(res,409,{error:'O marco operacional já foi registrado e não pode ser executado novamente por este fluxo.'});
   const scan=await scanOperationalCutoff(db),planAntes=await balancePlan(db,scan),backup=await backupAndClear(db,staff,scan,planAntes),scanDepois=await scanOperationalCutoff(db),planDepois=await balancePlan(db,scanDepois),accounts=await reconcileFamilyAccounts(db,planDepois),base=await actualBaseCounts(db),executed=nowIso();
   await db.collection('backups_implantacao').doc(backup.backupId).set({status:'concluido',contasRecalculadas:accounts.contasRecalculadas,saldoConsolidadoCentavos:accounts.saldoConsolidadoCentavos,concluidoEm:executed},{merge:true});
   const marco={id:'operacao_oficial',tipo:'corte_operacional_por_data',inicioEm:OPERATION_CUTOFF.inicioEm,dataCorteLocal:OPERATION_CUTOFF.dataLocal,timezone:OPERATION_CUTOFF.timezone,executadoEm:executed,anoLetivo:2026,pilotoControlado:true,backupId:backup.backupId,criadoPorId:staff.id,criadoPorNome:staff.nome,baseAlunos:base.alunos,baseResponsaveis:base.responsaveis,baseVinculos:base.vinculos,documentosArquivados:backup.totalArquivados,documentosPreservados:scanDepois.resumo.preservar,contasRecalculadas:accounts.contasRecalculadas,saldoConsolidadoCentavos:accounts.saldoConsolidadoCentavos};
   await db.collection('marcos_operacao').doc('operacao_oficial').set(marco);
   await db.collection('configuracoes').doc('sistema').set({operacaoOficialInicioEm:OPERATION_CUTOFF.inicioEm,operacaoOficialDataCorteLocal:OPERATION_CUTOFF.dataLocal,operacaoOficialTimezone:OPERATION_CUTOFF.timezone,operacaoOficialExecutadoEm:executed,operacaoOficialBackupId:backup.backupId,pilotoControlado:true,atualizadoEm:executed},{merge:true});
   await db.collection('historico_auditoria').add({acao:'operacao_oficial_iniciada',tituloHumano:'Marco inicial da operação registrado',descricaoHumana:`Corte operacional aplicado em ${OPERATION_CUTOFF.rotulo}. Foram arquivados ${backup.totalArquivados} registros anteriores ao corte e preservados ${scanDepois.resumo.preservar} registros da implantação. Base: ${base.alunos} alunos ativos e ${base.responsaveis} responsáveis financeiros.`,usuarioId:staff.id,usuarioNome:staff.nome,usuarioPerfil:staff.perfil,criadoEm:executed,versao:VERSION,dados:{corte:OPERATION_CUTOFF,backupId:backup.backupId,arquivados:backup.totalArquivados,preservados:scanDepois.resumo.preservar,contas:accounts}});
   return json(res,200,{ok:true,marco,backup,contas:accounts,resumo:scanDepois.resumo});
  }
  return json(res,400,{error:'Ação inválida.'});
 }catch(e){console.error('implantacao',e);return json(res,e.status||500,{error:e.message||'Não foi possível concluir a operação.'})}
};
