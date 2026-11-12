const fetch = require('node-fetch');
const H={
 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
 'Accept-Language':'pt-BR,pt;q=0.9'
};
function extract(html){
 const cnjs=[...new Set(html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g)||[])];
 const links=[...new Set([...html.matchAll(/href=["']([^"']*(?:processo|Processo)[^"']*)["']/gi)].map(m=>m[1]))].slice(0,80);
 const messages=[...html.matchAll(/<(?:span|div|td|li)[^>]*(?:class|id)=["'][^"']*(?:message|mensagem|erro|resultado|processo)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|td|li)>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,40);
 const inputs=[...html.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]).filter(x=>/OAB|numeroOAB|estadoComboOAB|j_id240/i.test(x));
 const around=[];
 for(const term of ['171934','numeroOAB','resultado','Não foram encontrados','processo.seam']){
  const i=html.toLowerCase().indexOf(term.toLowerCase());
  if(i>=0)around.push({term,snippet:html.slice(Math.max(0,i-350),i+900).replace(/\s+/g,' ')});
 }
 return {bytes:Buffer.byteLength(html),cnjs,links,messages,inputs,around,hasOab:html.includes('171934'),title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''};
}
async function pje(host,label,type){
 const url=host+'/pje/ConsultaPublica/listView.seam';
 const get=await fetch(url,{headers:H,timeout:12000});const html=await get.text();
 const cookies=(get.headers.raw()['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
 const form=(html.match(/<form[^>]*name=["']fPP["'][\s\S]*?<\/form>/i)||[])[0]||'';
 const params=new URLSearchParams();
 for(const m of form.matchAll(/<input\b([^>]*)>/gi)){
  const t=m[1],name=(t.match(/\bname=["']([^"']+)["']/i)||[])[1],kind=(t.match(/\btype=["']([^"']+)["']/i)||[])[1]||'text',value=(t.match(/\bvalue=["']([^"']*)["']/i)||[])[1]||'';
  if(name&&(kind==='hidden'||name==='fPP'))params.set(name,value);
 }
 params.set('fPP:Decoration:numeroOAB','171934');
 params.set('fPP:Decoration:j_id240',type);
 params.set('fPP:Decoration:estadoComboOAB','12');
 params.set('fPP:searchProcessos','fPP:searchProcessos');
 const action=new URL((form.match(/<form[^>]*action=["']([^"']+)["']/i)||[])[1]||url,get.url).toString();
 const post=await fetch(action,{method:'POST',headers:{...H,Cookie:cookies,Referer:get.url,Origin:new URL(get.url).origin,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:params.toString(),timeout:20000});
 const result=await post.text();
 return {label,type,getStatus:get.status,postStatus:post.status,contentType:post.headers.get('content-type'),action,fields:Object.fromEntries(params),...extract(result)};
}
async function legacy(){
 const url='https://www4.tjmg.jus.br/juridico/sf/proc_oab.jsp?comrCodigo=441&cbo_nome_comarca=441&numero=1';
 const get=await fetch(url,{headers:H,timeout:15000});const html=await get.text();
 const cookies=(get.headers.raw()['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
 const params=new URLSearchParams({codigoOAB:'171934',tipoOAB:'N',ufOAB:'MG',tipoConsulta:'1',natureza:'0',ativoBaixado:'X',comrCodigo:'441',numero:'1'});
 const resultUrl='https://www4.tjmg.jus.br/juridico/sf/proc_resultado_oab.jsp?'+params.toString();
 const res=await fetch(resultUrl,{headers:{...H,Cookie:cookies,Referer:get.url},timeout:20000});
 const body=await res.text();
 return {label:'TJMG legado comarca 441',formStatus:get.status,resultStatus:res.status,resultUrl,cookies:!!cookies,...extract(body),bodyStart:body.slice(0,5000)};
}
exports.handler=async()=>{
 const results=[];
 for(const [host,label] of [['https://pje-consulta-publica.tjmg.jus.br','PJe 1G'],['https://pjerecursal.tjmg.jus.br','PJe Recursal']]){
  for(const type of ['N','A']){try{results.push(await pje(host,label,type));}catch(e){results.push({label,type,error:e.message});}}
 }
 try{results.push(await legacy());}catch(e){results.push({label:'TJMG legado comarca 441',error:e.message});}
 return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(results)};
};
