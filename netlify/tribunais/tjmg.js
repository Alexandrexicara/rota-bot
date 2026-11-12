// Consulta pública oficial do eproc/TJMG por OAB.
// A API cpu do portal consulta.tjmg.jus.br aponta para IP privado (10.0.35.55)
// e não pode ser usada fora da rede do Tribunal. Esta integração usa o formulário
// público do eproc, sem DJEN/CNJ e sem contornar CAPTCHA/autenticação.

const fetch = require('node-fetch');

const BASE = 'https://eproc-consulta-publica-1g.tjmg.jus.br/eproc/';
const FORM_PATH = 'externo_controlador.php?acao=processo_consulta_publica';
const POST_PATH = FORM_PATH + '&acao_origem=&acao_retorno=processo_consulta_publica';
const TIMEOUT_MS = 15000;
const MAX_PROCESSOS = 30;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Connection': 'close'
};

function limparHtml(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&aacute;/gi, 'á').replace(/&atilde;/gi, 'ã').replace(/&acirc;/gi, 'â')
    .replace(/&eacute;/gi, 'é').replace(/&ecirc;/gi, 'ê').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&otilde;/gi, 'õ').replace(/&ocirc;/gi, 'ô')
    .replace(/&uacute;/gi, 'ú').replace(/&ccedil;/gi, 'ç')
    .replace(/&Aacute;/g, 'Á').replace(/&Atilde;/g, 'Ã').replace(/&Ccedil;/g, 'Ç')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCookieHeader(response) {
  const raw = response.headers.raw ? response.headers.raw()['set-cookie'] : null;
  if (!raw || !raw.length) return '';
  return raw.map(v => String(v).split(';')[0]).filter(Boolean).join('; ');
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) },
      signal: controller.signal,
      timeout: TIMEOUT_MS,
      redirect: options.redirect || 'manual'
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('TJMG eproc: tempo limite de ' + TIMEOUT_MS + ' ms excedido em ' + url);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extrairLinhas(html) {
  const linhas = [];
  const re = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const row = match[0];
    if (!/processo_seleciona_publica|num_processo|numeroProcesso/i.test(row)) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => limparHtml(m[1]));
    const anchors = [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const href = anchors.map(a => a[1].replace(/&amp;/g, '&')).find(h => /processo_seleciona_publica|num_processo/i.test(h)) || '';
    const linkText = anchors.length ? limparHtml(anchors[0][2]) : '';
    const numParam = href.match(/[?&](?:num_processo|numeroProcesso)=([0-9]{20})/i);
    const numTexto = (linkText + ' ' + cells.join(' ')).match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
    const numLivre = (linkText + ' ' + cells.join(' ')).match(/\b\d{20}\b/);
    const numero = numParam ? numParam[1] : (numTexto ? numTexto[0] : (numLivre ? numLivre[0] : ''));
    if (!numero) continue;

    const texto = cells.join(' | ');
    linhas.push({
      numero,
      tribunal: 'TJMG',
      classe: cells.find(v => /procedimento|execu|ação|acao|cumprimento|inventário|inventario|recurso/i.test(v)) || '',
      assunto: '',
      orgao: cells.find(v => /vara|juizado|câmara|camara|unidade|comarca/i.test(v)) || '',
      data: (texto.match(/\b\d{2}\/\d{2}\/\d{4}\b/) || [])[0] || '',
      partes: [],
      urlProcesso: href ? new URL(href, BASE).toString() : ''
    });
  }
  return linhas;
}

function extrairProcessos(html) {
  const resultados = extrairLinhas(html);
  if (resultados.length) return resultados;

  const numeros = new Set();
  const re = /(?:num_processo|numeroProcesso)=([0-9]{20})/gi;
  let m;
  while ((m = re.exec(html)) !== null) numeros.add(m[1]);
  if (!numeros.size) {
    const cnj = [...html.matchAll(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g)];
    for (const item of cnj) numeros.add(item[0]);
  }
  return [...numeros].map(numero => ({
    numero, tribunal: 'TJMG', classe: '', assunto: '', orgao: '', data: '', partes: []
  }));
}

