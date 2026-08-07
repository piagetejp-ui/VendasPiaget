const obter=require('../server/handler-obter-venda-online');
const iniciar=require('../server/handler-iniciar-venda-online');
const gerenciar=require('../server/handler-gerenciar-venda-online');

module.exports=async function handler(req,res){
  const modulo=String(req.query?.modulo||'').toLowerCase();
  if(modulo==='obter') return obter(req,res);
  if(modulo==='iniciar') return iniciar(req,res);
  if(modulo==='gerenciar') return gerenciar(req,res);
  res.statusCode=404;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.end(JSON.stringify({error:'Rota não encontrada.'}));
};
