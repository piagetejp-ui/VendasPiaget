const { initFirebase, json, parseBody, confirmWithInfinitePay } = require('./_utils');

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, error:'Método não permitido.' });
  try{
    const db=initFirebase();
    const result=await confirmWithInfinitePay(db, parseBody(req));
    return json(res, 200, { ok:true, ...result });
  }catch(error){
    console.error('verificar-pagamento:', error);
    return json(res, 500, { ok:false, error:error.message || 'Erro ao verificar pagamento.' });
  }
};
