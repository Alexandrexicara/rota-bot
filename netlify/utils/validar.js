// Funções definidas primeiro no escopo local
const limparOAB = (oab) =>
  (oab || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();

const validarOAB = (oab) =>
  /^[A-Z]{2}\d{4,}$/i.test(limparOAB(oab));

const separarOAB = (oab) => {
  const limpo = limparOAB(oab);
  return {
    uf: limpo.substring(0, 2),
    numero: limpo.substring(2)
  };
};

// Exporta todas de uma vez
module.exports = {
  validarOAB,
  limparOAB,
  separarOAB
};
