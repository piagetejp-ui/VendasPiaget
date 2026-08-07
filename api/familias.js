const acesso=require('../server/handler-acesso-meu-piaget');
const gestao=require('../server/handler-gestao-familias');
const implantacao=require('../server/handler-implantacao');
const security=require('../server/handler-security');

module.exports=async function handler(req,res){
  const modulo=String(req.query?.modulo||req.headers['x-piaget-family-module']||'').toLowerCase();
  if(modulo==='acesso') return acesso(req,res);
  if(modulo==='gestao') return gestao(req,res);
  if(modulo==='implantacao') return implantacao(req,res);
  if(modulo==='security') return security(req,res);
  res.statusCode=404;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.end(JSON.stringify({error:'Rota não encontrada.'}));
};
