const fetch = require('node-fetch');

function getToken(event) {
  const tokens = [process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN_2].filter(Boolean);
  const requested = event?.queryStringParameters?.token;
  return requested && tokens.includes(requested) ? requested : (tokens[0] || '');
}

function baseUrl(event) {
  const headers = event.headers || {};
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers['x-forwarded-host'] || headers.host || process.env.URL || '';
  if (!host) throw new Error('Não foi possível identificar o domínio do Netlify.');
  return `${proto}://${String(host).replace(/^https?:\/\//i, '')}`;
}

async function telegram(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 10000
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram HTTP ${response.status}`);
  }
  return data;
}

const processados = new Set();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const token = getToken(event);
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN não configurado.');
      return { statusCode: 200, body: 'OK' };
    }

    const body = JSON.parse(event.body || '{}');
    const mensagem = body.message || body.edited_message || {};
    const chatId = mensagem.chat?.id;
    const texto = String(mensagem.text || '').trim();
    if (!chatId || !texto) return { statusCode: 200, body: 'OK' };

    if (body.update_id !== undefined) {
      if (processados.has(body.update_id)) return { statusCode: 200, body: 'OK' };
      processados.add(body.update_id);
      if (processados.size > 1000) processados.clear();
    }

    const comando = texto.split(/\s+/)[0].replace(/@[^@]+$/, '').toLowerCase();
    if (comando === '/diagmg') {
      const url = new URL('/.netlify/functions/bot-background', baseUrl(event));
      if (token) url.searchParams.set('token', token);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 15000
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('Falha ao iniciar diagnóstico TJMG:', response.status, detail.slice(0, 300));
        await telegram(token, 'sendMessage', {
          chat_id: chatId,
          text: '⚠️ Não consegui iniciar o diagnóstico TJMG.'
        });
      }
      return { statusCode: 200, body: 'OK' };
    }

    if (texto && !texto.startsWith('/')) {
      // Encaminha respostas de CAPTCHA (texto comum) ao processador em background.
      // Se não houver sessão pendente, o background simplesmente ignora a mensagem.
      const url = new URL('/.netlify/functions/bot-background', baseUrl(event));
      if (token) url.searchParams.set('token', token);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 15000
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('Falha ao encaminhar resposta de CAPTCHA:', response.status, detail.slice(0, 300));
      }
      return { statusCode: 200, body: 'OK' };
    }

    if (comando === '/oab') {
      const arg = texto.replace(/^\/oab(?:@[^\s]+)?\s*/i, '').trim();
      const match = arg.match(/^([A-Za-z]{2})\s*[-/]?\s*(\d{1,10})$/);
      if (!match) {
        await telegram(token, 'sendMessage', {
          chat_id: chatId,
          text: '❌ Formato inválido. Use: /oab UF NUMERO\nExemplo: /oab MG 12345'
        });
        return { statusCode: 200, body: 'OK' };
      }

      const url = new URL('/.netlify/functions/bot-background', baseUrl(event));
      if (token) url.searchParams.set('token', token);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 15000
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('Falha ao iniciar background:', response.status, detail.slice(0, 300));
        await telegram(token, 'sendMessage', {
          chat_id: chatId,
          text: '⚠️ Não consegui iniciar a consulta agora. Tente novamente em instantes.'
        });
      }
      return { statusCode: 200, body: 'OK' };
    }

    if (['/start', '/help', '/ajuda'].includes(comando)) {
      await telegram(token, 'sendMessage', {
        chat_id: chatId,
        text: '👋 Bot de Processos Judiciais\n\n/oab UF NUMERO — busca processos por inscrição OAB.\nExemplo: /oab MG 12345'
      });
    } else if (comando.startsWith('/')) {
      await telegram(token, 'sendMessage', {
        chat_id: chatId,
        text: '❓ Comando não reconhecido. Use /ajuda.'
      });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Webhook Telegram:', error.message);
    return { statusCode: 200, body: 'OK' };
  }
};
