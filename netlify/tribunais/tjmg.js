// Consulta pública oficial do eproc/TJMG por OAB.
// A API cpu da nova tela de consulta aponta para IP privado; usamos o formulário
// público do eproc. Se houver CAPTCHA, ele é apresentado ao usuário para resolução
// humana. Nenhum CAPTCHA é automatizado ou contornado.

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

function mergeCookies(oldCookie, newCookie) {
  const jar = new Map();
  for (const pair of String(oldCookie || '').split(';')) {
    const p = pair.trim();
    if (p && p.includes('=')) jar.set(p.split('=')[0], p.slice(p.indexOf('=') + 1));
  }
  for (const pair of String(newCookie || '').split(';')) {
    const p = pair.trim();
    if (p && p.includes('=')) jar.set(p.split('=')[0], p.slice(p.indexOf('=') + 1));
  }
  return [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ');
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
      throw new Error('TJMG eproc: tempo limite de ' + TIMEOUT_MS + ' ms excedido.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function obterFormulario(cookie = '') {
  const formUrl = new URL(FORM_PATH, BASE).toString();
  const response = await request(formUrl, {
    method: 'GET',
    headers: cookie ? { Cookie: cookie } : {}
  });
  if (!response.ok) throw new Error('TJMG eproc: formulário retornou HTTP ' + response.status + '.');
  const html = (await response.buffer()).toString('latin1');
  const novoCookie = mergeCookies(cookie, getCookieHeader(response));
  return { html, cookie: novoCookie, formUrl };
}

async function extrairImagemCaptcha(html, cookie) {
  const inline = html.match(/id=["']lblInfraCaptcha["'][^>]*>[\s\S]*?<img\b[^>]*src=["']data:image\/(png|jpe?g);base64,([^"']+)["']/i);
  if (inline) {
    const mime = inline[1].toLowerCase().includes('jp') ? 'image/jpeg' : 'image/png';
    return { imageBuffer: Buffer.from(inline[2].replace(/\s/g, ''), 'base64'), mime };
  }

  const img = html.match(/id=["']lblInfraCaptcha["'][^>]*>[\s\S]*?<img\b[^>]*src=["']([^"']+)["']/i);
  if (img && !/^data:/i.test(img[1])) {
    const imageUrl = new URL(img[1].replace(/&amp;/g, '&'), BASE).toString();
    const response = await request(imageUrl, {
      method: 'GET',
      headers: cookie ? { Cookie: cookie, Referer: new URL(FORM_PATH, BASE).toString() } : {}
    });
    if (!response.ok) throw new Error('TJMG eproc: não foi possível obter a imagem do CAPTCHA (HTTP ' + response.status + ').');
    const mime = response.headers.get('content-type') || 'image/png';
    return { imageBuffer: await response.buffer(), mime };
  }
  return null;
}

function montarFormulario(oab, captcha = '') {
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
  if (captcha) {
    body.append('txtInfraCaptcha', captcha);
    body.append('hdnInfraCaptcha', '0');
  }
  body.append('hdnInfraSelecoes', 'Infra');
  body.append('sbmNovo', 'Consultar');
  return body.toString();
}

async function enviarFormulario(oab, captcha, cookie) {
  const formUrl = new URL(FORM_PATH, BASE).toString();
  const postUrl = new URL(POST_PATH, BASE).toString();
  const response = await request(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://eproc-consulta-publica-1g.tjmg.jus.br',
      'Referer': formUrl,
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: montarFormulario(oab, captcha),
    redirect: 'manual'
  });

  let cookieAtualizado = mergeCookies(cookie, getCookieHeader(response));
  let html = '';
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('TJMG eproc redirecionou sem destino (HTTP ' + response.status + ').');
    const nextUrl = new URL(location, postUrl).toString();
    const resultResponse = await request(nextUrl, {
      method: 'GET',
      headers: { Referer: postUrl, ...(cookieAtualizado ? { Cookie: cookieAtualizado } : {}) },
      redirect: 'follow'
    });
    if (!resultResponse.ok) throw new Error('TJMG eproc resultado: HTTP ' + resultResponse.status + '.');
    cookieAtualizado = mergeCookies(cookieAtualizado, getCookieHeader(resultResponse));
    html = (await resultResponse.buffer()).toString('latin1');
  } else {
    if (!response.ok) throw new Error('TJMG eproc pesquisa: HTTP ' + response.status + '.');
    html = (await response.buffer()).toString('latin1');
  }
  return { html, cookie: cookieAtualizado };
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
    numero, tribunal: 'TJMG', classe: '', assunto: '', orgao: '', data: '', partes: [], urlProcesso: ''
  }));
}

function interpretarResultado(html) {
  if (/cf-turnstile|g-recaptcha/i.test(html)) {
    throw new Error('O portal eproc apresentou um desafio CAPTCHA interativo. A consulta foi interrompida.');
  }
  if (/captcha[\s\S]{0,120}incorreto|código da imagem[\s\S]{0,80}incorreto/i.test(limparHtml(html))) {
    return { captchaIncorreto: true };
  }
  const processos = extrairProcessos(html).filter(p => p.numero).slice(0, MAX_PROCESSOS);
  if (processos.length) return { processos };
  if (/Nenhum registro encontrado|Nenhum processo encontrado|Não foram encontrados registros/i.test(limparHtml(html))) {
    return { processos: [] };
  }
  if (/id=["']frmProcessoLista["']/i.test(html)) {
    const captcha = /txtInfraCaptcha|lblInfraCaptcha/i.test(html);
    if (captcha) return { formularioComCaptcha: true };
    throw new Error('O TJMG devolveu o formulário sem lista de processos. A pesquisa não foi confirmada.');
  }
  throw new Error('A resposta do eproc não contém resultados reconhecíveis; consulta não considerada concluída.');
}

async function buscarOABnoTJMG(oabCompleta) {
  const match = String(oabCompleta || '').trim().toUpperCase().match(/^MG\s*(\d+)$/);
  if (!match) throw new Error('Informe a OAB de Minas Gerais no formato MG + número.');
  const oab = 'MG' + match[1];

  const form = await obterFormulario();
  if (/cf-turnstile|g-recaptcha/i.test(form.html)) {
    throw new Error('O portal eproc apresentou CAPTCHA interativo. A consulta automática foi interrompida.');
  }
  if (!/id=["']frmProcessoLista["']/i.test(form.html) || !/id=["']txtStrOAB["']/i.test(form.html)) {
    throw new Error('O formulário público de OAB do eproc mudou ou não foi disponibilizado.');
  }

  const temCaptcha = /id=["']lblInfraCaptcha["']|name=["']txtInfraCaptcha["']/i.test(form.html);
  if (temCaptcha) {
    const image = await extrairImagemCaptcha(form.html, form.cookie);
    if (!image || !image.imageBuffer || !image.imageBuffer.length) {
      throw new Error('O TJMG solicitou CAPTCHA, mas a imagem não pôde ser obtida para resolução manual.');
    }
    return {
      requiresCaptcha: true,
      oab: match[1],
      cookie: form.cookie,
      imageBuffer: image.imageBuffer,
      mime: image.mime
    };
  }

  const result = await enviarFormulario(oab, '', form.cookie);
  const interpreted = interpretarResultado(result.html);
  if (interpreted.formularioComCaptcha) {
    const nextForm = await obterFormulario(result.cookie);
    const image = await extrairImagemCaptcha(nextForm.html, nextForm.cookie);
    if (!image) throw new Error('O TJMG solicitou CAPTCHA, mas a imagem não pôde ser obtida.');
    return { requiresCaptcha: true, oab: match[1], cookie: nextForm.cookie, imageBuffer: image.imageBuffer, mime: image.mime };
  }
  if (interpreted.captchaIncorreto) throw new Error('O TJMG rejeitou a confirmação visual. Tente iniciar a consulta novamente.');
  return interpreted.processos || [];
}

async function submeterCaptchaTJMG(session, codigo) {
  const oab = 'MG' + String(session.oab || '').replace(/\D/g, '');
  const result = await enviarFormulario(oab, String(codigo || '').trim(), session.cookie || '');
  const interpreted = interpretarResultado(result.html);

  if (interpreted.captchaIncorreto || interpreted.formularioComCaptcha) {
    const nextForm = await obterFormulario(result.cookie);
    const image = await extrairImagemCaptcha(nextForm.html, nextForm.cookie);
    if (!image || !image.imageBuffer || !image.imageBuffer.length) {
      throw new Error('O TJMG recusou o código e não disponibilizou uma nova imagem de CAPTCHA.');
    }
    return {
      requiresCaptcha: true,
      oab: String(session.oab || '').replace(/\D/g, ''),
      cookie: nextForm.cookie,
      imageBuffer: image.imageBuffer,
      mime: image.mime
    };
  }
  return { requiresCaptcha: false, processos: interpreted.processos || [] };
}

module.exports = buscarOABnoTJMG;
module.exports.submeterCaptcha = submeterCaptchaTJMG;
