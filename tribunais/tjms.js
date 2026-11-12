const buscarDatajud = require('./datajud');

module.exports = async function buscarOABnoTJMS(oab) {
  const processos = await buscarDatajud(oab);
  return processos.filter(p => String(p.tribunal || '').toUpperCase().includes('TJMS'));
};
