const https = require('https');
const { limparOAB } = require('../utils/validar');

function doReq(host, path) {
  return new Promise((ok, fail) => {
    const req = https.request({ hostname: host, path: path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => ok({ status: res.statusCode, data }));
    });
    req.on('error', fail);
    req.setTimeout(10000, () => { req.destroy(); fail(new Error('Timeout')); });
    req.end();
  });
}

function extrairCNJs(html) {
  const cnjs = [];
  const regex = /\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!cnjs.includes(match[0])) cnjs.push(match[0]);
  }
  return cnjs;
}

module.exports = async (oab) => {
  try {
    const oabLimpo = limparOAB(oab);
    const { uf, numero } = require('../utils/validar').separarOAB(oab);
    
    const url = `/cposg/open.do?conversationId=&paginaConsulta=1&tipoNuProcesso=UNIFICADO&codigoOab=${numero}&tipoConsulta=porOab&dadosConsulta.valorCampoOab=${numero}`;
    
    console.log('Buscando TJSP...');
    const res = await doReq('esaj.tjsp.jus.br', url);
    console.log('Status TJSP:', res.status);
    
    if (res.status === 200) {
      const cnjs = extrairCNJs(res.data);
      console.log('CNJs encontrados TJSP:', cnjs.length);
      return cnjs.map(cnj => ({ numero_cnj: cnj, fontes: [{ nome: 'TJSP', capa: { classe: '', assunto: '' } }] }));
    }
    return [];
  } catch (e) {
    console.log('TJSP indisponível:', e.message);
    return [];
  }
};
