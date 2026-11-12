const fetch = require('node-fetch');

const BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const TRIBUNAIS = [
  'tjac','tjal','tjam','tjap','tjba','tjce','tjdft','tjes','tjgo','tjma',
  'tjmg','tjms','tjmt','tjpa','tjpb','tjpe','tjpi','tjpr','tjrj','tjrn',
  'tjro','tjrr','tjrs','tjsc','tjse','tjsp','tjto'
];

function normalizarOAB(valor) {
  const texto = String(valor || '').trim().toUpperCase();
  const m = texto.match(/([A-Z]{2})\s*[-/]?\s*(\d{1,10})/);
  if (!m) throw new Error('OAB inválida. Informe UF e número, por exemplo MG 12345.');
  return { uf: m[1], numero: m[2] };
}

async function buscarNoTribunal(alias, oab, apiKey) {
  const url = `${BASE_URL}/api_publica_${alias}/_search`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        size: 50,
        track_total_hits: true,
        query: { query_string: { query: `*${oab}*`, default_operator: 'and' } },
        sort: [{ dataAjuizamento: { order: 'desc', unmapped_type: 'date' } }]
      }),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) {
      const detalhe = raw.slice(0, 250).replace(/\s+/g, ' ');
      throw new Error(`DataJud ${alias.toUpperCase()} HTTP ${response.status}: ${detalhe}`);
    }
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`Resposta inválida do DataJud (${alias}).`); }
    return (data.hits?.hits || []).map(hit => {
      const f = hit._source || {};
      return {
        numero: f.numeroProcesso || '',
        numeroProcesso: f.numeroProcesso || '',
        tribunal: f.tribunal?.sigla || f.tribunal || alias.toUpperCase(),
        classe: f.classe?.nome || '',
        assunto: f.assuntos?.map(a => a.nome).filter(Boolean).join('; ') || '',
        data: f.dataAjuizamento || '',
        orgao: f.orgaoJulgador?.nome || '',
        movimentos: f.movimentos || [],
        fonte: 'DATAJUD/CNJ'
      };
    }).filter(p => p.numero);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function buscarDatajud(valorOAB) {
  const { numero } = normalizarOAB(valorOAB);
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) throw new Error('Configuração ausente: cadastre DATAJUD_API_KEY nas variáveis do Netlify.');

  const resultados = [];
  const erros = [];
  const concorrencia = 5;
  for (let i = 0; i < TRIBUNAIS.length; i += concorrencia) {
    const lote = TRIBUNAIS.slice(i, i + concorrencia);
    const respostas = await Promise.all(lote.map(async alias => {
      try { return await buscarNoTribunal(alias, numero, apiKey); }
      catch (error) { erros.push(error.message); return null; }
    }));
    for (const lista of respostas) if (lista) resultados.push(...lista);
  }

  if (resultados.length === 0 && erros.length === TRIBUNAIS.length) {
    throw new Error(`DataJud indisponível em todos os ${TRIBUNAIS.length} tribunais. ${erros.slice(0, 3).join(' | ')}`);
  }

  const unicos = new Map();
  for (const p of resultados) {
    const chave = String(p.numero).replace(/\D/g, '');
    if (chave && !unicos.has(chave)) unicos.set(chave, p);
  }
  return Array.from(unicos.values());
};

module.exports.normalizarOAB = normalizarOAB;
