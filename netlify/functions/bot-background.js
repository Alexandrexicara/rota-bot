const fetch = require('node-fetch');
const https = require('https');

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function fetchHtmlTJSP(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept-Encoding': 'identity',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtmlTJSP(res.headers.location).then(resolve);
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.setTimeout(12000, () => { req.destroy(); resolve(''); });
    req.on('error', () => resolve(''));
  });
}

function htmlDecode(s) {
  return String(s || '')
    .replace(/&acirc;/g,'â').replace(/&atilde;/g,'ã').replace(/&otilde;/g,'õ')
    .replace(/&eacute;/g,'é').replace(/&ecirc;/g,'ê').replace(/&iacute;/g,'í')
    .replace(/&oacute;/g,'ó').replace(/&ocirc;/g,'ô').replace(/&uacute;/g,'ú')
    .replace(/&ccedil;/g,'ç').replace(/&Aacute;/g,'Á').replace(/&Atilde;/g,'Ã')
    .replace(/&Eacute;/g,'É').replace(/&Iacute;/g,'Í').replace(/&Oacute;/g,'Ó')
    .replace(/&Uacute;/g,'Ú').replace(/&Ccedil;/g,'Ç').replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/&#\d+;/g,'').replace(/\s+/g,' ').trim();
}

// ─── Extrai dados de uma página individual de processo do TJSP ────────────────
function parsePaginaProcesso(html, linkOrigem, tribunal = 'TJSP') {
  if (!html) return null;

  // Número CNJ
  const mNum = html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  const numero = mNum ? mNum[0] : null;

  // Valor da causa
  const mValor = html.match(/id="valorAcaoProcesso"[^>]*>\s*([^<]+)/);
  const valor_display = mValor ? mValor[1].replace(/\s+/g,' ').trim() : null;
  const valor = valor_display ? valor_display.replace('R$','').replace(/\s/g,'').replace(',','.') : null;

  // Classe
  const mClasse = html.match(/id="classeProcesso"[^>]*>[\s\S]{0,300}?<span[^>]*>\s*([^<]+)/);
  const classe = mClasse ? htmlDecode(mClasse[1]) : null;

  // Assunto
  const mAssunto = html.match(/id="assuntoProcesso"[^>]*>[\s\S]{0,300}?<span[^>]*>\s*([^<]+)/);
  const assunto = mAssunto ? htmlDecode(mAssunto[1]) : null;

  // Órgão julgador
  const mOrgao = html.match(/id="orgaoJulgadorProcesso"[^>]*>[\s\S]{0,300}?<span[^>]*>\s*([^<]+)/);
  const orgao = mOrgao ? htmlDecode(mOrgao[1]) : null;

  // Data de ajuizamento
  const mData = html.match(/id="dataHoraDistribuicaoProcesso"[^>]*>[\s\S]{0,300}?<span[^>]*>\s*([^<]+)/);
  const data = mData ? htmlDecode(mData[1]) : null;

  // Partes — extrai da tabela nomeParteEAdvogado
  const nomesRaw = html.match(/class="nomeParteEAdvogado"[^>]*>\s*\n?\s*([^\n<]{3,})/g) || [];
  const partes = [];
  const vistos = new Set();
  for (const m of nomesRaw) {
    const nome = htmlDecode(m.replace(/class="nomeParteEAdvogado"[^>]*>\s*\n?\s*/,'').trim());
    if (nome && nome.length > 2 && !vistos.has(nome)) {
      vistos.add(nome);
      partes.push({ nome, polo: '', advogados: [] });
    }
  }

  // Advogados
  const advsRaw = [...new Set(
    (html.match(/Advogados?\(s?\):\s*([^\n<]+)/gi) || [])
      .map(a => htmlDecode(a.replace(/Advogados?\(s?\):\s*/i,'').trim()))
  )];
  const advogados = advsRaw.map(txt => {
    const mOAB = txt.match(/\(OAB\s*([\w\/]+)\)/i);
    return { nome: txt.replace(/\s*\(OAB[^)]+\)/i,'').trim(), oab: mOAB ? mOAB[1] : '' };
  }).filter(a => a.nome);

  // Adiciona advogados nas partes
  if (advogados.length > 0) {
    for (const p of partes) p.advogados = advogados;
  }

  // Última movimentação
  const movDatas = html.match(/\d{2}\/\d{2}\/\d{4}/g) || [];

  return {
    numero,
    tribunal,
    classe,
    assunto,
    orgao,
    data,
    valor,
    valor_display,
    partes,
    advogados_tjsp: advogados,
    dataUltimaMovimentacao: movDatas[movDatas.length - 1] || null,
    fonte: `${tribunal}_SCRAPER`,
  };
}

