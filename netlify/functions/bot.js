const fetch = require('node-fetch');

const BOTS = [
  '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo',
  '8783865981:AAG2MP2vb0iLeIeDWewKb5JQXYKL6JxPIiM',
];

function resolverToken(event) {
  const qs = event.queryStringParameters || {};
  if (qs.token && BOTS.includes(qs.token)) return qs.token;
  return BOTS[0];
}

// ─── Controle de duplicatas ───────────────────────────────────────────────────
const processados = new Set();

// ─── Handler — responde 200 OK imediatamente e chama background ───────────────
exports.handler = async (event) => {
  try {
    const token    = resolverToken(event);
    const body     = JSON.parse(event.body || '{}');
    const updateId = body.update_id;
    const mensagem = body.message || {};
    const chatId   = mensagem.chat?.id;
    const texto    = (mensagem.text || '').trim();

    if (!chatId) return { statusCode: 200, body: 'OK' };

    // Deduplicar
    if (updateId && processados.has(updateId)) {
      return { statusCode: 200, body: 'OK' };
    }
    if (updateId) processados.add(updateId);
    if (processados.size > 500) processados.clear();

    if (/^\/oab\s+/i.test(texto)) {
      const arg   = texto.replace(/^\/oab\s+/i, '').trim();
      const match = arg.match(/^([A-Za-z]{2})\s*(\d+)$/);

      if (!match) {
        // Resposta rápida — não precisa de background
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `❌ Formato inválido.\nUse: /oab UF NUMERO\nExemplo: /oab MS 3616` }),
        });
      } else {
        // Chamar background function para fazer a busca longa
        const bgUrl = `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}/.netlify/functions/bot-background`;
        fetch(bgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, chatId, estado: match[1].toUpperCase(), numero: match[2] }),
        }).catch(() => {});
      }

    } else if (/^\/(start|help|ajuda)$/i.test(texto)) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👋 *Bot de Processos Judiciais*\n\n*/oab UF NUMERO* — busca processos do advogado\n\nExemplo: /oab MS 3616`,
          parse_mode: 'Markdown',
        }),
      });

    } else if (texto.startsWith('/')) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `❓ Comando não reconhecido. Use /ajuda.` }),
      });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 200, body: 'OK' };
  }
};
