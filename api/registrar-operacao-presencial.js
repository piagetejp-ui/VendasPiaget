const { initFirebase, json, parseBody, registerInPersonOperation } = require('./_utils');

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return json(res, 405, { ok:false, error:'Método não permitido.' });
  try{
    const db=initFirebase();
    const result=await registerInPersonOperation(db,parseBody(req));
    return json(res,200,{ok:true,...result});
  }catch(error){
    console.error('registrar-operacao-presencial:',error);
    return json(res,error.status||500,{ok:false,error:error.message||'Erro ao registrar operação presencial.',details:error.details||null});
  }
};
