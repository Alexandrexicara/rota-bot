const fetch = require('node-fetch');
const { limparOAB, separarOAB } = require('../utils/validar');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';

// DataJud cobre TODOS os tribunais do Brasil (TJs, TRFs, TST, STJ, etc.)
const DATAJUD_URL  = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_KEY  = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Tribunais para busca — DataJud indexa todos
const TRIBUNAIS = [
  "api_publica_tjms",
  "api_publica_tjsp",
  "api_publica_tjmg",
  "api_publica_tjrj",
  "api_publica_tjrs",
  "api_publica_tjpr",
  "api_publica_tjba",
  "api_publica_tjce",
  "api_publica_tjgo",
  "api_publica_tjpe",
];

async function enviarMensagem(chatId, texto) {
  if (!chatId || chatId === '0') return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

async function buscarDatajud(numeroOAB, tribunal, limite = 50) {
  try {
    const res = await fetch(`${DATAJUD_URL}/${tribunal}/_search`, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${DATAJUD_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: limite,
        query: { query_string: { query: `*${numeroOAB}*` } },
      }),
    });

    if (!res.ok) return [];
    const dados = await res.json();
    return (dados.hits?.hits || []).map(item => {
      const f = item._source;
      return {
        numero:   f.numeroProcesso || '',
        tribunal: f.tribunal       || tribunal.replace('api_publica_', '').toUpperCase(),
        classe:   f.classe?.nome   || '',
        assunto:  f.assuntos?.[0]?.nome || '',
        data:     f.dataAjuizamento || '',
      };
    });
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  // Aceita tanto GET (query string) quanto POST (body JSON)
  const qs     = event.queryStringParameters || {};
  const body   = (() => { try { return JSON.parse(event.body || '{}'); } catch { return {}; } })();
  const chatId = qs.chat_id || body.chat_id || '';
  const valor  = qs.oab || qs.valor || body.oab || body.valor || '';

  const oabLimpa = limparOAB(valor);
  const { uf, numero } = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: 'OAB inválida. Use: ?oab=MS3616' }),
    };
  }

  await enviarMensagem(chatId,
    `🔍 *Buscando OAB ${uf} ${numero}* no DataJud (todos os tribunais)...`
  );

  // Buscar nos tribunais em paralelo — cada um tem timeout individual de 6s
  const promessas = TRIBUNAIS.map(t =>
    Promise.race([
      buscarDatajud(oabLimpa, t, 50),
      new Promise(r => setTimeout(() => r([]), 6000)),
    ])
  );

  const resultados = await Promise.allSettled(promessas);
  const unicos = new Map();
  for (const r of resultados) {
    if (r.status === 'fulfilled') {
      for (const p of r.value) {
        if (p.numero && !unicos.has(p.numero)) unicos.set(p.numero, p);
      }
    }
  }

  const lista = Array.from(unicos.values());
  const total = lista.length;

  if (total === 0) {
    await enviarMensagem(chatId,
      `✅ Busca concluída!\n\n📋 Nenhum processo encontrado para OAB *${uf} ${numero}*\n\n` +
      `_Fontes consultadas: DataJud/CNJ (${TRIBUNAIS.length} tribunais)_`
    );
    return { statusCode: 200, body: JSON.stringify({ total: 0, processos: [] }) };
  }

  // Enviar resumo pelo Telegram
  let msg = `✅ *${total} processo(s) encontrado(s)* para OAB *${uf} ${numero}*\n\n`;
  lista.slice(0, 15).forEach((p, i) => {
    msg += `*${i + 1}.* \`${p.numero}\`\n`;
    msg += `   ⚖️ ${p.tribunal}`;
    if (p.classe)  msg += ` · ${p.classe}`;
    if (p.data)    msg += ` · ${p.data.substring(0, 10)}`;
    msg += '\n';
    if (p.assunto) msg += `   📌 ${p.assunto}\n`;
    msg += '\n';
  });
  if (total > 15) msg += `_...e mais ${total - 15} processo(s)._\n`;

  await enviarMensagem(chatId, msg);

  // Se tiver mais processos, enviar como arquivo de texto
  if (total > 0) {
    const txt = `OAB: ${uf} ${numero}\nTotal: ${total}\n\n` +
      lista.map((p, i) =>
        `${i + 1}. CNJ: ${p.numero}\n   Tribunal: ${p.tribunal}\n   Classe: ${p.classe}\n   Assunto: ${p.assunto}\n   Data: ${p.data}\n`
      ).join('\n');

    try {
      const { FormData, Blob } = require('node-fetch');
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('document', new Blob([txt], { type: 'text/plain' }), `processos-oab-${uf}${numero}.txt`);
      form.append('caption', `📁 Lista completa: ${total} processos OAB ${uf} ${numero}`);
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form,
      });
    } catch (e) {
      console.log('Erro ao enviar arquivo:', e.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ total, processos: lista }),
  };
};
