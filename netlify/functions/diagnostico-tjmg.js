const fetch=require('node-fetch');
const H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'pt-BR,pt;q=0.9'};
function snippets(s,terms){const out=[];for(const term of terms){let start=0,n=0;while((start=s.toLowerCase().indexOf(term.toLowerCase(),start))>=0&&n<5){out.push({term,at:start,text:s.slice(Math.max(0,start-350),start+1200)});start+=term.length;n++;}}return out;}
async function pje(){
 const url='https://pje-consulta-publica.tjmg.jus.br/pje/ConsultaPublica/listView.seam';
 const res=await fetch(url,{headers:H,timeout:12000});const html=await res.text();
 const scripts=[...html.matchAll(/<script\\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],url).toString());
 const inline=[...html.matchAll(/<script\\b(?![^>]*src=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]);
 const form=(html.match(/<form[^>]*id=["']fPP["'][\\s\\S]*?<\\/form>/i)||[])[0]||'';
 const onclick=(form.match(/<input[^>]*id=["']fPP:searchProcessos["'][^>]*>/i)||[])[0]||'';
 const found=await Promise.all(scripts.map(async u=>{try{const r=await fetch(u,{headers:H,timeout:8000});const s=await r.text();return {url:u,status:r.status,bytes:Buffer.byteLength(s),snippets:snippets(s,['executarPesquisa','executarReCaptcha','searchProcessos','recaptcha','OAB'])};}catch(e){return {url:u,error:e.message};}}));
 return {status:res.status,bytes:Buffer.byteLength(html),scripts,onclick,inline:inline.map(s=>snippets(s,['executarPesquisa','executarReCaptcha','searchProcessos'])).flat(),scriptMatches:found,formStart:form.slice(0,9000)};
}
async function unificada(){
 const url='https://consulta.tjmg.jus.br/pesquisa';
 const res=await fetch(url,{headers:H,timeout:12000});const html=await res.text();
 const scripts=[...html.matchAll(/<script\\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],url).toString());
 const chunks=await Promise.all(scripts.map(async u=>{try{const r=await fetch(u,{headers:H,timeout:8000});const s=await r.text();return {url:u,status:r.status,bytes:Buffer.byteLength(s),snippets:snippets(s,['OAB do Representante','oabRepresentante','numeroOab','numeroOAB','ufOab','api/','fetch(','axios','pesquisa'])};}catch(e){return {url:u,error:e.message};}}));
 return {status:res.status,bytes:Buffer.byteLength(html),scripts,chunks};
}
exports.handler=async()=>{
 const out={};
 try{out.pje=await pje();}catch(e){out.pje={error:e.message,stack:e.stack};}
 try{out.unificada=await unificada();}catch(e){out.unificada={error:e.message,stack:e.stack};}
 return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(out)};
};
