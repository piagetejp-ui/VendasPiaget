const {initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff}=require('./_family-utils');

const VERSION='1.6.0-rc2.7.23';
const BASE_META={anoLetivo:2026,geradoDe:'SIGA 07/08/2026',alunos:214,responsaveis:187,vinculos:214};
const OPERATION_CUTOFF={
  dataLocal:'2026-08-10',
  inicioEm:'2026-08-10T03:00:00.000Z',
  timezone:'America/Fortaleza',
  rotulo:'10/08/2026'
};

/*
  RC2.7.16 — Marco Zero por ORIGEM da operação.

  Regra conceitual:
  - uma operação normal nasce quando seu registro raiz é criado no sistema;
  - datas de entrega, competência, vencimento, dataChave ou atualização não
    transformam um teste antigo em operação real;
  - um lançamento retroativo real é diferente: a dataOperacao pode ser anterior
    ao corte, mas registradoEm/criadoEm identifica quando ele entrou de verdade
    no sistema;
  - documentos filhos herdam a classificação da operação raiz quando houver
    vínculo inequívoco;
  - estados derivados (capacidade de salgados e reservas de farda) são
    reconciliados após o arquivamento, sem mexer no estoque físico.
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
const PRESERVED_LABELS=['alunos e matrículas','responsáveis e vínculos','catálogo','preços e estoque físico atual','configurações','usuários da equipe','operações cuja origem é 10/08/2026 ou posterior','lançamentos retroativos reais registrados a partir de 10/08/2026'];

const ROOT_PRIORITY={
  lancamentos_manuais:140,
  pagamentos_checkout:135,
  vendas_online_links:134,
  vendas:130,
  pedidos:120,
  pedidos_farda:120,
  pedidos_operacionais:120,
  sessoes_caixa:110,
  caixas:105,
  fechamentos_semanais:100,
  fechamentos_semanais_familias:100,
  fechamentos_caixa:100,
  fechamentos_cantina:100
};
const ROOT_COLLECTIONS=new Set(Object.keys(ROOT_PRIORITY));
const ACCESS_STATE_COLLECTIONS=new Set(['responsaveis_acesso','ativacoes_meu_piaget','sessoes_meu_piaget','solicitacoes_reset_responsavel','reset_senha_responsavel','seguranca_rate_limit']);
const ORIGIN_FIELDS=['criadoEm','registradoEm','recebidoEm','abertoEm','inicioEm','geradoEm','enviadoEm','processadoEm','confirmadoEm','pagoEm','aplicadoEm','reservadoEm'];
const ACCESS_EVENT_FIELDS=['criadoEm','registradoEm','senhaCriadaEm','senhaRedefinidaEm','ultimoAcessoEm','ultimoUsoEm','reativadoEm','bloqueadoEm','atualizadoEm'];
const REF_KEY_RE=/(venda|pedido|checkout|moviment|sessao|periodo|caixa|fechamento|pagamento|taxa|transacao|transferencia|link|ocorrencia|tentativa|solicitacao|evento|lancamento|source).*?(Id|Ids|Nsu)$/i;

function cents(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n):0}
function accountSplit(net){net=Math.round(Number(net||0));return{saldoContaCentavos:net,saldoCreditoCentavos:Math.max(0,net),dividaCentavos:Math.max(0,-net)}}
async function commitChunks(db,ops,max=420){for(let i=0;i<ops.length;i+=max){const batch=db.batch();for(const op of ops.slice(i,i+max)){if(op.kind==='set')batch.set(op.ref,op.data,op.options||{merge:true});else if(op.kind==='delete')batch.delete(op.ref)}await batch.commit()}}
async function countQueryV218(q){
 try{const s=await q.count().get();return Number(s.data()?.count||0)}catch(_){const s=await q.limit(500).get().catch(()=>({size:0}));return Number(s.size||0)}
}
async function actualBaseCounts(db){
 const [alunos,responsaveis,vinculos]=await Promise.all([
  countQueryV218(db.collection('alunos').where('ativo','==',true)),
  countQueryV218(db.collection('responsaveis_financeiros').where('ativo','==',true)),
  countQueryV218(db.collection('vinculos_responsavel_aluno').where('ativo','==',true))
 ]);
 return{alunos,responsaveis,vinculos}
}
async function prepareBase(db){
 const cfg=await db.collection('configuracoes').doc('sistema').get();
 if(cfg.exists&&cfg.data()?.baseOficial2026Preparada){const atual=await actualBaseCounts(db);return{...atual,jaPreparada:true,fonte:'Firestore'}}
 throw Object.assign(new Error('A base oficial não é mais incorporada ao código-fonte por segurança. Faça a importação administrativa protegida antes de preparar uma base vazia.'),{status:409});
}
async function status(db){
 const [cfg,invalid,marco,atual]=await Promise.all([
  db.collection('configuracoes').doc('sistema').get(),
  db.collection('responsaveis_financeiros').where('cpfValido','==',false).limit(50).get().catch(()=>({docs:[]})),
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
function firstValidDate(data,fields){for(const field of fields){const state=valueDateState(data?.[field]);if(state)return{field,state,side:compareDateState(state)}}return null}
function latestValidDate(data,fields){const found=[];for(const field of fields){const state=valueDateState(data?.[field]);if(state)found.push({field,state,side:compareDateState(state)})}if(!found.length)return null;found.sort((a,b)=>{const av=a.state.ms??Date.parse(`${a.state.localKey}T03:00:00Z`),bv=b.state.ms??Date.parse(`${b.state.localKey}T03:00:00Z`);return bv-av});return found[0]}
function isManualRetroactive(collection,data={}){
 const origin=String(data.origem||data.solicitadoVia||'').toLowerCase(),sub=String(data.subtipo||'').toLowerCase();
 return collection==='lancamentos_manuais'||data.retroativo===true||origin==='secretaria_lancamento_manual'||sub==='lancamento_manual_aberto'||Boolean(data.lancamentoManualId);
}
function directOriginClass(collection,data={}){
 // Estado diário derivado: a data do próprio dia só decide se o documento diário antigo pode ser arquivado.
 if(collection==='disponibilidade_salgados'){
  const state=valueDateState(data.dataChave||data.data);if(!state)return{classe:'sem_data',campo:null,valor:null,motivo:'estado_derivado_sem_data'};
  return{classe:compareDateState(state)==='pos'?'pos_corte':'pre_corte',campo:data.dataChave?'dataChave':'data',valor:state.text,motivo:'data_estado_derivado'};
 }
 // Retroativo real: dataOperacao é histórica; a origem é quando a Secretaria registrou no sistema.
 if(isManualRetroactive(collection,data)){
  const reg=firstValidDate(data,['registradoEm','criadoEm']);
  if(!reg)return{classe:'sem_data',campo:null,valor:null,motivo:'retroativo_sem_data_registro'};
  return{classe:reg.side==='pos'?'retroativo_real':'pre_corte',campo:reg.field,valor:reg.state.text,motivo:reg.side==='pos'?'retroativo_registrado_pos_corte':'retroativo_registrado_pre_corte'};
 }
 // Credenciais/sessões são estado de acesso, não programação operacional. Se houve evento real após o corte, preserva.
 if(ACCESS_STATE_COLLECTIONS.has(collection)){
  const evt=latestValidDate(data,ACCESS_EVENT_FIELDS);
  if(!evt)return{classe:'sem_data',campo:null,valor:null,motivo:'acesso_sem_data'};
  return{classe:evt.side==='pos'?'pos_corte':'pre_corte',campo:evt.field,valor:evt.state.text,motivo:'estado_acesso'};
 }
 // Operações normais: primeira data de ORIGEM disponível. Nunca usa dataChave/dataOperacao/atualizadoEm para decidir a origem.
 const origin=firstValidDate(data,ORIGIN_FIELDS);
 if(!origin)return{classe:'sem_data',campo:null,valor:null,motivo:'origem_sem_data'};
 return{classe:origin.side==='pos'?'pos_corte':'pre_corte',campo:origin.field,valor:origin.state.text,motivo:'data_origem'};
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
function addMapSet(map,key,value){if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(value)}
function rowPriority(row){return Number(ROOT_PRIORITY[row.collection]||0)}
function chooseHigherRoot(row,candidates,onlyHigher=false){
 const own=rowPriority(row),valid=[...candidates].filter(r=>r&&r!==row&&r.resolvedClass!=='sem_data'&&(!onlyHigher||rowPriority(r)>own));
 if(!valid.length)return null;
 valid.sort((a,b)=>rowPriority(b)-rowPriority(a)||String(a.collection).localeCompare(String(b.collection))||String(a.id).localeCompare(String(b.id)));
 return valid[0];
}
async function scanOperationalCutoff(db){
 const snaps=await Promise.all(CUTOFF_COLLECTIONS.map(async name=>[name,await db.collection(name).get().catch(()=>({docs:[]}))]));
 const rows=[];
 for(const [collection,snap] of snaps){
  for(const doc of snap.docs||[]){
   const data=doc.data()||{},direct=directOriginClass(collection,data);
   rows.push({collection,id:doc.id,ref:doc.ref,data,directClass:direct.classe,resolvedClass:direct.classe,dateField:direct.campo,dateValue:direct.valor,directReason:direct.motivo,rootCollection:null,rootId:null,keep:direct.classe!=='pre_corte',reason:direct.motivo});
  }
 }
 const roots=rows.filter(r=>ROOT_COLLECTIONS.has(r.collection));
 const rootsByIdentity=new Map(),rootsClaiming=new Map();
 for(const root of roots){for(const token of identityTokens(root))addMapSet(rootsByIdentity,token,root);for(const token of referenceTokens(root.data))addMapSet(rootsClaiming,token,root)}
 function linkedRoots(row){
  const set=new Set();if(ROOT_COLLECTIONS.has(row.collection))set.add(row);
  for(const token of referenceTokens(row.data))for(const r of rootsByIdentity.get(token)||[])set.add(r);
  for(const token of identityTokens(row))for(const r of rootsClaiming.get(token)||[])set.add(r);
  return set;
 }
 // Resolve roots from the strongest origin to the weakest (manual retroativo > checkout/link > venda > pedido...).
 const ordered=[...roots].sort((a,b)=>rowPriority(b)-rowPriority(a));
 for(let pass=0;pass<3;pass++){
  for(const row of ordered){const parent=chooseHigherRoot(row,linkedRoots(row),true);if(!parent)continue;row.resolvedClass=parent.resolvedClass;row.rootCollection=parent.rootCollection||parent.collection;row.rootId=parent.rootId||parent.id;row.reason=`origem_raiz_${row.rootCollection}`;}
 }
 // Every child inherits the strongest linked root. A target/future date never protects a child of a pre-cutoff root.
 for(const row of rows){
  const root=chooseHigherRoot(row,linkedRoots(row),ROOT_COLLECTIONS.has(row.collection));
  if(root){row.resolvedClass=root.resolvedClass;row.rootCollection=root.rootCollection||root.collection;row.rootId=root.rootId||root.id;row.reason=`origem_raiz_${row.rootCollection}`;}
  if(row.directClass==='retroativo_real'&&row.resolvedClass!=='pre_corte'){row.resolvedClass='retroativo_real';row.reason='retroativo_real'}
  row.keep=row.resolvedClass!=='pre_corte';
 }
 const counts={};let arquivar=0,preservar=0,semData=0,retroativos=0,herdados=0;
 for(const name of CUTOFF_COLLECTIONS)counts[name]={total:0,arquivar:0,preservar:0,semData:0,retroativos:0,herdados:0};
 for(const row of rows){
  const c=counts[row.collection];c.total++;
  if(row.keep){c.preservar++;preservar++;if(row.resolvedClass==='sem_data'){c.semData++;semData++}if(row.resolvedClass==='retroativo_real'){c.retroativos++;retroativos++}if(row.rootCollection){c.herdados++;herdados++}}
  else{c.arquivar++;arquivar++}
 }
 return{rows,counts,resumo:{total:rows.length,arquivar,preservar,semData,retroativos,herdados}};
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
 const studentToResponsible=new Map(),activeByResponsible=new Map();
 for(const doc of studentsSnap.docs||[]){const d=doc.data()||{},rid=String(d.responsavelFinanceiroId||d.contaFinanceiraId||'');if(!rid)continue;studentToResponsible.set(String(doc.id),rid);if(d.ativo!==false)activeByResponsible.set(rid,(activeByResponsible.get(rid)||0)+1)}
 const impacts=new Map();let movimentosConsiderados=0,movimentosRetroativos=0,movimentosSemOrigem=0;
 for(const row of scan.rows.filter(r=>r.collection==='movimentos_conta')){
  if(!row.keep)continue;
  if(row.resolvedClass==='sem_data'){movimentosSemOrigem++;continue}
  const m=row.data||{},sid=String(m.alunoId||(Array.isArray(m.alunosIds)?m.alunosIds[0]:'')||(Array.isArray(m.itens)?m.itens.find(x=>x?.alunoId)?.alunoId:'')||''),rid=String(m.responsavelFinanceiroId||m.responsavelId||m.contaFinanceiraId||studentToResponsible.get(sid)||'');
  if(!rid)continue;impacts.set(rid,(impacts.get(rid)||0)+movementImpact(m));movimentosConsiderados++;if(row.resolvedClass==='retroativo_real'||isManualRetroactive(row.collection,m))movimentosRetroativos++;
 }
 const accounts=new Map((accountsSnap.docs||[]).map(d=>[String(d.id),{id:d.id,...d.data()}]));
 const responsibles=(responsiblesSnap.docs||[]).map(d=>({id:d.id,...d.data()}));
 const currentTotal=[...accounts.values()].reduce((s,a)=>s+Number(a.saldoContaCentavos??(Number(a.saldoCreditoCentavos||0)-Number(a.dividaCentavos||0))),0);
 const projectedTotal=responsibles.reduce((s,r)=>s+Number(impacts.get(String(r.id))||0),0);
 return{
  accounts,responsibles,activeByResponsible,impacts,baseLimit:Number(cfgSnap?.data?.()?.limiteMaximoFiadoCentavos||5000),
  preview:{contas:accounts.size,saldoAtualCentavos:Math.round(currentTotal),saldoAposCorteCentavos:Math.round(projectedTotal),movimentosConsiderados,movimentosRetroativos,movimentosSemOrigem,familiasComMovimento:[...impacts.values()].filter(v=>v!==0).length}
 };
}
function sampleRow(row){
 const d=row.data||{};return{colecao:row.collection,id:row.id,data:row.dateValue||d.registradoEm||d.criadoEm||null,dataOperacao:d.dataOperacao||d.dataChave||null,alunoNome:d.alunoNome||null,descricao:d.descricao||d.nome||d.tipo||d.operacao||null,valorCentavos:Number(d.valorBrutoCentavos??d.totalCentavos??d.valorCompraCentavos??Math.abs(Number(d.valorCentavos||0))??0),classe:row.resolvedClass,raiz:row.rootCollection?`${row.rootCollection}/${row.rootId}`:null,reason:row.reason};
}
async function previewReset(db){
 const [scan,base]=await Promise.all([scanOperationalCutoff(db),actualBaseCounts(db)]),plan=await balancePlan(db,scan);
 const important=new Set(['vendas','pedidos','pedidos_farda','pedidos_operacionais','lancamentos_manuais','pagamentos','pagamentos_checkout','pagamentos_venda','movimentos_conta','vendas_online_links','transacoes_infinitepay','sessoes_caixa','ocorrencias_entrega']);
 const amostrasImplantacao=scan.rows.filter(r=>r.keep&&r.resolvedClass==='pos_corte'&&important.has(r.collection)).sort((a,b)=>String(b.dateValue||'').localeCompare(String(a.dateValue||''))).slice(0,12).map(sampleRow);
 const amostrasRetroativas=scan.rows.filter(r=>r.keep&&r.resolvedClass==='retroativo_real'&&important.has(r.collection)).sort((a,b)=>String(b.data?.registradoEm||b.dateValue||'').localeCompare(String(a.data?.registradoEm||a.dateValue||''))).slice(0,12).map(sampleRow);
 const amostrasArquivar=scan.rows.filter(r=>!r.keep&&important.has(r.collection)).sort((a,b)=>String(b.dateValue||'').localeCompare(String(a.dateValue||''))).slice(0,12).map(sampleRow);
 const derivado=await derivedPreview(db,scan);
 return{dataCorte:OPERATION_CUTOFF,criterio:'origem_operacao',colecoes:scan.counts,resumo:scan.resumo,totalDocumentos:scan.resumo.total,preservado:PRESERVED_LABELS,baseOficial:base,contas:plan.preview,amostrasImplantacao,amostrasRetroativas,amostrasArquivar,derivados:derivado};
}
async function backupAndClear(db,staff,scan,plan){
 const backupId=`implantacao_${Date.now()}`,root=db.collection('backups_implantacao').doc(backupId),created=nowIso();
 await root.set({id:backupId,tipo:'corte_operacional_por_origem',criadoEm:created,criadoPorId:staff.id,criadoPorNome:staff.nome,colecoes:CUTOFF_COLLECTIONS,corteInicioEm:OPERATION_CUTOFF.inicioEm,dataCorteLocal:OPERATION_CUTOFF.dataLocal,timezone:OPERATION_CUTOFF.timezone,criterio:'origem_operacao',status:'em_andamento',resumoPrevio:scan.resumo});
 let total=0,accountSnapshots=0;
 const accountOps=[];for(const [id,data] of plan.accounts){const safeId=`contas_responsaveis__${Buffer.from(id).toString('base64url')}`;accountOps.push({kind:'set',ref:root.collection('documentos').doc(safeId),data:{colecao:'contas_responsaveis',documentoId:id,dados:data,tipoRegistro:'snapshot_conta_antes_corte'},options:{merge:false}});accountSnapshots++}if(accountOps.length)await commitChunks(db,accountOps,380);
 const byCollection=new Map();for(const row of scan.rows.filter(r=>!r.keep)){if(!byCollection.has(row.collection))byCollection.set(row.collection,[]);byCollection.get(row.collection).push(row)}
 for(const [name,rows] of byCollection){const ops=[];for(const row of rows){const safeId=`${name}__${Buffer.from(row.id).toString('base64url')}`;ops.push({kind:'set',ref:root.collection('documentos').doc(safeId),data:{colecao:name,documentoId:row.id,dados:row.data,tipoRegistro:'arquivado_pre_corte',criterioOrigem:{classe:row.resolvedClass,campo:row.dateField,valor:row.dateValue,motivo:row.reason,raizColecao:row.rootCollection,raizId:row.rootId}},options:{merge:false}});ops.push({kind:'delete',ref:row.ref});total++}await commitChunks(db,ops,380)}
 await root.set({status:'arquivamento_concluido',documentosArquivados:total,snapshotsContas:accountSnapshots,arquivamentoConcluidoEm:nowIso()},{merge:true});
 return{backupId,totalArquivados:total,snapshotsContas:accountSnapshots};
}
function isPostCutoffValue(value){const s=valueDateState(value);return s?compareDateState(s)==='pos':false}
async function reconcileFamilyAccounts(db,plan){
 const now=nowIso(),ops=[],base=Math.max(0,Number(plan.baseLimit||5000));let changed=0,total=0;
 for(const r of plan.responsibles){const rid=String(r.id),old=plan.accounts.get(rid)||{},count=Math.max(1,Number(r.quantidadeAlunosAtivos||plan.activeByResponsible.get(rid)||0)),max=base*count,net=Math.round(Number(plan.impacts.get(rid)||0)),limit=Math.max(0,Math.min(max,Number(old.limiteFiadoCentavos||0))),weekly=net<0&&Boolean(old.bloqueioSaldoSemanal)&&isPostCutoffValue(old.bloqueioSemanalEm),patch={responsavelId:rid,quantidadeAlunosAtivos:Number(r.quantidadeAlunosAtivos||plan.activeByResponsible.get(rid)||0),limiteBasePorAlunoCentavos:base,limiteMaximoFamiliaCentavos:max,limiteFiadoCentavos:limit,autorizadoSemSaldo:Boolean(old.autorizadoSemSaldo),bloqueioManual:Boolean(old.bloqueioManual),bloqueadoPorLimite:net<0&&limit>0&&Math.abs(net)>=limit,bloqueioSaldoSemanal:weekly,...accountSplit(net),marcoOperacionalInicioEm:OPERATION_CUTOFF.inicioEm,marcoOperacionalSaldoRecalculadoEm:now,atualizadoEm:now};if(!weekly){patch.fechamentoSemanalId=null;patch.bloqueioSemanalEm=null}ops.push({kind:'set',ref:db.collection('contas_responsaveis').doc(rid),data:patch,options:{merge:true}});changed++;total+=net}
 if(ops.length)await commitChunks(db,ops);return{contasRecalculadas:changed,saldoConsolidadoCentavos:Math.round(total),movimentosConsiderados:plan.preview.movimentosConsiderados,movimentosRetroativos:plan.preview.movimentosRetroativos};
}
function salgadoQtyFromOccurrence(o={}){
 if(Number.isFinite(Number(o.quantidadeSalgados)))return Math.max(0,cents(o.quantidadeSalgados));
 const comps=Array.isArray(o.componentes)?o.componentes:[];const fromComps=comps.filter(x=>String(x?.produtoId||'')==='salgado').reduce((s,x)=>s+cents(x?.quantidade),0);if(fromComps)return Math.max(0,fromComps);
 return Math.max(0,(Array.isArray(o.itens)?o.itens:[]).filter(x=>String(x?.produtoId||'')==='salgado').reduce((s,x)=>s+cents(x?.quantidade),0));
}
function occurrenceConsumesCapacity(o={}){return !['cancelado','cancelado_responsavel','aluno_ausente','ausente','nao_entregue','não_entregue','remarcado','encerrado'].includes(String(o.status||'').toLowerCase())}
function uniformStockId(modelId,size,gender=''){
 const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'unico';
 return `farda__${clean(modelId)}__${clean(size)}__${clean(gender||'unico')}`;
}
function uniformCommitment(order={}){
 const status=String(order.statusAtendimento||'').toLowerCase();if(['cancelado','entregue','nao_concluido'].includes(status))return{reserved:0,production:0};
 return{reserved:Math.max(0,cents(order.quantidadeReservadaEstoque||(order.estoqueReservado?order.quantidade:0))),production:Math.max(0,cents(order.quantidadeAguardandoProducao))};
}
async function derivedPreview(db,scan){
 const keptOccurrences=scan.rows.filter(r=>r.collection==='ocorrencias_entrega'&&r.keep&&r.resolvedClass!=='sem_data'&&occurrenceConsumesCapacity(r.data));
 const keptUniforms=scan.rows.filter(r=>r.collection==='pedidos_farda'&&r.keep&&r.resolvedClass!=='sem_data');
 const futureDates=new Set(keptOccurrences.map(r=>String(r.data?.dataChave||'')).filter(Boolean));
 const uniformCommitted=keptUniforms.reduce((s,r)=>{const c=uniformCommitment(r.data);return s+c.reserved+c.production},0);
 return{datasSalgadosRecalculadas:futureDates.size,ocorrenciasSalgadosConsideradas:keptOccurrences.length,pedidosFardaConsiderados:keptUniforms.length,unidadesFardaComprometidas:uniformCommitted};
}
async function reconcileDailyAvailability(db,scan){
 const now=nowIso(),confirmedByDate=new Map(),keptOrderIds=new Set(scan.rows.filter(r=>r.collection==='pedidos'&&r.keep&&r.resolvedClass!=='sem_data').map(r=>String(r.id)));
 for(const row of scan.rows.filter(r=>r.collection==='ocorrencias_entrega'&&r.keep&&r.resolvedClass!=='sem_data')){const o=row.data||{},day=String(o.dataChave||'');if(!day||!occurrenceConsumesCapacity(o))continue;confirmedByDate.set(day,(confirmedByDate.get(day)||0)+salgadoQtyFromOccurrence(o))}
 const snaps=await db.collection('disponibilidade_salgados').get().catch(()=>({docs:[]})),existing=new Map((snaps.docs||[]).map(d=>[String(d.id),{ref:d.ref,data:d.data()||{}}])),days=new Set([...existing.keys()].filter(d=>d>=OPERATION_CUTOFF.dataLocal));for(const d of confirmedByDate.keys())if(d>=OPERATION_CUTOFF.dataLocal)days.add(d);
 const ops=[];let reservationsRemoved=0,daysChanged=0;
 for(const day of days){const cur=existing.get(day)?.data||{},reservas={};for(const [key,val] of Object.entries(cur.reservas||{})){const pid=String(val?.pedidoId||key);if(!keptOrderIds.has(pid)){reservationsRemoved++;continue}const exp=Date.parse(String(val?.expiraEm||''));if(Number.isFinite(exp)&&exp<=Date.now())continue;reservas[key]=val}
  const patch={dataChave:day,pedidosConfirmados:Math.max(0,cents(confirmedByDate.get(day)||0)),reservas,marcoOperacionalReconciliadoEm:now,atualizadoEm:now};ops.push({kind:'set',ref:db.collection('disponibilidade_salgados').doc(day),data:patch,options:{merge:true}});daysChanged++}
 if(ops.length)await commitChunks(db,ops);return{datasRecalculadas:daysChanged,reservasTesteRemovidas:reservationsRemoved};
}
async function reconcileUniformReservations(db,scan){
 const desired=new Map();let orders=0;
 for(const row of scan.rows.filter(r=>r.collection==='pedidos_farda'&&r.keep&&r.resolvedClass!=='sem_data')){const o=row.data||{},c=uniformCommitment(o);if(!c.reserved&&!c.production)continue;const sid=uniformStockId(o.modeloFardaId||'camisa_padrao',o.tamanho,o.modelo||''),v=desired.get(sid)||{reserved:0,production:0};v.reserved+=c.reserved;v.production+=c.production;desired.set(sid,v);orders++}
 const snaps=await db.collection('estoques').get().catch(()=>({docs:[]})),ops=[];let stocks=0;
 for(const doc of snaps.docs||[]){const d=doc.data()||{};if(String(d.tipo||'')!=='farda'&&!String(doc.id).startsWith('farda__'))continue;const v=desired.get(String(doc.id))||{reserved:0,production:0};ops.push({kind:'set',ref:doc.ref,data:{quantidadeReservada:Math.max(0,cents(v.reserved)),quantidadeComprometidaProducao:Math.max(0,cents(v.production)),quantidadeEmProducao:v.production>0?Math.max(5,cents(v.production)):0,marcoOperacionalReconciliadoEm:nowIso(),atualizadoEm:nowIso()},options:{merge:true}});stocks++}
 if(ops.length)await commitChunks(db,ops);return{estoquesReconciliados:stocks,pedidosFardaConsiderados:orders,estoqueFisicoAlterado:false,producaoOperacionalNormalizada:true};
}

module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 const db=initFirebase(),b=parseBody(req);
 try{
  const staff=await verifyStaff(db,req,['admin','gestao']),acao=String(b.acao||'');
  if(acao==='status')return json(res,200,{ok:true,...await status(db)});
  if(acao==='preparar_base')return json(res,200,{ok:true,...await prepareBase(db),...await status(db)});
  if(acao==='preview_reset')return json(res,200,{ok:true,...await previewReset(db)});
  if(acao==='iniciar_operacao'){
   if(String(b.confirmacao||'').trim()!=='INICIAR OPERAÇÃO REAL')return json(res,400,{error:'Digite exatamente INICIAR OPERAÇÃO REAL para confirmar.'});
   const current=await status(db);
   if(!current.preparada)return json(res,409,{error:'Prepare a base oficial de alunos e responsáveis antes do marco zero.'});
   if(current.cpfPendentes.length)return json(res,409,{error:'Existe responsável com CPF pendente. Corrija antes de iniciar a operação oficial.',cpfPendentes:current.cpfPendentes});
   if(current.operacaoOficial)return json(res,409,{error:'O marco operacional já foi registrado e não pode ser executado novamente por este fluxo.'});
   const scan=await scanOperationalCutoff(db),planAntes=await balancePlan(db,scan),backup=await backupAndClear(db,staff,scan,planAntes),scanDepois=await scanOperationalCutoff(db),planDepois=await balancePlan(db,scanDepois),accounts=await reconcileFamilyAccounts(db,planDepois),availability=await reconcileDailyAvailability(db,scanDepois),uniforms=await reconcileUniformReservations(db,scanDepois),base=await actualBaseCounts(db),executed=nowIso();
   await db.collection('backups_implantacao').doc(backup.backupId).set({status:'concluido',contasRecalculadas:accounts.contasRecalculadas,saldoConsolidadoCentavos:accounts.saldoConsolidadoCentavos,reconciliacaoSalgados:availability,reconciliacaoFardamento:uniforms,concluidoEm:executed},{merge:true});
   const marco={id:'operacao_oficial',tipo:'corte_operacional_por_origem',criterio:'origem_operacao',inicioEm:OPERATION_CUTOFF.inicioEm,dataCorteLocal:OPERATION_CUTOFF.dataLocal,timezone:OPERATION_CUTOFF.timezone,executadoEm:executed,anoLetivo:2026,pilotoControlado:true,backupId:backup.backupId,criadoPorId:staff.id,criadoPorNome:staff.nome,baseAlunos:base.alunos,baseResponsaveis:base.responsaveis,baseVinculos:base.vinculos,documentosArquivados:backup.totalArquivados,documentosPreservados:scanDepois.resumo.preservar,retroativosReaisPreservados:scanDepois.resumo.retroativos,contasRecalculadas:accounts.contasRecalculadas,saldoConsolidadoCentavos:accounts.saldoConsolidadoCentavos,reconciliacaoSalgados:availability,reconciliacaoFardamento:uniforms};
   await db.collection('marcos_operacao').doc('operacao_oficial').set(marco);
   await db.collection('configuracoes').doc('sistema').set({operacaoOficialInicioEm:OPERATION_CUTOFF.inicioEm,operacaoOficialDataCorteLocal:OPERATION_CUTOFF.dataLocal,operacaoOficialTimezone:OPERATION_CUTOFF.timezone,operacaoOficialCriterio:'origem_operacao',operacaoOficialExecutadoEm:executed,operacaoOficialBackupId:backup.backupId,pilotoControlado:true,atualizadoEm:executed},{merge:true});
   await db.collection('historico_auditoria').add({acao:'operacao_oficial_iniciada',tituloHumano:'Marco inicial da operação registrado',descricaoHumana:`Corte por origem aplicado em ${OPERATION_CUTOFF.rotulo}. Foram arquivados ${backup.totalArquivados} registros de teste e preservados ${scanDepois.resumo.preservar} registros reais, incluindo ${scanDepois.resumo.retroativos} retroativo(s). Base: ${base.alunos} alunos ativos e ${base.responsaveis} responsáveis financeiros.`,usuarioId:staff.id,usuarioNome:staff.nome,usuarioPerfil:staff.perfil,criadoEm:executed,versao:VERSION,dados:{corte:OPERATION_CUTOFF,criterio:'origem_operacao',backupId:backup.backupId,arquivados:backup.totalArquivados,preservados:scanDepois.resumo.preservar,retroativos:scanDepois.resumo.retroativos,contas:accounts,availability,uniforms}});
   return json(res,200,{ok:true,marco,backup,contas:accounts,reconciliacao:{salgados:availability,fardamento:uniforms},resumo:scanDepois.resumo});
  }
  return json(res,400,{error:'Ação inválida.'});
 }catch(e){console.error('implantacao',e);return json(res,e.status||500,{error:e.message||'Não foi possível concluir a operação.'})}
};

// Exportes privados apenas para testes locais do pacote; não alteram a API Vercel.
module.exports.__test={valueDateState,compareDateState,directOriginClass,isManualRetroactive,identityTokens,referenceTokens,movementImpact,uniformStockId,uniformCommitment,occurrenceConsumesCapacity,scanOperationalCutoff,balancePlan,reconcileDailyAvailability,reconcileUniformReservations};
