const fetch = require('node-fetch');
const headersBase = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language':'pt-BR,pt;q=0.9'
};
async function testar(host,label){
  const url=host+'/pje/ConsultaPublica/listView.seam';
  const get=await fetch(url,{headers:headersBase,timeout:12000});
  const html=await get.text();
  const cookies=(get.headers.raw()['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
  const form=(html.match(/<form[^>]*name=["']fPP["'][\s\S]*?<\/form>/i)||[])[0]||'';
  const base=new URLSearchParams();
  for(const m of form.matchAll(/<input\b([^>]*)>/gi)){
    const tag=m[1],name=(tag.match(/\bname=["']([^"']+)["']/i)||[])[1],type=(tag.match(/\btype=["']([^"']+)["']/i)||[])[1]||'text',value=(tag.match(/\bvalue=["']([^"']*)["']/i)||[])[1]||'';
    if(name&&(type==='hidden'||name==='fPP'))base.set(name,value);
  }
  base.set('fPP:Decoration:numeroOAB','171934');
  base.set('fPP:Decoration:j_id240','A');
  base.set('fPP:Decoration:estadoComboOAB','12');
  base.set('fPP:searchProcessos','fPP:searchProcessos');
  const actionMatch=(form.match(/<form[^>]*action=["']([^"']+)["']/i)||[])[1]||url;
  const action=new URL(actionMatch,get.url).toString();
  const variants=[
    {name:'ajax-viewroot',params:{AJAXREQUEST:'_viewRoot','AJAX:EVENTS_COUNT':'1'},ajax:true},
    {name:'ajax-form',params:{AJAXREQUEST:'fPP','AJAX:EVENTS_COUNT':'1','javax.faces.partial.ajax':'true','javax.faces.source':'fPP:searchProcessos','javax.faces.partial.execute':'@all','javax.faces.partial.render':'fPP'},ajax:true},
    {name:'full-post',params:{},ajax:false}
  ];
  const results=[];
  for(const v of variants){
    const p=new URLSearchParams(base);
    for(const [k,val] of Object.entries(v.params))p.set(k,val);
    try{
      const post=await fetch(action,{method:'POST',headers:{
        ...headersBase,'Cookie':cookies,'Referer':get.url,'Origin':new URL(get.url).origin,
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        ...(v.ajax?{'Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest','Accept':'application/xml, text/xml, */*; q=0.01'}:{'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'})
      },body:p.toString(),timeout:15000});
      const body=await post.text();
      results.push({variant:v.name,status:post.status,contentType:post.headers.get('content-type'),bytes:Buffer.byteLength(body),finalUrl:post.url,base64:Buffer.from(body).toString('base64').slice(0,8000)});
    }catch(e){results.push({variant:v.name,error:e.message});}
  }
  return {label,getStatus:get.status,getBytes:Buffer.byteLength(html),cookieNames:cookies.split(';').map(x=>x.split('=')[0]),action,fieldNames:[...base.keys()],results};
}
exports.handler=async()=>{
  const out=[];
  for(const [host,label] of [['https://pje-consulta-publica.tjmg.jus.br','TJMG PJe 1G'],['https://pjerecursal.tjmg.jus.br','TJMG PJe Recursal']]){
    try{out.push(await testar(host,label));}catch(e){out.push({label,error:e.message,stack:e.stack});}
  }
  return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(out)};
};
