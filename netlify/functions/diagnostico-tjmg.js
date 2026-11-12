const fetch = require('node-fetch');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9'
};

exports.handler = async () => {
  const out = {};
  try {
    const url = 'https://pje-consulta-publica.tjmg.jus.br/pje/ConsultaPublica/listView.seam';
    const res = await fetch(url, {headers, timeout:12000});
    const html = await res.text();
    out.pje = {
      status:res.status, finalUrl:res.url, bytes:Buffer.byteLength(html),
      inputs:[...html.matchAll(/<input\\b[^>]*>/gi)].map(m=>m[0]).slice(0,160),
      selects:[...html.matchAll(/<select\\b[^>]*>[\\s\\S]*?<\\/select>/gi)].map(m=>m[0].slice(0,2500)).slice(0,20),
      buttons:[...html.matchAll(/<(?:button|a)\\b[^>]*(?:onclick|type=["']submit["'])?[^>]*>/gi)].map(m=>m[0]).filter(x=>/pesquis|consult|oab|captcha/i.test(x)).slice(0,80),
      markers:['OAB','nomeAdv','captcha','recaptcha','executarPesquisa','javax.faces.ViewState'].map(k=>({key:k,found:html.toLowerCase().includes(k.toLowerCase())}))
    };
  } catch(e) { out.pje={error:e.message}; }

  try {
    const url='https://consulta.tjmg.jus.br/pesquisa';
    const res=await fetch(url,{headers,timeout:12000});
    const html=await res.text();
    const scripts=[...html.matchAll(/<script\\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],url).toString());
    out.unificada={status:res.status,bytes:Buffer.byteLength(html),scripts};
    const chunks=await Promise.all(scripts.filter(u=>u.includes('/chunks/')).map(async u=>{
      try {
        const r=await fetch(u,{headers,timeout:12000}); const s=await r.text();
        const terms=[...s.matchAll(/.{0,180}(?:OAB|oab|representante|processo|api\\/|fetch\\(|axios|graphql).{0,220}/gi)].map(m=>m[0]).slice(0,60);
        return {url:u,status:r.status,bytes:Buffer.byteLength(s),terms};
      } catch(e) {return {url:u,error:e.message};}
    }));
    out.unificada.chunks=chunks;
  } catch(e) { out.unificada={error:e.message}; }

  return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(out)};
};
