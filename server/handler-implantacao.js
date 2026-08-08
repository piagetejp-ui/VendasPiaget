const {initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff}=require('./_family-utils');
const BASE_META={anoLetivo:2026,geradoDe:'SIGA 07/08/2026',alunos:214,responsaveis:187,vinculos:214};

const CLEAR_COLLECTIONS=[
 'alertas','caixas','contas_alunos','dados_pagamento_responsavel','disponibilidade_salgados','eventos_checkout_infinitepay','fechamentos_caixa','fechamentos_cantina','fechamentos_semanais','fila_integracao','historico_auditoria','itens_venda','movimentos_caixa','movimentos_conta','movimentos_estoque','notificacoes','ocorrencias_entrega','pagamentos','pagamentos_checkout','pagamentos_venda','pedidos','pedidos_farda','pedidos_operacionais','sessoes_caixa','periodos_responsabilidade_caixa','divergencias_caixa','ocorrencias_caixa','solicitacoes_correcao_pedido','taxas_pagamento','tentativas_checkout','tentativas_confirmacao_saldo','transacoes_infinitepay','transferencias_caixa','vendas','vendas_online_links','solicitacoes_reset_responsavel','reset_senha_responsavel','responsaveis_acesso','ativacoes_meu_piaget','sessoes_meu_piaget'
];
const PRESERVED_LABELS=['alunos e matrículas','responsáveis e vínculos','catálogo','preços e estoques atuais','configurações','usuários da equipe'];
function accountSplit(net){net=Math.round(Number(net||0));return{saldoContaCentavos:net,saldoCreditoCentavos:Math.max(0,net),dividaCentavos:Math.max(0,-net)}}
async function commitChunks(db,ops,max=420){for(let i=0;i<ops.length;i+=max){const batch=db.batch();for(const op of ops.slice(i,i+max)){if(op.kind==='set')batch.set(op.ref,op.data,op.options||{merge:true});else if(op.kind==='delete')batch.delete(op.ref)}await batch.commit()}}
async function countCollection(db,name){const s=await db.collection(name).get();return s.size}
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
 return{base:{...BASE_META,...atual},preparada:Boolean(cfg.exists&&cfg.data()?.baseOficial2026Preparada),operacaoOficial:Boolean(marco?.exists),marco:marco?.exists?marco.data():null,cpfPendentes:invalid.docs.map(d=>({id:d.id,nome:d.data()?.nome||'Responsável',cpfFinal:d.data()?.cpfFinal||''}))}
}
async function previewReset(db){const counts={};let total=0;for(const c of CLEAR_COLLECTIONS){const n=await countCollection(db,c).catch(()=>0);counts[c]=n;total+=n}return{totalDocumentos:total,colecoes:counts,preservado:PRESERVED_LABELS,baseOficial:{alunos:BASE_META.alunos,responsaveis:BASE_META.responsaveis}}}
async function backupAndClear(db,staff){const backupId=`implantacao_${Date.now()}`,root=db.collection('backups_implantacao').doc(backupId),created=nowIso();await root.set({id:backupId,tipo:'pre_operacao_oficial',criadoEm:created,criadoPorId:staff.id,criadoPorNome:staff.nome,colecoes:CLEAR_COLLECTIONS,status:'em_andamento'});let total=0;for(const name of CLEAR_COLLECTIONS){const snap=await db.collection(name).get();if(!snap.size)continue;const ops=[];for(const d of snap.docs){const safeId=`${name}__${Buffer.from(d.id).toString('base64url')}`;ops.push({kind:'set',ref:root.collection('documentos').doc(safeId),data:{colecao:name,documentoId:d.id,dados:d.data()},options:{merge:false}});ops.push({kind:'delete',ref:d.ref});total++}await commitChunks(db,ops,380)}await root.set({status:'concluido',documentos:total,concluidoEm:nowIso()},{merge:true});return{backupId,total}}
async function zeroFamilyAccounts(db){const cfg=await db.collection('configuracoes').doc('sistema').get(),base=Number(cfg.data()?.limiteMaximoFiadoCentavos||5000),rs=await db.collection('responsaveis_financeiros').get(),ops=[];for(const d of rs.docs){const r=d.data()||{},count=Math.max(1,Number(r.quantidadeAlunosAtivos||1));ops.push({kind:'set',ref:db.collection('contas_responsaveis').doc(d.id),data:{responsavelId:d.id,quantidadeAlunosAtivos:Number(r.quantidadeAlunosAtivos||0),limiteBasePorAlunoCentavos:base,limiteMaximoFamiliaCentavos:base*count,limiteFiadoCentavos:0,autorizadoSemSaldo:false,bloqueioManual:false,bloqueadoPorLimite:false,bloqueioSaldoSemanal:false,...accountSplit(0),atualizadoEm:nowIso()},options:{merge:true}})}await commitChunks(db,ops)}
module.exports=async(req,res)=>{if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});const db=initFirebase(),b=parseBody(req);try{const staff=await verifyStaff(db,req,['admin','gestao']),acao=String(b.acao||'');if(acao==='status')return json(res,200,{ok:true,...await status(db)});if(acao==='preparar_base')return json(res,200,{ok:true,...await prepareBase(db,staff),...await status(db)});if(acao==='preview_reset')return json(res,200,{ok:true,...await previewReset(db)});if(acao==='iniciar_operacao'){
 if(String(b.confirmacao||'').trim()!=='INICIAR OPERAÇÃO REAL')return json(res,400,{error:'Digite exatamente INICIAR OPERAÇÃO REAL para confirmar.'});const current=await status(db);if(!current.preparada)return json(res,409,{error:'Prepare a base oficial de alunos e responsáveis antes do marco zero.'});if(current.cpfPendentes.length)return json(res,409,{error:'Existe responsável com CPF pendente. Corrija antes de iniciar a operação oficial.',cpfPendentes:current.cpfPendentes});if(current.operacaoOficial)return json(res,409,{error:'A operação oficial já foi iniciada e não pode ser zerada novamente por este fluxo.'});const backup=await backupAndClear(db,staff);await zeroFamilyAccounts(db);const now=nowIso(),marco={id:'operacao_oficial',inicioEm:now,anoLetivo:2026,backupId:backup.backupId,criadoPorId:staff.id,criadoPorNome:staff.nome,baseAlunos:BASE_META.alunos,baseResponsaveis:BASE_META.responsaveis};await db.collection('marcos_operacao').doc('operacao_oficial').set(marco);await db.collection('configuracoes').doc('sistema').set({operacaoOficialInicioEm:now,operacaoOficialBackupId:backup.backupId,atualizadoEm:now},{merge:true});await db.collection('historico_auditoria').add({acao:'operacao_oficial_iniciada',tituloHumano:'Operação oficial iniciada',descricaoHumana:`O sistema iniciou a operação oficial com ${BASE_META.alunos} alunos ativos e ${BASE_META.responsaveis} responsáveis financeiros.`,usuarioId:staff.id,usuarioNome:staff.nome,usuarioPerfil:staff.perfil,criadoEm:now,versao:'1.6.0-rc2.7.8'});return json(res,200,{ok:true,marco,backup});}
 return json(res,400,{error:'Ação inválida.'});}catch(e){console.error('implantacao',e);return json(res,e.status||500,{error:e.message||'Não foi possível concluir a operação.'})}};