// ─── Busca por OAB nos portais e-SAJ ─────────────────────────────────────────
async function buscarOABnoESAJ(estado, numeroOAB, maxProcessos = 30) {
  const portais = {
    SP: { host: 'https://esaj.tjsp.jus.br', tribunal: 'TJSP' },
    MS: { host: 'https://esaj.tjms.jus.br', tribunal: 'TJMS' },
  };
  const portal = portais[estado.toUpperCase()];
  if (!portal) return [];

  const urlLista = `${portal.host}/cpopg/search.do?conversationId=` +
    `&cbPesquisa=NUMOAB&dadosConsulta.valorConsulta=${encodeURIComponent(numeroOAB)}` +
    `&dadosConsulta.valorConsultaNuUnificado=&dadosConsulta.localPesquisa.cdLocal=-1`;

  const htmlLista = await fetchHtmlTJSP(urlLista);
  if (!htmlLista) return [];

  // Extrai links individuais dos processos (processo.codigo + foro)
  const linkRegex = /href="(\/cpopg\/show\.do\?processo\.codigo=[^"]+)"/g;
  const links = [];
  let m;
  while ((m = linkRegex.exec(htmlLista)) !== null) {
    const href = portal.host + m[1];
    // Remove parâmetros de paginação desnecessários
    if (!links.includes(href) && links.length < maxProcessos) {
      links.push(href);
    }
  }

  if (links.length === 0 && estado.toUpperCase() === 'MS') {
    const buscarOABnoTJMS = require('../tribunais/tjms');
    const processosTJMS = await buscarOABnoTJMS(`MS${numeroOAB}`);
    return processosTJMS.map(processo => ({
      numero: processo.numero_cnj,
      tribunal: 'TJMS',
      classe: processo.fontes?.[0]?.capa?.classe || '',
      assunto: processo.fontes?.[0]?.capa?.assunto || '',
    }));
  }
  if (links.length === 0) return [];

  // Busca cada processo individualmente em lotes de 3
  const processos = [];
  for (let i = 0; i < links.length; i += 3) {
    const lote = links.slice(i, i + 3);
    const resultados = await Promise.all(lote.map(async (link) => {
      const html = await fetchHtmlTJSP(link);
      return parsePaginaProcesso(html, link, portal.tribunal);
    }));
    for (const r of resultados) {
      if (r && r.numero) processos.push(r);
    }
    if (i + 3 < links.length) await new Promise(r => setTimeout(r, 600));
  }

  return processos;
}

// ─── Busca TJMG no índice público DataJud ────────────────────────────────────
async function buscarOABnoTJMG(numeroOAB) {
  const buscarDatajud = require('../tribunais/datajud');
  const processos = await buscarDatajud(`MG${numeroOAB}`);
  return processos
    .filter(processo => (processo.tribunal || '').toUpperCase().includes('TJMG'))
    .slice(0, 30)
    .map(processo => ({ ...processo, numero: processo.numero || processo.numeroProcesso }));
}

