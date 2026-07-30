const { initFirebase, json, parseBody, buildCheckoutOperation, createCheckoutLink } = require('./_utils');

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, error:'Método não permitido.' });
  try{
    const db=initFirebase();
    const body=parseBody(req);
    const op=await buildCheckoutOperation(db, body);
    const result=await createCheckoutLink(db, req, op);
    return json(res, 200, { ok:true, ...result });
  }catch(error){
    console.error('criar-checkout:', error);
    return json(res, error.status || 500, { ok:false, error:error.message || 'Erro ao criar checkout.', details:error.details || null });
  }
};
