module.exports = (processos) => {
  const unicos = new Map();
  processos.forEach(p => {
    if (!p.numero) return;
    if (!unicos.has(p.numero)) unicos.set(p.numero, p);
  });
  return Array.from(unicos.values());
};