// ─── Enriquece processos do TJSP vindos do DataJud ───────────────────────────
async function enriquecerTJSP(processo) {
  const tribunal = (processo.tribunal || '').toUpperCase();
  if (!tribunal.includes('TJSP')) return processo;

  const raw = String(processo.numero || processo.numeroProcesso || '').replace(/\D/g,'');
  if (raw.length !== 20) return processo;
  const cnj = `${raw.slice(0,7)}-${raw.slice(7,9)}.${raw.slice(9,13)}.${raw.slice(13,14)}.${raw.slice(14,16)}.${raw.slice(16,20)}`;

  const url = `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC` +
    `&dadosConsulta.valorConsultaNuUnificado=${encodeURIComponent(cnj)}` +
    `&dadosConsulta.localPesquisa.cdLocal=-1&dadosConsulta.tipoNuProcesso=UNIFICADO`;

  const html = await fetchHtmlTJSP(url);
  if (!html) return processo;

  const dados = parsePaginaProcesso(html, url);
  if (!dados) return processo;

  return {
    ...processo,
    ...(dados.valor_display && !processo.valor ? { valor: dados.valor, valor_display: dados.valor_display } : {}),
    ...(dados.partes.length > 0 && (!processo.partes || processo.partes.length === 0) ? { partes: dados.partes } : {}),
    ...(dados.advogados_tjsp.length > 0 ? { advogados_tjsp: dados.advogados_tjsp } : {}),
    ...(dados.classe && !processo.classe ? { classe: dados.classe } : {}),
    ...(dados.orgao  && !processo.orgao  ? { orgao:  dados.orgao  } : {}),
  };
}

async function enriquecerListaTJSP(lista) {
  const resultado = [];
  for (let i = 0; i < lista.length; i += 3) {
    const lote = lista.slice(i, i + 3);
    const enriquecidos = await Promise.all(lote.map(p => enriquecerTJSP(p)));
    resultado.push(...enriquecidos);
    if (i + 3 < lista.length) await new Promise(r => setTimeout(r, 600));
  }
  return resultado;
}

// ─── Tokens dos bots ──────────────────────────────────────────────────────────
const BOTS = [
  process.env.TELEGRAM_BOT_TOKEN,
  process.env.TELEGRAM_BOT_TOKEN_2,
].filter(Boolean);

// ─── Identifica o token correto pelo ?token= na query string ─────────────────
function resolverToken(event) {
  const qs = event.queryStringParameters || {};
  if (qs.token && BOTS.includes(qs.token)) return qs.token;
  return BOTS[0];
}

// ─── Enviar mensagem de texto ─────────────────────────────────────────────────
async function enviarMensagem(token, chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('enviarMensagem:', e.message);
  }
}

