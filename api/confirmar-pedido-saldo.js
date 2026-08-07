const {initFirebase,json,parseBody,buildCheckoutOperation,confirmCantinaOrderWithoutCheckout,confirmUniformOrderWithoutCheckout,nowIso}=require('../server/_utils');
const {verifyFamilyForStudent,verifyStaff}=require('../server/_family-utils');
function cleanAttemptId(v){const s=String(v||'').trim();return /^[A-Za-z0-9:_-]{8,120}$/.test(s)?s:''}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  let attemptRef=null;
  try{
    const db=initFirebase(),body=parseBody(req),idTentativa=cleanAttemptId(body.idTentativa)||`saldo_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    const perfil=String(body.criadoPorPerfil||body.usuarioPerfil||'responsavel');if(perfil==='responsavel')await verifyFamilyForStudent(db,req,body.alunoId);else await verifyStaff(db,req,['admin','gestao','secretaria','cantina']);
    attemptRef=db.collection('tentativas_confirmacao_saldo').doc(idTentativa);
    const existingSnap=await attemptRef.get();
    let existing=existingSnap.exists?existingSnap.data():null;
    if(existing?.status==='concluida')return json(res,200,{ok:true,sem_checkout:true,pedido_confirmado:true,pedido_id:existing.pedidoId,tipo:existing.tipo,saldo_depois_centavos:existing.saldoDepoisCentavos,reutilizado:true});
    let tipo=existing?.tipo||String(body.tipo||''),pedidoId=existing?.pedidoId||'';
    if(!pedidoId){
      await attemptRef.set({id:idTentativa,status:'preparando',tipo,alunoId:body.alunoId||null,criadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
      const op=await buildCheckoutOperation(db,body);
      if(Number(op.totalCentavos||0)!==0)throw Object.assign(new Error('Este pedido ainda precisa de pagamento externo.'),{status:409});
      tipo=op.tipo;pedidoId=op.pedidoId;
      await attemptRef.set({tipo,pedidoId,status:'processando',atualizadoEm:nowIso()},{merge:true});
    }
    let result;
    const actor={id:body.criadoPorId||'portal_responsavel',nome:body.criadoPorNome||'Responsável',perfil:body.criadoPorPerfil||'responsavel'};
    if(tipo==='pedido_cantina')result=await confirmCantinaOrderWithoutCheckout(db,pedidoId,actor);
    else if(tipo==='pedido_farda')result=await confirmUniformOrderWithoutCheckout(db,pedidoId,actor);
    else throw Object.assign(new Error('Tipo de pedido não suportado para confirmação com saldo.'),{status:400});
    await attemptRef.set({status:'concluida',tipo,pedidoId,saldoDepoisCentavos:result.saldoDepoisCentavos??null,resultado:result,concluidoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
    return json(res,200,{ok:true,sem_checkout:true,pedido_confirmado:result.status!=='revisao',pedido_em_revisao:result.status==='revisao',pedido_id:pedidoId,tipo,saldo_depois_centavos:result.saldoDepoisCentavos??null});
  }catch(error){console.error('confirmar-pedido-saldo:',error);if(attemptRef)await attemptRef.set({status:'falha',erro:error.message||'Erro ao confirmar pedido.',atualizadoEm:nowIso()},{merge:true}).catch(()=>{});return json(res,error.status||500,{ok:false,error:error.message||'Não foi possível confirmar o pedido com o saldo.'});}
};
