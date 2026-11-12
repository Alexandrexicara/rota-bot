const fetch = require('node-fetch');

const API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const DIAS_PADRAO = 90;
const MAX_PAGINAS = 10;

function dataLocalSP(diasAtras = 0) {
  const agora = new Date();
  const local = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  local.setDate(local.getDate() - diasAtras);
  const ano = local.getFullYear();
  const mes = String(local.getMonth() + 1).padStart(2, '0');
  const dia = String(local.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function digitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function advogadoCorresponde(item, uf, numero) {
  const advogados = item.destinatarioadvogados || item.destinatarioAdvogados || [];
  if (!Array.isArray(advogados)) return false;
  return advogados.some(adv => {
    const numeroOab = digitos(adv.numeroOab || adv.numeroOAB || adv.numero || adv.inscricao);
    const ufOab = String(adv.ufOab || adv.ufOAB || adv.uf || '').toUpperCase();
    return numeroOab === digitos(numero) && ufOab === uf.toUpperCase();
  });
}

function mapear(item) {
  return {
    numero: item.numeroProcesso || item.numeroProcessoFormatado || item.numero || '',
    numeroProcesso: item.numeroProcesso || item.numeroProcessoFormatado || item.numero || '',
    tribunal: item.siglaTribunal || item.tribunal || 'DJEN/CNJ',
    classe: item.nomeClasse || item.classeProcessual || item.classe?.nome || '',
    assunto: item.assunto || item.nomeAssunto || '',
    orgao: item.nomeOrgao || item.orgaoJulgador || '',
    data: item.dataDisponibilizacao || item.dataPublicacao || '',
    dataUltimaMovimentacao: item.dataDisponibilizacao || '',
    textoPublicacao: item.texto || item.conteudo || '',
    link: item.link || item.url || '',
    destinatarioadvogados: item.destinatarioadvogados || item.destinatarioAdvogados || [],
    fonte: 'DJEN/CNJ'
  };
}

async function requisitar(params) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  let ultimaFalha;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'ProcessosBot/1.0 (consulta pública DJEN)' },
        timeout: 20000
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after')) || tentativa;
        ultimaFalha = new Error(`DJEN HTTP ${response.status}`);
        if (tentativa < 3) {
          await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter, 10) * 1000));
          continue;
        }
      }
      if (!response.ok) {
        const detalhe = (await response.text().catch(() => '')).slice(0, 250);
        throw new Error(`DJEN HTTP ${response.status}: ${detalhe}`);
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Resposta do DJEN não contém a lista esperada de comunicações.');
      }
      return data;
    } catch (error) {
      ultimaFalha = error;
      if (tentativa < 3 && !/HTTP 4(?!29)/.test(error.message)) {
        await new Promise(resolve => setTimeout(resolve, tentativa * 1000));
        continue;
      }
      throw error;
    }
  }
  throw ultimaFalha || new Error('Falha ao consultar o DJEN.');
}

async function buscarPublicacoesOAB(uf, numero, dias = DIAS_PADRAO) {
  const estado = String(uf || '').trim().toUpperCase();
  const inscricao = digitos(numero);
  if (!/^[A-Z]{2}$/.test(estado) || !inscricao) {
    throw new Error('Informe UF e número da OAB válidos.');
  }

  const inicio = dataLocalSP(dias);
  const fim = dataLocalSP(0);
  const resultados = [];
  let totalInformado = 0;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const data = await requisitar({
      numeroOab: inscricao,
      ufOab: estado,
      dataDisponibilizacaoInicio: inicio,
      dataDisponibilizacaoFim: fim,
      itensPorPagina: 100,
      pagina
    });
    totalInformado = Number(data.count || data.total || 0);
    resultados.push(...data.items.filter(item => advogadoCorresponde(item, estado, inscricao)));
    if (data.items.length < 100 || resultados.length >= totalInformado || pagina * 100 >= totalInformado) break;
  }

  const porProcesso = new Map();
  for (const item of resultados) {
    const processo = mapear(item);
    const chave = digitos(processo.numero);
    if (!chave) continue;
    const anterior = porProcesso.get(chave);
    if (!anterior || String(processo.data) > String(anterior.data)) porProcesso.set(chave, processo);
  }

  return {
    processos: Array.from(porProcesso.values()),
    totalPublicacoes: totalInformado,
    dataInicio: inicio,
    dataFim: fim,
    paginasConsultadas: Math.min(MAX_PAGINAS, Math.max(1, Math.ceil(Math.min(totalInformado, MAX_PAGINAS * 100) / 100)))
  };
}

module.exports = { buscarPublicacoesOAB };
