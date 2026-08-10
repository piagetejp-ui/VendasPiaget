const {initFirebase,json,parseBody,manualReconcileInfinitePay}=require('../server/_utils');
const {verifyStaff}=require('../server/_family-utils');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase();
    const actor=await verifyStaff(db,req,['admin','gestao','secretaria']);
    const result=await manualReconcileInfinitePay(db,parseBody(req),actor);
    return json(res,200,{ok:true,...result});
  }catch(error){
    console.error('reconciliar-pagamento-infinitepay:',error);
    return json(res,error.status||500,{ok:false,error:error.message||'Não foi possível conciliar o pagamento.',code:error.code||null,details:error.details||null});
  }
};
