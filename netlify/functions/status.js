exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'online',
      versao: '2.0.0',
      fontesDisponiveis: ['TJSP', 'TJMS', 'TJMG', 'DataJud']
    })
  };
};
