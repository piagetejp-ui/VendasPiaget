const crypto = require('crypto');
const { initFirebase, json, parseBody, buildCheckoutOperation, createCheckoutLink, nowIso } = require('./_utils');
function cleanAttemptId(v){const s=String(v||'').trim();return /^[A-Za-z0-9-]{8,100}$/.test(s)?s:''}
function bodyFingerprint(body){const copy={...body};delete copy.idTentativa;return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex')}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  const totalStart=Date.now();let attemptRef=null,fingerprint='';
  try{
    const db=initFirebase(),body=parseBody(req),idTentativa=cleanAttemptId(body.idTentativa),timings={};
    if(idTentativa){
      fingerprint=bodyFingerprint(body);attemptRef=db.collection('tentativas_checkout').doc(idTentativa);let existing=null;
      await db.runTransaction(async tx=>{const snap=await tx.get(attemptRef);if(snap.exists)existing=snap.data();else tx.set(attemptRef,{id:idTentativa,fingerprint,status:'preparando',criadoEm:nowIso(),atualizadoEm:nowIso(),alunoId:body.alunoId||null,tipo:body.tipo||null})});
      if(existing){
        if(existing.fingerprint&&existing.fingerprint!==fingerprint)return json(res,409,{ok:false,error:'Esta tentativa já está vinculada a outra operação.'});
        if(existing.checkoutUrl)return json(res,200,{ok:true,reutilizado:true,checkout_url:existing.checkoutUrl,order_nsu:existing.orderNsu,pedido_id:existing.pedidoId,tipo:existing.tipo,timings:existing.timings||{}});
        if(existing.semCheckout)return json(res,200,{ok:true,reutilizado:true,sem_checkout:true,pedido_confirmado:true,pedido_id:existing.pedidoId,tipo:existing.tipo});
        if(existing.orderNsu){const snap=await db.collection('pagamentos_checkout').doc(existing.orderNsu).get();if(snap.exists&&snap.data().checkoutUrl){const c=snap.data();await attemptRef.set({checkoutUrl:c.checkoutUrl,status:'aguardando_pagamento',atualizadoEm:nowIso()},{merge:true});return json(res,200,{ok:true,reutilizado:true,checkout_url:c.checkoutUrl,order_nsu:existing.orderNsu,pedido_id:c.pedidoId,tipo:c.tipo})}}
        if(existing.status==='preparando')return json(res,200,{ok:true,preparando:true,message:'O link ainda está sendo preparado.'});
        if(existing.status==='falha')return json(res,409,{ok:false,error:existing.error||'A tentativa anterior falhou. Tente novamente.'});
      }
    }
    const buildStart=Date.now(),op=await buildCheckoutOperation(db,body);timings.preparacaoOperacaoMs=Date.now()-buildStart;op.idTentativa=idTentativa||null;
    const result=await createCheckoutLink(db,req,op,timings);timings.totalMs=Date.now()-totalStart;
    if(attemptRef)await attemptRef.set({status:result.sem_checkout?'concluida':'aguardando_pagamento',semCheckout:Boolean(result.sem_checkout),checkoutUrl:result.checkout_url||null,orderNsu:result.order_nsu||null,pedidoId:result.pedido_id||null,tipo:result.tipo||body.tipo||null,timings,atualizadoEm:nowIso()},{merge:true});
    return json(res,200,{ok:true,...result,timings});
  }catch(error){console.error('criar-checkout:',error);if(attemptRef)await attemptRef.set({status:'falha',error:error.message||'Erro ao criar checkout.',atualizadoEm:nowIso()},{merge:true}).catch(()=>{});return json(res,error.status||500,{ok:false,error:error.message||'Erro ao criar checkout.',details:error.details||null})}
};
