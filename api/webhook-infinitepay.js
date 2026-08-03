const { initFirebase, json, parseBody, confirmWithInfinitePay, recordInfinitePayEvent } = require('./_utils');

module.exports = async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{success:false,message:'Método não permitido.'});
  const body=parseBody(req);
  const orderNsu=String(body.order_nsu||body.orderNsu||'').trim();
  if(!orderNsu)return json(res,400,{success:false,message:'order_nsu ausente.'});
  try{
    const db=initFirebase();
    // Guarda a evidência bruta antes de consultar e aplicar o pagamento.
    await recordInfinitePayEvent(db,orderNsu,body,'webhook_infinitepay');
    const result=await confirmWithInfinitePay(db,{...body,source:'webhook'});
    if(!result.paid)return json(res,400,{success:false,message:'Pagamento ainda não confirmado pela InfinitePay.'});
    if(result.applicationPending)return json(res,400,{success:false,message:result.applicationError||'Pagamento confirmado, mas processamento operacional pendente.'});
    return json(res,200,{success:true,message:null});
  }catch(error){
    console.error('webhook-infinitepay:',error);
    // A InfinitePay reenvia o webhook quando recebe 400.
    return json(res,400,{success:false,message:error.message||'Erro ao processar webhook.'});
  }
};
