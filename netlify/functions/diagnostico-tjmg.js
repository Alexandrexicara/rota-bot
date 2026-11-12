const fetch=require('node-fetch');
const H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'pt-BR,pt;q=0.9'};
function attr(s,n){const re=new RegExp('\\\\b'+n+'=["\\\\']([^"\\\\']*)["\\\\']','i');return (s.match(re)||[])[1]||'';}
function extract(html){
 const cnjs=[...new Set((html.match(/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/g)||[]).filter(x=>!/^9999999/.test(x)))];
 const rows=[...html.matchAll(/<tr[^>]*class=["'][^"']*rich-table-row[^"']*["'][\\s\\S]*?<\\/tr>/gi)].map(m=>m[0]);
 const rowData=rows.slice(0,40).map(row=>({cnj:(row.match(/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/)||[])[0]||'',detail:(row.match(/DetalheProcessoConsultaPublica\\/listView\\.seam\\?ca=([^'"]+)/)||[])[1]||'',text:row.replace(/<[^>]+>/g,' ').replace(/&[a-zA-Z0-9#]+;/g,' ').replace(/\\s+/g,' ').trim().slice(0,1000)}));
 const ids=[...new Set([...html.matchAll(/Ajax-Update-Ids["'][^>]*content=["']([^"']+)/gi)].map(m=>m[1]))];
 const resultCount=[...html.matchAll(/([0-9]+) resultados encontrados/gi)].map(m=>m[1]);
 const msg=[...html.matchAll(/<(?:span|div|td|li)[^>]*(?:class|id)=["'][^"']*(?:message|mensagem|erro|resultado)[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:span|div|td|li)>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,20);
 return {bytes:Buffer.byteLength(html),cnjs,resultCount,updateIds:ids,rowData,messages:msg,hasSearch:html.includes('171934')};
}
async function testar(host,label,type){
 const url=host+'/pje/ConsultaPublica/listView.seam';
 const get=await fetch(url,{headers:H,timeout:12000});const html=await get.text();
 const cookies=(get.headers.raw()['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
 const form=(html.match(/<form[^>]*id=["']fPP["'][\\s\\S]*?<\\/form>/i)||[])[0]||'';
 const p=new URLSearchParams();
 for(const m of form.matchAll(/<input\\b[^>]*>/gi)){
  const tag=m[0],name=attr(tag,'name'),kind=(attr(tag,'type')||'text').toLowerCase(),value=attr(tag,'value');
  if(!name||['button','reset','file','image'].includes(kind))continue;
  if(['checkbox','radio'].includes(kind)&&!/\\bchecked(?:=["'][^"']*["'])?/i.test(tag))continue;
  p.set(name,value);
 }
 for(const m of form.matchAll(/<select\\b[^>]*>[\\s\\S]*?<\\/select>/gi)){
  const tag=m[0],name=attr(tag,'name');if(!name)continue;
  const options=[...tag.matchAll(/<option\\b[^>]*>/gi)].map(x=>x[0]);
  const chosen=options.find(x=>/\\bselected(?:=["'][^"']*["'])?/i.test(x))||options[0];
  p.set(name,attr(chosen||'','value'));
 }
 for(const m of form.matchAll(/<textarea\\b([^>]*)>([\\s\\S]*?)<\\/textarea>/gi)){const name=attr(m[1],'name');if(name)p.set(name,m[2]);}
 p.set('fPP:Decoration:numeroOAB','171934');
 p.set('fPP:Decoration:j_id240',type);
 p.set('fPP:Decoration:estadoComboOAB','12');
 p.set('fPP:searchProcessos','fPP:searchProcessos');
 p.set('AJAXREQUEST','_viewRoot');
 p.set('AJAX:EVENTS_COUNT','1');
 const action=new URL((form.match(/<form[^>]*action=["']([^"']+)["']/i)||[])[1]||url,get.url).toString();
 const post=await fetch(action,{method:'POST',headers:{...H,Cookie:cookies,Referer:get.url,Origin:new URL(get.url).origin,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest','Accept':'application/xml, text/xml, */*; q=0.01'},body:p.toString(),timeout:25000});
 const result=await post.text();
 return {label,type,getStatus:get.status,postStatus:post.status,contentType:post.headers.get('content-type'),fieldCount:p.size,fields:Object.fromEntries(p),...extract(result),bodyStart:result.slice(0,1000)};
}
exports.handler=async()=>{
 const out=[];
 for(const [host,label] of [['https://pje-consulta-publica.tjmg.jus.br','PJe 1G'],['https://pjerecursal.tjmg.jus.br','PJe Recursal']]){
  for(const type of ['N','A']){try{out.push(await testar(host,label,type));}catch(e){out.push({label,type,error:e.message});}}
 }
 return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(out)};
};
