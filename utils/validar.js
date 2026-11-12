function separarOAB(valor) {
  const texto = String(valor || '').trim().toUpperCase();
  const match = texto.match(/([A-Z]{2})\s*[-/]?\s*(\d{1,10})/);
  if (!match) return { uf: '', numero: '' };
  return { uf: match[1], numero: match[2] };
}

function limparOAB(valor) {
  const { uf, numero } = separarOAB(valor);
  return uf && numero ? `${uf}${numero}` : '';
}

module.exports = { separarOAB, limparOAB };
