module.exports = (cnj) => {
  const limpo = cnj.replace(/\D/g, '');
  if (limpo.length !== 20) return cnj;
  return limpo.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
};
