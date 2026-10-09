const https = require('https');

function doReq(host, path, headers) {
  return new Promise((ok, fail) => {
    const options = {
      hostname: host,
      path: path,
      method: 'GET',
      headers: headers || {}
    };
    const req = https.request(options, (res) => {
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
    if (!cnjs.includes(match[0])) {
      cnjs.push(match[0]);
    }
  }
  return cnjs;
}

// API do TJSP - endpoint real
async function buscarTJSP(uf, numero) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; BotAPI/1.0)',
      'Accept': 'text/html'
    };
    
    // Endpoint real do TJSP para consulta por OAB
    const url = `/cposg/open.do`;
    const params = `conversationId=&paginaConsulta=1&tipoNuProcesso=UNIFICADO&codigoOab=${numero}&tipoConsulta=porOab&dadosConsulta.valorCampoOab=${numero}`;
    
    console.log('Buscando TJSP...');
    const res = await doReq('esaj.tjsp.jus.br', url + '?' + params, headers);
    console.log('Status TJSP:', res.status, 'Tamanho:', res.data.length);
    
    if (res.status === 200) {
      console.log('Primeiros 300 chars:', res.data.substring(0, 300));
      const cnjs = extrairCNJs(res.data);
      console.log('CNJs encontrados TJSP:', cnjs.length);
      return cnjs.map(cnj => ({
        numero_cnj: cnj,
        fontes: [{ nome: 'TJSP', capa: { classe: '', assunto: '' } }]
      }));
    }
    return [];
  } catch (e) {
    console.log('Erro TJSP:', e.message);
    return [];
  }
}

// API do TJMS - endpoint real
async function buscarTJMS(uf, numero) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; BotAPI/1.0)',
      'Accept': 'text/html'
    };
    
    // Endpoint do TJMS
    const url = `/consultapublica/ConsultaPorOab.do`;
    const params = `oab=${numero}&uf=${uf}`;
    
    console.log('Buscando TJMS...');
    const res = await doReq('www.tjms.jus.br', url + '?' + params, headers);
    console.log('Status TJMS:', res.status, 'Tamanho:', res.data.length);
    
    if (res.status === 200) {
      const cnjs = extrairCNJs(res.data);
      console.log('CNJs encontrados TJMS:', cnjs.length);
      return cnjs.map(cnj => ({
        numero_cnj: cnj,
        fontes: [{ nome: 'TJMS', capa: { classe: '', assunto: '' } }]
      }));
    }
    return [];
  } catch (e) {
    console.log('Erro TJMS:', e.message);
    return [];
  }
}

exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  let processos = [];

  try {
    console.log('Requisição recebida:', tipo, valor);

    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log('OAB:', uf, numero);

      // Busca no TJSP
      const tjspResult = await buscarTJSP(uf, numero);
      processos = processos.concat(tjspResult);

      // Busca no TJMS (para MS)
      if (uf === 'MS') {
        const tjmsResult = await buscarTJMS(uf, numero);
        processos = processos.concat(tjmsResult);
      }

      // Remove duplicatas
      processos = processos.filter((p, i, a) => a.findIndex(x => x.numero_cnj === p.numero_cnj) === i);
      console.log('Total processos:', processos.length);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: processos.length, itens: processos, origem: 'APIs Públicas de Tribunais' })
    };
  } catch (erro) {
    console.log('Erro geral:', erro.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 0, itens: [], erro: erro.message })
    };
  }
};
