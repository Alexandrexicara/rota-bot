const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = {
  pg: pool, // Expõe para limpeza automática
  criarConsulta: async (oab, limite = 200) => {
    const existe = await pool.query(
      "SELECT id FROM consultas WHERE oab = $1 AND status = 'PROCESSANDO' LIMIT 1",
      [oab]
    );
    if (existe.rows.length) return { duplicada: true, id: existe.rows[0].id };

    const id = `${oab.replace(/\W/g, "")}-${Date.now()}`;
    await pool.query(
      "INSERT INTO consultas (id, oab, limite) VALUES ($1, $2, $3)",
      [id, oab, limite]
    );
    return { duplicada: false, id };
  },

  atualizarConsulta: async (id, dados) => {
    const campos = [];
    const valores = [];
    let idx = 1;
    for (const [chave, val] of Object.entries(dados)) {
      if (chave === "processos") continue;
      const col = chave.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      campos.push(`${col} = $${idx++}`);
      valores.push(chave === "erros" ? JSON.stringify(val) : val);
    }
    valores.push(id);
    await pool.query(`UPDATE consultas SET ${campos.join(", ")} WHERE id = $${idx}`, valores);

    if (dados.processos?.length) {
      for (const p of dados.processos) {
        await pool.query(`
          INSERT INTO processos (consulta_id, numero, tribunal, classe, assunto, data)
          VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (numero) DO NOTHING
        `, [id, p.numero, p.tribunal, p.classe, p.assunto, p.data]);
      }
    }
  },

  buscarConsulta: async (id) => {
    const res = await pool.query("SELECT * FROM consultas WHERE id = $1", [id]);
    if (!res.rows.length) return null;
    const c = res.rows[0];
    c.erros = c.erros || [];
    c.processos = (await pool.query("SELECT * FROM processos WHERE consulta_id = $1", [id])).rows;
    return c;
  }
};
