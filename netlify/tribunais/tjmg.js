// O TJMG possui múltiplos sistemas (PJe, eproc, Projudi e consulta legada).
// O antigo raspador DJEN/CNJ foi removido: não pode ser usado como substituto
// de uma consulta estadual. Falhar explicitamente evita informar "zero processos"
// quando a integração do tribunal ainda não está pronta.
module.exports = async () => {
  throw new Error('TJMG: integração estadual ainda não concluída. Nenhuma consulta DJEN/CNJ foi executada.');
};
