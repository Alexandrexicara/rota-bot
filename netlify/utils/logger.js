module.exports = (tipo, mensagem, dados = {}) => {
  console.log(`[${new Date().toISOString()}] ${tipo}: ${mensagem}`, dados);
};
