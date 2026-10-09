const fetch = require('node-fetch');
const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const CHAVE_API = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const TRIBUNAIS = { tjms: "api_publica_tjms", tjsp: "api_publica_tjsp", tjmg: "api_publica_tjmg" };
const esperar = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (oabInput) => {
  // Aceita tanto string "MS3616" quanto objeto { numeroOAB: "MS3616" }
  const numeroOAB = (typeof oabInput === 'string') ? oabInput : oabInput?.numeroOAB;
  if (!numeroOAB) return [];
  const resultados = [];
  const MAX_POR_TRIBUNAL = 70; // Total não passa de 200 somado

  for (const [sigla, rota] of Object.entries(TRIBUNAIS)) {
    try {
      await esperar(1200); // Evita erro 429
      const res = await fetch(`${BASE_URL}/${rota}/_search`, {
        method: "POST",
        headers: { Authorization: `APIKey ${CHAVE_API}`, "Content-Type": "application/json" },
        body: JSON.stringify({ size: MAX_POR_TRIBUNAL, query: { query_string: { query: `*${numeroOAB}*` } } })
      });

      if (res.status === 429) { await esperar(4000); continue; }
      if (!res.ok) continue;

      const dados = await res.json();
      dados.hits?.hits?.forEach(item => {
        const f = item._source;
        resultados.push({
          numero: f.numeroProcesso || "",
          tribunal: f.tribunal || sigla.toUpperCase(),
          classe: f.classe?.nome || "",
          assunto: f.assuntos?.[0]?.nome || "",
          data: f.dataAjuizamento || ""
        });
      });

      if (resultados.length >= 200) break; // Para cedo se chegar ao limite

    } catch { continue; }
  }
  return resultados;
};
