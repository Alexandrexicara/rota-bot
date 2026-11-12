const { buscarPublicacoesOAB } = require('./djen');

module.exports = async function buscarOABnoTJMS(oab) {
  const texto = String(oab || '').toUpperCase();
  const match = texto.match(/MS\s*[-/]?\s*(\d{1,10})/);
  if (!match) throw new Error('Informe a OAB de MS no formato MS 12345.');
  const resultado = await buscarPublicacoesOAB('MS', match[1], 90);
  return resultado.processos.filter(p => String(p.tribunal || '').toUpperCase().includes('TJMS'));
};
