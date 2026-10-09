const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutos

exports.get = (chave) => {
  const item = cache.get(chave);
  if (!item) return null;
  if (Date.now() > item.expiraEm) {
    cache.delete(chave);
    return null;
  }
  return item.dados;
};

exports.set = (chave, dados) => {
  cache.set(chave, { dados, expiraEm: Date.now() + TTL });
};
