const fetch = require('node-fetch');
const { limparOAB, separarOAB } = require('../utils/validar');
const buscarDatajud = require('../tribunais/datajud');

async function enviarMensagem(chatId, texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
    timeout: 10000
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.description || `Telegram HTTP ${response.status}`);
  }
}

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const chatId = qs.chat_id || body.chat_id || '';
    const valor = qs.oab || qs.valor || body.oab || body.valor || '';
    const { uf, numero } = separarOAB(valor);
    const oabLimpa = limparOAB(valor);

    if (!oabLimpa || !numero || numero.length < 3) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'OAB inválida. Use ?oab=MG12345' }) };
    }

    if (chatId) await enviarMensagem(chatId, `🔍 Buscando OAB ${uf} ${numero} no DataJud/CNJ...`);
    const processos = await buscarDatajud(oabLimpa);
    if (chatId) {
      await enviarMensagem(chatId, processos.length
        ? `✅ Busca concluída: ${processos.length} processo(s) localizado(s) para OAB ${uf} ${numero}.`
        : `Busca concluída. Nenhum processo localizado para OAB ${uf} ${numero} nas consultas que responderam.`);
    }
    return { statusCode: 200, body: JSON.stringify({ uf, numero, total: processos.length, processos }) };
  } catch (error) {
    console.error('consulta-oab:', error.message);
    return { statusCode: 502, body: JSON.stringify({ erro: 'Falha na consulta DataJud.', detalhe: error.message }) };
  }
};
