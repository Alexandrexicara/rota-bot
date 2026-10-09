const banco = require('../utils/banco');
exports.handler = async ev => {
  const {id} = ev.queryStringParameters||{};
  if (!id) return {statusCode:400, body:JSON.stringify({erro:"Informe o ID"})};
  const cons = await banco.buscarConsulta(id);
  if (!cons) return {statusCode:404, body:JSON.stringify({erro:"Não encontrada"})};
  return {
    statusCode:200,
    headers: cons.status==="CONCLUÍDA" ? {"Content-Type":"text/plain","Content-Disposition":`attachment; filename="${cons.oab}.txt"`} : {"Content-Type":"application/json"},
    body: cons.status==="CONCLUÍDA" ? cons.txt : JSON.stringify({id:cons.id, status:cons.status, total:cons.total, limite:cons.limite, erros:cons.erros})
  };
};
