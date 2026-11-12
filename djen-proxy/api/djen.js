const ALLOWED = new Set([
  'numeroOab', 'ufOab', 'nomeAdvogado', 'nomeParte', 'numeroProcesso',
  'siglaTribunal', 'texto', 'dataDisponibilizacaoInicio',
  'dataDisponibilizacaoFim', 'meio', 'pagina', 'itensPorPagina'
]);

function safeEqual(a, b) {
  const crypto = require('crypto');
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.DJEN_PROXY_SECRET;
  if (!expected || !safeEqual(req.headers['x-proxy-secret'], expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (!ALLOWED.has(key)) continue;
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized !== undefined && normalized !== null && String(normalized).trim()) {
      query.set(key, String(normalized).trim());
    }
  }

  const pageSize = Number(query.get('itensPorPagina') || 100);
  if (![5, 100].includes(pageSize)) {
    return res.status(400).json({ error: 'itensPorPagina must be 5 or 100' });
  }
  query.set('itensPorPagina', String(pageSize));

  const page = Number(query.get('pagina') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    return res.status(400).json({ error: 'pagina must be between 1 and 100' });
  }

  const target = new URL('https://comunicaapi.pje.jus.br/api/v1/comunicacao');
  target.search = query.toString();

  try {
    const response = await fetch(target.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProcessosBot/1.0 (consulta pública DJEN)'
      },
      signal: AbortSignal.timeout(25000)
    });
    const body = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(response.status).send(body);
  } catch (error) {
    console.error('DJEN proxy error:', error.message);
    return res.status(502).json({ error: 'Falha ao consultar DJEN', detail: error.message });
  }
};
