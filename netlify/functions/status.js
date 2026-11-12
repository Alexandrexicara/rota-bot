exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    status: 'online',
    versao: '2.1.0',
    consultaNacional: false,
    tribunais: {
      confirmadosEmTeste: ['TJSP'],
      configuradosAValidar: ['TJAC', 'TJAL', 'TJAM', 'TJBA', 'TJCE', 'TJMS', 'TJRN'],
      incompletos: ['TJMG'],
      naoImplementados: ['TJAP', 'TJDFT', 'TJES', 'TJGO', 'TJMA', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ', 'TJRS', 'TJRO', 'TJRR', 'TJSC', 'TJSE', 'TJTO']
    },
    observacao: 'Somente o TJSP possui teste real confirmado. Os demais estados não são anunciados como funcionais até validação.'
  })
});