async function buscarOABnoTJMG(oabCompleta) {
  const match = String(oabCompleta || '').trim().toUpperCase().match(/^MG\s*(\d+)$/);
  if (!match) throw new Error('Informe a OAB de Minas Gerais no formato MG + número.');

  const oab = 'MG' + match[1];
  const formUrl = new URL(FORM_PATH, BASE).toString();
  const postUrl = new URL(POST_PATH, BASE).toString();

  const formResponse = await request(formUrl, { method: 'GET' });
  if (!formResponse.ok) {
    throw new Error('TJMG eproc: formulário retornou HTTP ' + formResponse.status + '.');
  }

  const formBuffer = await formResponse.buffer();
  const formHtml = formBuffer.toString('latin1');
  const cookie = getCookieHeader(formResponse);

  // Se o tribunal ativar CAPTCHA, não tentamos resolvê-lo nem contorná-lo.
  if (/cf-turnstile|g-recaptcha|txtInfraCaptcha|lblInfraCaptcha/i.test(formHtml)) {
    throw new Error('O portal eproc apresentou CAPTCHA. A consulta automática foi interrompida por segurança.');
  }
  if (!/id=["']frmProcessoLista["']/i.test(formHtml) || !/id=["']txtStrOAB["']/i.test(formHtml)) {
    throw new Error('O formulário público de OAB do eproc mudou ou não foi disponibilizado.');
  }

  const body = new URLSearchParams();
  body.append('hdnInfraTipoPagina', '1');
  body.append('txtNumProcesso', '');
  body.append('txtNumChave', '');
  body.append('txtNumChaveDocumento', '');
  body.append('txtStrParte', '');
  body.append('chkFonetica', 'N');
  body.append('chkFonetica', 'S');
  body.append('txtStrOAB', oab);
  body.append('rdoTipo', 'CPF');
  body.append('txtCpfCnpj', '');
  body.append('hdnInfraSelecoes', 'Infra');
  body.append('sbmNovo', 'Consultar');

  const postHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://eproc-consulta-publica-1g.tjmg.jus.br',
    'Referer': formUrl,
    ...(cookie ? { Cookie: cookie } : {})
  };

  const postResponse = await request(postUrl, {
    method: 'POST',
    headers: postHeaders,
    body: body.toString(),
    redirect: 'manual'
  });

  let resultHtml = '';
  if (postResponse.status >= 300 && postResponse.status < 400) {
    const location = postResponse.headers.get('location');
    if (!location) throw new Error('TJMG eproc redirecionou sem destino (HTTP ' + postResponse.status + ').');
    const nextUrl = new URL(location, postUrl).toString();
    const resultResponse = await request(nextUrl, {
      method: 'GET',
      headers: { Referer: postUrl, ...(cookie ? { Cookie: cookie } : {}) },
      redirect: 'follow'
    });
    if (!resultResponse.ok) throw new Error('TJMG eproc resultado: HTTP ' + resultResponse.status + '.');
    resultHtml = (await resultResponse.buffer()).toString('latin1');
  } else {
    if (!postResponse.ok) throw new Error('TJMG eproc pesquisa: HTTP ' + postResponse.status + '.');
    resultHtml = (await postResponse.buffer()).toString('latin1');
  }

  if (/cf-turnstile|g-recaptcha|txtInfraCaptcha|lblInfraCaptcha/i.test(resultHtml)) {
    throw new Error('O portal eproc solicitou CAPTCHA durante a pesquisa. Nenhum mecanismo automático foi usado.');
  }

  const processos = extrairProcessos(resultHtml).filter(p => p.numero).slice(0, MAX_PROCESSOS);
  if (processos.length) return processos;

  if (/Nenhum registro encontrado|Nenhum processo encontrado|Não foram encontrados registros/i.test(limparHtml(resultHtml))) {
    return [];
  }

  if (/id=["']frmProcessoLista["']/i.test(resultHtml)) {
    throw new Error('O TJMG devolveu o formulário sem lista de processos. A pesquisa não foi confirmada.');
  }

  throw new Error('A resposta do eproc não contém resultados reconhecíveis; consulta não considerada concluída.');
}

module.exports = buscarOABnoTJMG;
