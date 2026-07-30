const { initFirebase, json, parseBody, applyCheckoutConfirmation } = require('./_utils');

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { success:false, message:'Método não permitido.' });
  try{
    const db=initFirebase();
    const body=parseBody(req);
    const orderNsu=String(body.order_nsu || body.orderNsu || '').trim();
    if(!orderNsu) return json(res, 400, { success:false, message:'order_nsu ausente.' });
    await applyCheckoutConfirmation(db, orderNsu, body);
    return json(res, 200, { success:true, message:null });
  }catch(error){
    console.error('webhook-infinitepay:', error);
    return json(res, 400, { success:false, message:error.message || 'Erro ao processar webhook.' });
  }
};