// ─── Enviar arquivo HTML (multipart manual, node-fetch v2) ───────────────────
async function enviarArquivo(token, chatId, nomeArquivo, conteudo, legenda) {
  try {
    const boundary   = `----FormBoundary${Date.now()}`;
    const fileBuffer = Buffer.from(conteudo, 'utf8');
    const partes = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${legenda}`,
    ];
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${nomeArquivo}"\r\nContent-Type: text/html; charset=utf-8\r\n\r\n`;
    const body = Buffer.concat([
      Buffer.from(partes.join('\r\n') + '\r\n', 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);
    await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });
  } catch (e) {
    console.error('enviarArquivo:', e.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarData(data) {
  if (!data) return 'N/D';
  const s = String(data);
  if (/^\d{14}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

function formatarNumeroProcesso(num) {
  const d = String(num || '').replace(/\D/g, '');
  if (d.length === 20) {
    return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
  }
  return num;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Gerar HTML com todos os processos ───────────────────────────────────────
function gerarHTML(estado, numero, processos, nomeAdvogado) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  function renderPartes(partes, titulo) {
    if (!partes || partes.length === 0) return '';
    let h = `<div class="polo-titulo">${titulo}</div><ul class="polo-lista">`;
    partes.forEach(parte => {
      const cpf   = parte.cpf  ? ` | CPF: ${esc(parte.cpf)}`   : '';
      const cnpj  = parte.cnpj ? ` | CNPJ: ${esc(parte.cnpj)}` : '';
      const tel   = parte.telefone ? ` | TEL: ${esc(parte.telefone)}` : '';
      const email = parte.email ? ` | EMAIL: <a href="mailto:${esc(parte.email)}">${esc(parte.email)}</a>` : '';
      h += `<li><b>${esc(parte.nome || 'N/D')}</b>${cpf}${cnpj}${tel}${email}`;
      (parte.advogados || []).forEach(adv => {
        const oabTxt  = adv.oab  ? ` — OAB: ${esc(adv.oab)}`  : '';
        const advDoc  = adv.cpf  ? ` | CPF: ${esc(adv.cpf)}`  : '';
        const advTel  = adv.telefone ? ` | TEL: ${esc(adv.telefone)}` : '';
        const advEmail= adv.email    ? ` | EMAIL: <a href="mailto:${esc(adv.email)}">${esc(adv.email)}</a>` : '';
        h += `<br><span class="adv">⚖️ Adv: ${esc(adv.nome || 'N/D')}${oabTxt}${advDoc}${advTel}${advEmail}</span>`;
      });
      h += `</li>`;
    });
    h += `</ul>`;
    return h;
  }

  function renderAdvogados(advs) {
    if (!advs || advs.length === 0) return '';
    let h = `<div class="polo-titulo">⚖️ ADVOGADOS:</div><ul class="polo-lista">`;
    advs.forEach(adv => {
      const oabTxt = adv.oab ? ` — OAB: ${esc(adv.oab)}` : '';
      h += `<li><span class="adv">${esc(adv.nome || 'N/D')}${oabTxt}</span></li>`;
    });
    h += `</ul>`;
    return h;
  }

  const cards = processos.map((p) => {
    const numRaw      = p.numero || p.numeroProcesso || 'N/D';
    const num         = formatarNumeroProcesso(numRaw);
    const link        = `https://supremodoseteoriginal.com/?processo=${num}`;
    const todasPartes = p.partes || [];
    const poloAtivo   = todasPartes.filter(x => {
      const polo = (x.polo || x.tipoPolo || x.tipo || '').toUpperCase();
      return polo.includes('ATIV') || polo.includes('AUTO') || polo.includes('REQUERENTE') || polo === 'AT';
    });
    const poloPassivo = todasPartes.filter(x => {
      const polo = (x.polo || x.tipoPolo || x.tipo || '').toUpperCase();
      return polo.includes('PASSIV') || polo.includes('RÉU') || polo.includes('REU') || polo.includes('REQUERIDO') || polo === 'PA';
    });
    // Partes sem polo definido (vindo do scraper TJSP)
    const semPolo = todasPartes.filter(x => !x.polo && !x.tipoPolo && !x.tipo);

    const valor = p.valor_display || (p.valor ? `R$ ${esc(p.valor)}` : 'N/D');
    const advsTJSP = p.advogados_tjsp || [];

    return `<div class="card">
  <div class="proc-num">PROCESSO: ${esc(num)}</div>
  <div class="row">🔗 <b>LINK:</b> <a href="${link}" target="_blank">${link}</a></div>
  <div class="row">⚖️ <b>TRIBUNAL:</b> ${esc(p.tribunal || 'N/D')}</div>
  <div class="row">📁 <b>CLASSE:</b> ${esc(p.classe || 'N/D')}</div>
  <div class="row">📌 <b>ASSUNTO:</b> ${esc(p.assunto || 'N/D')}</div>
  <div class="row">💰 <b>VALOR DA CAUSA:</b> <b style="color:#4ade80">${esc(valor)}</b></div>
  <div class="row">📅 <b>DATA INÍCIO:</b> ${esc(formatarData(p.data || p.dataAjuizamento))}</div>
  <div class="row">📅 <b>ÚLTIMA MOVIMENTAÇÃO:</b> ${esc(formatarData(p.dataUltimaMovimentacao || p.ultimaMovimentacao))}</div>
  <div class="row">👨‍⚖️ <b>ÓRGÃO JULGADOR:</b> ${esc(p.orgao || 'N/D')}</div>
  ${poloAtivo.length  > 0 ? renderPartes(poloAtivo,  '👤 POLO ATIVO:')   : ''}
  ${poloPassivo.length> 0 ? renderPartes(poloPassivo,'👤 POLO PASSIVO:') : ''}
  ${semPolo.length    > 0 ? renderPartes(semPolo,    '👥 PARTES:')       : ''}
  ${advsTJSP.length   > 0 && semPolo.length === 0 && poloAtivo.length === 0 && poloPassivo.length === 0
      ? renderAdvogados(advsTJSP) : ''}
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OAB ${esc(estado)}${esc(numero)} — Processos</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:12px}
  h1{font-size:1.1em;margin-bottom:4px;color:#fff}
  .meta{font-size:.82em;color:#aaa;margin-bottom:14px}
  .card{background:#2a2a2a;border-radius:12px;padding:14px 16px;margin-bottom:14px}
  .proc-num{font-weight:bold;font-size:.95em;margin-bottom:8px;color:#fff}
  .row{font-size:.87em;margin-bottom:4px;line-height:1.5;color:#eee}
  a{color:#6ab3f8;text-decoration:none}
  a:hover{text-decoration:underline}
  .polo-titulo{font-size:.87em;font-weight:bold;margin-top:10px;margin-bottom:4px;color:#eee}
  .polo-lista{list-style:none;padding-left:0}
  .polo-lista li{font-size:.84em;color:#ddd;margin-bottom:6px;line-height:1.6;border-left:2px solid #555;padding-left:8px}
  .adv{color:#aac8f0;font-size:.95em}
</style>
</head>
<body>
<h1>📋 OAB ${esc(estado)}${esc(numero)} — Processos Judiciais</h1>
<div class="meta">
  ${nomeAdvogado ? `👤 <b>${esc(nomeAdvogado)}</b> &nbsp;|&nbsp; ` : ''}
  📊 <b>${processos.length} processos</b> &nbsp;|&nbsp;
  🕐 Gerado em: ${esc(geradoEm)}
</div>
${cards}
</body>
</html>`;
}

// ─── Busca e entrega ──────────────────────────────────────────────────────────
async function processarOAB(token, chatId, estado, numero) {
  await enviarMensagem(token, chatId, `🔍 Buscando OAB *${estado} ${numero}*...`);

  const siglasDiretas = { SP: 'TJSP', MS: 'TJMS', MG: 'TJMG' };
  const siglaDireta = siglasDiretas[estado.toUpperCase()];
  if (siglaDireta) {
    try {
      await enviarMensagem(token, chatId, `🔍 Consultando ${siglaDireta} diretamente...`);
      const processosDiretos = estado.toUpperCase() === 'MG'
        ? await buscarOABnoTJMG(numero)
        : await buscarOABnoESAJ(estado, numero, 30);

      if (processosDiretos.length > 0) {
        await enviarMensagem(token, chatId, `✅ *${processosDiretos.length} processos encontrados no ${siglaDireta}*\n📁 Gerando arquivo HTML...`);
        const nomeArq  = `OAB_${estado}${numero}_processos.html`;
        const conteudo = gerarHTML(estado, numero, processosDiretos, null);
        const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
        await enviarArquivo(token, chatId, nomeArq, conteudo,
          `🌐 ${nomeArq}\n${kb} KB — abra no navegador\nOAB: ${estado}${numero} | 📊 ${processosDiretos.length} processos (${siglaDireta})`
        );
        return;
      }
      await enviarMensagem(token, chatId, `ℹ️ Nenhum processo encontrado no ${siglaDireta}. Consultando a fonte alternativa...`);
    } catch (e) {
      console.warn(`[${siglaDireta} direto]`, e.message);
      await enviarMensagem(token, chatId, `ℹ️ ${siglaDireta} indisponível. Consultando a fonte alternativa...`);
    }
  }

  // ── Busca de fallback executada dentro das funções Netlify ────────────────
  try {
    const buscarDatajud = require('../tribunais/datajud');
    const encontrados = await buscarDatajud(`${estado.toUpperCase()}${numero}`);
    const unicos = new Map();
    for (const processo of encontrados) {
      const numeroProcesso = processo.numero || processo.numeroProcesso;
      if (numeroProcesso && !unicos.has(numeroProcesso)) {
        unicos.set(numeroProcesso, { ...processo, numero: numeroProcesso });
      }
    }
    const processos = Array.from(unicos.values());
    const total = processos.length;

    if (total === 0) {
      await enviarMensagem(token, chatId,
        `📋 Nenhum processo encontrado para OAB *${estado} ${numero}* no DataJud/CNJ.`
      );
      return;
    }

    const temTJSP = processos.some(p => (p.tribunal || '').toUpperCase().includes('TJSP'));
    let processosFinais = processos;
    if (temTJSP) {
      await enviarMensagem(token, chatId, `✅ *Encontrados ${total} processos no DataJud/CNJ*\n🔍 Buscando dados completos no TJSP...`);
      processosFinais = await enriquecerListaTJSP(processos);
    } else {
      await enviarMensagem(token, chatId, `✅ *Encontrados ${total} processos no DataJud/CNJ*\n📁 Gerando arquivo HTML...`);
    }

    const nomeArq  = `OAB_${estado}${numero}_processos.html`;
    const conteudo = gerarHTML(estado, numero, processosFinais, null);
    const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);

    await enviarArquivo(token, chatId, nomeArq, conteudo,
      `🌐 ${nomeArq}\n${kb} KB — abra no navegador\nOAB: ${estado}${numero} | 📊 ${total} processos`
    );

  } catch (e) {
    console.error('processarOAB error:', e);
    await enviarMensagem(token, chatId, `❌ Erro ao consultar o DataJud/CNJ: ${e.message}`);
  }
}

// ─── Controle de duplicatas ───────────────────────────────────────────────────
const processados = new Set();

// ─── Handler — Netlify Background Function ────────────────────────────────────
// O Netlify responde 202 automaticamente ao Telegram e executa este handler
// sem limite de 10s — até 15 minutos disponíveis.
// O webhook do Telegram deve apontar para:
//   https://<site>/.netlify/functions/bot-background?token=TOKEN
exports.handler = async (event) => {
  try {
    const token    = resolverToken(event);
    const body     = JSON.parse(event.body || '{}');
    const updateId = body.update_id;
    const mensagem = body.message || {};
    const chatId   = mensagem.chat?.id;
    const texto    = (mensagem.text || '').trim();

    if (!chatId) return { statusCode: 200, body: 'OK' };

    // Ignorar updates duplicados
    if (updateId && processados.has(updateId)) {
      return { statusCode: 200, body: 'OK' };
    }
    if (updateId) processados.add(updateId);
    if (processados.size > 500) processados.clear();

    if (/^\/oab\s+/i.test(texto)) {
      const arg   = texto.replace(/^\/oab\s+/i, '').trim();
      const match = arg.match(/^([A-Za-z]{2})\s*(\d+)$/);
      if (!match) {
        await enviarMensagem(token, chatId, `❌ Formato inválido.\nUse: /oab UF NUMERO\nExemplo: /oab MS 3616`);
      } else {
        await processarOAB(token, chatId, match[1].toUpperCase(), match[2]);
      }

    } else if (/^\/(start|help|ajuda)$/i.test(texto)) {
      await enviarMensagem(token, chatId,
        `👋 *Bot de Processos Judiciais*\n\n` +
        `*/oab UF NUMERO* — busca processos do advogado\n\n` +
        `Exemplo: /oab MS 3616`
      );

    } else if (texto.startsWith('/')) {
      await enviarMensagem(token, chatId, `❓ Comando não reconhecido. Use /ajuda.`);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 200, body: 'OK' };
  }
};
