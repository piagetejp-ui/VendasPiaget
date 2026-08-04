const {initFirebase,json,parseBody,nowIso,accountNet,splitNet,audit,notify,getConfig}=require('./_utils');
const cents=v=>Math.round(Number(v||0));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
function activeStatus(s){return !['entregue','aluno_ausente','ausente','nao_entregue','cancelado','cancelado_responsavel','remarcado','encerrado'].includes(String(s||''));}
function lineValue(item={}){const direct=cents(item.totalCentavos||item.valorCentavos);if(direct>0)return direct;return cents(item.precoUnitarioCentavos||item.precoCentavos)*Math.max(1,cents(item.quantidade||1));}
function occurrenceValue(o={},order={}){const direct=cents(o.valorCentavos||o.totalCentavos);if(direct>0)return direct;const itemTotal=(o.itens||[]).reduce((sum,item)=>sum+lineValue(item),0);if(itemTotal>0)return itemTotal;const day=(order.dias||[]).find(d=>d.dataChave===o.dataChave);return cents(day?.totalCentavos)||(day?.itens||[]).reduce((sum,item)=>sum+lineValue(item),0);}
function occurrenceSalgados(o={},order={}){const direct=cents(o.quantidadeSalgados);if(direct>0)return direct;const componentQty=(o.componentes||[]).filter(x=>String(x.produtoId||'')==='salgado').reduce((sum,x)=>sum+cents(x.quantidade),0);if(componentQty>0)return componentQty;const day=(order.dias||[]).find(d=>d.dataChave===o.dataChave);return cents(day?.quantidadeSalgados)||(day?.componentes||[]).filter(x=>String(x.produtoId||'')==='salgado').reduce((sum,x)=>sum+cents(x.quantidade),0);}
function reservationTotal(data={}){const now=Date.now();return Object.values(data.reservas||{}).reduce((sum,r)=>{const expiry=new Date(r?.expiraEm||0).getTime();return expiry>now?sum+cents(r.quantidade):sum},0)}
function used(data={}){return cents(data.vendidoDinheiro)+cents(data.vendidoAvulso)+cents(data.consumoConta)+cents(data.pedidosConfirmados)+reservationTotal(data)}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase(),body=parseBody(req),action=String(body.acao||''),alunoId=String(body.alunoId||''),occurrenceId=String(body.ocorrenciaId||''),actor={id:body.criadoPorId||'portal_responsavel',nome:body.criadoPorNome||'Responsável',perfil:body.criadoPorPerfil||'responsavel'};
    if(!alunoId)throw Object.assign(new Error('Aluno não identificado.'),{status:400});
    if(action==='remarcar'){
      const newDate=String(body.novaData||'');if(!occurrenceId||!validDate(newDate)||newDate<=today())throw Object.assign(new Error('Escolha uma nova data futura.'),{status:400});
      const d=new Date(`${newDate}T12:00:00`);if([0,6].includes(d.getDay()))throw Object.assign(new Error('Escolha um dia útil.'),{status:400});
      const cfg=await getConfig(db);if((cfg.diasSemAula||[]).includes(newDate))throw Object.assign(new Error('A nova data está marcada como dia sem aula.'),{status:409});
      const oldRef=db.collection('ocorrencias_entrega').doc(occurrenceId),preOld=await oldRef.get();if(!preOld.exists)throw Object.assign(new Error('Entrega não encontrada.'),{status:404});
      const preData={id:preOld.id,...preOld.data()};if(preData.alunoId!==alunoId)throw Object.assign(new Error('Esta entrega não pertence ao aluno.'),{status:403});
      const relatedQuery=await db.collection('ocorrencias_entrega').where('pedidoId','==',preData.pedidoId).get().catch(()=>({docs:[]}));
      const relatedRefs=relatedQuery.docs.map(s=>db.collection('ocorrencias_entrega').doc(s.id));
      const targetRef=db.collection('ocorrencias_entrega').doc();let result={};
      await db.runTransaction(async tx=>{
        const orderRef=db.collection('pedidos').doc(preData.pedidoId),oldStockRef=db.collection('disponibilidade_salgados').doc(preData.dataChave),newStockRef=db.collection('disponibilidade_salgados').doc(newDate);
        const [oldSnap,orderSnap,oldStockSnap,newStockSnap,...relatedSnaps]=await Promise.all([tx.get(oldRef),tx.get(orderRef),tx.get(oldStockRef),tx.get(newStockRef),...relatedRefs.map(ref=>tx.get(ref))]);
        if(!oldSnap.exists)throw new Error('Entrega não encontrada.');const o={id:oldSnap.id,...oldSnap.data()};
        if(o.alunoId!==alunoId)throw Object.assign(new Error('Esta entrega não pertence ao aluno.'),{status:403});if(!activeStatus(o.status)||o.dataChave<=today())throw new Error('Somente entregas futuras e pendentes podem ser alteradas.');if(o.dataChave===newDate)throw Object.assign(new Error('Escolha uma data diferente da atual.'),{status:400});
        const activeRelated=relatedSnaps.filter(s=>s.exists).map(s=>({id:s.id,...s.data()})).filter(x=>x.id!==o.id&&activeStatus(x.status));
        if(activeRelated.some(x=>x.dataChave===newDate))throw Object.assign(new Error('Já existe uma entrega ativa desta programação na nova data.'),{status:409});
        const order=orderSnap.exists?orderSnap.data():{},days=Array.isArray(order.dias)?order.dias:[],qty=occurrenceSalgados(o,order),oldStock=oldStockSnap.exists?oldStockSnap.data():{},newStock=newStockSnap.exists?newStockSnap.data():{},planned=cents(newStock.quantidadePlanejada||cfg.quantidadePadraoSalgados||30),available=Math.max(0,planned-used(newStock));
        if(qty>available)throw Object.assign(new Error(`Não há salgados suficientes na nova data. Disponíveis: ${available}.`),{status:409});
        const sourceDay=days.find(day=>day.dataChave===o.dataChave)||{dataChave:o.dataChave,itens:o.itens||[],totalCentavos:occurrenceValue(o,order),quantidadeSalgados:qty};
        const activeDates=new Set(activeRelated.map(x=>x.dataChave));
        const newDays=days.filter(day=>day.dataChave!==o.dataChave&&!(day.dataChave===newDate&&!activeDates.has(newDate))).concat([{...sourceDay,dataChave:newDate,status:'pendente_entrega',remarcadoDe:o.dataChave}]).sort((a,b)=>a.dataChave.localeCompare(b.dataChave)),now=nowIso();
        tx.set(oldStockRef,{pedidosConfirmados:Math.max(0,cents(oldStock.pedidosConfirmados)-qty),atualizadoEm:now},{merge:true});
        tx.set(newStockRef,{dataChave:newDate,quantidadePlanejada:planned,pedidosConfirmados:cents(newStock.pedidosConfirmados)+qty,atualizadoEm:now},{merge:true});
        tx.set(oldRef,{status:'remarcado',remarcadoPara:newDate,remarcadoParaOcorrenciaId:targetRef.id,remarcadoEm:now,finalizadoEm:now,alteradoPorId:actor.id,alteradoPorNome:actor.nome,atualizadoEm:now},{merge:true});
        const clean={...o};delete clean.id;tx.set(targetRef,{...clean,status:'pendente_entrega',dataChave:newDate,remarcadoDe:o.dataChave,remarcadoDeOcorrenciaId:o.id,remarcadoEm:now,finalizadoEm:null,canceladoEm:null,creditadoCentavos:null,alteradoPorId:actor.id,alteradoPorNome:actor.nome,atualizadoEm:now},{merge:false});
        tx.set(orderRef,{dias:newDays,atualizadoEm:now},{merge:true});result={pedidoId:o.pedidoId,ocorrenciaAnteriorId:o.id,novaOcorrenciaId:targetRef.id,oldDate:o.dataChave,newDate};
      });
      await audit(db,'programacao_lanche_remarcada',{...result,alunoId,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`${actor.nome} remarcou uma entrega de lanche.`});
      await notify(db,{tipo:'programacao_lanche_remarcada',titulo:'Entrega de lanche alterada',mensagem:`A entrega foi remarcada para ${newDate.split('-').reverse().join('/')}.`,alunoId,pedidoId:result.pedidoId,destinatariosAlunos:[alunoId],destinatariosPerfis:['cantina','secretaria','gestao','admin']});
      return json(res,200,{ok:true,...result});
    }
    if(action==='cancelar'){
      if(!occurrenceId)throw Object.assign(new Error('Entrega não identificada.'),{status:400});const ref=db.collection('ocorrencias_entrega').doc(occurrenceId);let result={};
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)throw new Error('Entrega não encontrada.');const o={id:snap.id,...snap.data()};if(o.alunoId!==alunoId)throw Object.assign(new Error('Esta entrega não pertence ao aluno.'),{status:403});if(!activeStatus(o.status)||o.dataChave<=today())throw new Error('Somente entregas futuras e pendentes podem ser canceladas.');
        const accRef=db.collection('contas_alunos').doc(alunoId),stockRef=db.collection('disponibilidade_salgados').doc(o.dataChave),orderRef=db.collection('pedidos').doc(o.pedidoId);const [accSnap,stockSnap,orderSnap]=await Promise.all([tx.get(accRef),tx.get(stockRef),tx.get(orderRef)]);const acc=accSnap.exists?accSnap.data():{},stock=stockSnap.exists?stockSnap.data():{},order=orderSnap.exists?orderSnap.data():{},before=accountNet(acc),value=occurrenceValue(o,order),after=before+value,qty=occurrenceSalgados(o,order),now=nowIso(),move=db.collection('movimentos_conta').doc();if(value<=0)throw Object.assign(new Error('Não foi possível identificar o valor desta entrega para realizar a devolução.'),{status:409});
        tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:after<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:false,atualizadoEm:now},{merge:true});tx.set(move,{id:move.id,alunoId,tipo:'credito',subtipo:'credito_cancelamento_programacao',valorCentavos:value,saldoAntesCentavos:before,saldoDepoisCentavos:after,pedidoId:o.pedidoId,ocorrenciaId:o.id,origem:'cancelamento_responsavel',usuarioId:actor.id,usuarioNome:actor.nome,dataChave:o.dataChave,criadoEm:now});tx.set(stockRef,{pedidosConfirmados:Math.max(0,cents(stock.pedidosConfirmados)-qty),atualizadoEm:now},{merge:true});tx.set(ref,{status:'cancelado_responsavel',creditadoCentavos:value,canceladoEm:now,finalizadoEm:now,alteradoPorId:actor.id,alteradoPorNome:actor.nome,atualizadoEm:now},{merge:true});const updatedDays=(Array.isArray(order.dias)?order.dias:[]).map(day=>day.dataChave===o.dataChave?{...day,status:'cancelado_responsavel',creditadoCentavos:value}:day);tx.set(orderRef,{dias:updatedDays,atualizadoEm:now},{merge:true});result={pedidoId:o.pedidoId,dataChave:o.dataChave,creditoCentavos:value,saldoDepoisCentavos:after};
      });
      await audit(db,'programacao_lanche_cancelada',{...result,alunoId,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`${actor.nome} cancelou uma entrega futura e o valor voltou para a conta do aluno.`});
      await notify(db,{tipo:'programacao_lanche_cancelada',titulo:'Entrega de lanche cancelada',mensagem:`A entrega de ${result.dataChave.split('-').reverse().join('/')} foi cancelada e o valor retornou para a conta.`,alunoId,pedidoId:result.pedidoId,destinatariosAlunos:[alunoId],destinatariosPerfis:['cantina','secretaria','gestao','admin']});
      return json(res,200,{ok:true,...result});
    }
    throw Object.assign(new Error('Ação não suportada.'),{status:400});
  }catch(error){console.error('gerenciar-programacao-lanche:',error);return json(res,error.status||500,{ok:false,error:error.message||'Não foi possível alterar a programação.'});}
};
