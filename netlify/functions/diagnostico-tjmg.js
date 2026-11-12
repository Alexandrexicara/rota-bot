const fetch = require('node-fetch');

exports.handler = async () => {
  const url = 'https://eproc-consulta-publica-1g.tjmg.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica';
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      },
      timeout: 12000
    });
    const html = await response.text();
    const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map(m => m[0].slice(0, 25000));
    const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
    const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]);
    return {
      statusCode: 200,
      headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},
      body: JSON.stringify({url, finalUrl:response.url, status:response.status, bytes:Buffer.byteLength(html), title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'', forms, inputs, scripts, htmlStart:html.slice(0,5000)})
    };
  } catch (error) {
    return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({url,error:error.message,stack:error.stack})};
  }
};
