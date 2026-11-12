const fetch = require('node-fetch');
const headersBase = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language':'pt-BR,pt;q=0.9'
};
function decodeHtml(s){return String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');}
async function testar(host, label){
  const url=host+'/pje/ConsultaPublica/listView.seam';
  const get=await fetch(url,{headers:headersBase,timeout:15000});
  const html=await get.text();
  const cookies=(get.headers.raw()['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
  const form=(html.match(/<form[^>]*name=["']fPP["'][\s\S]*?<\/form>/i)||[])[0]||'';
  const params=new URLSearchParams();
  for(const m of form.matchAll(/<input\b([^>]*)>/gi)){
    const tag=m[1], name=(tag.match(/\bname=["']([^"']+)["']/i)||[])[1], type=(tag.match(/\btype=["']([^"']+)["']/i)||[])[1]||'text', value=(tag.match(/\bvalue=["']([^"']*)["']/i)||[])[1]||'';
    if(name && (type==='hidden' || name==='fPP')) params.set(name,value);
  }
  params.set('fPP:Decoration:numeroOAB','171934');
  params.set('fPP:Decoration:j_id240','A');
  params.set('fPP:Decoration:estadoComboOAB','12');
  params.set('fPP:searchProcessos','fPP:searchProcessos');
  params.set('AJAXREQUEST','_viewRoot');
  params.set('AJAX:EVENTS_COUNT','1');
  const actionMatch=(form.match(/<form[^>]*action=["']([^"']+)["']/i)||[])[1]||url;
  const action=new URL(actionMatch,get.url).toString();
  const post=await fetch(action,{
    method:'POST',headers:{
      ...headersBase,'Cookie':cookies,'Referer':get.url,'Origin':new URL(get.url).origin,
      'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest',
      'Accept':'application/xml, text/xml, */*; q=0.01'
    },body:params.toString(),timeout:25000
  });
  const result=await post.text();
  const cnjs=[...new Set(result.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g)||[])];
  const raw=[...result.matchAll(/<update[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/update>/gi)].map(m=>({id:m[1],html:decodeHtml(m[2]).slice(0,1000)}));
  return {label,getStatus:get.status,postStatus:post.status,finalUrl:post.url,bytes:Buffer.byteLength(result),cookies:!!cookies,action,params:Object.fromEntries(params),cnjs,markers:['Não foram encontrados','Nenhum registro','OAB','captcha','recaptcha','login','processo'].map(k=>({key:k,found:result.toLowerCase().includes(k.toLowerCase())})),updates:raw.slice(0,30),bodyStart:result.slice(0,6000)};
}
exports.handler=async()=>{
  const out=[];
  for(const [host,label] of [
    ['https://pje-consulta-publica.tjmg.jus.br','TJMG PJe 1G'],
    ['https://pjerecursal.tjmg.jus.br','TJMG PJe Recursal']
  ]){try{out.push(await testar(host,label));}catch(e){out.push({label,error:e.message,stack:e.stack});}}
  return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(out)};
};
