const fetch = require('node-fetch');

exports.handler = async () => {
  const targets = [
    'https://pje-consulta-publica.tjmg.jus.br/pje/ConsultaPublica/listView.seam',
    'https://www4.tjmg.jus.br/juridico/sf/index_oab.jsp',
    'https://consulta.tjmg.jus.br/pesquisa'
  ];
  const results = [];
  for (const url of targets) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        },
        timeout: 25000
      });
      const html = await response.text();
      const forms = [...html.matchAll(/<form\\b[\\s\\S]*?<\\/form>/gi)].map(m => m[0].slice(0, 18000));
      const scripts = [...html.matchAll(/<script\\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
      const inlineScripts = [...html.matchAll(/<script\\b(?![^>]*src=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1].slice(0, 5000));
      const inputs = [...html.matchAll(/<input\\b[^>]*>/gi)].map(m => m[0]);
      results.push({
        url, finalUrl: response.url, status: response.status, bytes: Buffer.byteLength(html),
        title: (html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i) || [])[1] || '',
        forms, inputs: inputs.slice(0, 100), scripts: scripts.slice(0, 80),
        inlineScripts: inlineScripts.slice(0, 30),
        markers: ['OAB','advogado','pesquisa','javax.faces.ViewState','csrf','captcha'].map(k => ({key:k, found:html.toLowerCase().includes(k.toLowerCase())}))
      });
    } catch (error) {
      results.push({url, error: error.message});
    }
  }
  return { statusCode: 200, headers: {'Content-Type':'application/json; charset=utf-8'}, body: JSON.stringify(results) };
};
