const fetch = require('node-fetch');
const { limparOAB, separarOAB } = require('../utils/validar');
const { buscarPublicacoesOAB } = require('../tribunais/djen');

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

    if (chatId) await enviarMensagem(chatId, `🔍 Buscando publicações da OAB ${uf} ${numero} no DJEN/CNJ (últimos 90 dias)...`);
    const busca = await buscarPublicacoesOAB(uf, numero, 90);
    if (chatId) {
      await enviarMensagem(chatId, busca.processos.length
        ? `✅ ${busca.processos.length} processo(s) localizado(s) em publicações do DJEN/CNJ.`
        : `Nenhuma publicação localizada para OAB ${uf} ${numero} entre ${busca.dataInicio} e ${busca.dataFim}. Isso não descarta processos sem publicação nesse período.`);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        uf, numero, total: busca.processos.length,
        totalPublicacoes: busca.totalPublicacoes,
        periodo: { inicio: busca.dataInicio, fim: busca.dataFim },
        processos: busca.processos
      })
    };
  } catch (error) {
    console.error('consulta-oab:', error.message);
    return { statusCode: 502, body: JSON.stringify({ erro: 'Falha na consulta ao DJEN/CNJ.', detalhe: error.message }) };
  }
};
